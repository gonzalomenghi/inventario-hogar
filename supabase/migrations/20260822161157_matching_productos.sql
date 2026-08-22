-- ============================================================
-- Matching de productos sin depender del código de barras
-- Fase 1 (extensión) — búsqueda difusa por nombre + catálogo SEPA
-- de referencia para autocompletar categoría/marca/EAN
--
-- Migración puramente aditiva: extensiones + tabla nueva + índices +
-- función. No modifica ninguna tabla existente.
--
-- Todo queda calificado explícitamente con "public." (funciones,
-- operador % y opclass gin_trgm_ops) en vez de depender de
-- search_path: en el runner de migraciones de la CLI un SET
-- search_path a nivel de archivo no se sostiene de forma confiable
-- entre statements (DDL vs. función vs. índice cada uno resuelve por
-- su lado), así que la única forma robusta es no depender de él.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() es STABLE, no IMMUTABLE, así que Postgres no deja usarla
-- directo en un índice funcional (el motor exige determinismo para
-- indexar). Wrapper estándar para poder marcarla IMMUTABLE: es seguro
-- en la práctica porque el diccionario 'unaccent' no cambia en runtime.
-- SET search_path fijo a nivel de función: no depende de cómo haya
-- quedado el search_path de la sesión que la invoque.
CREATE OR REPLACE FUNCTION inmutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent($1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = public;

-- 1) Tabla "diccionario": volcado periódico (diario/semanal) del dataset
--    SEPA/Precios Claros. No es lo que el usuario ve ni carga: es la
--    referencia contra la que matcheamos texto libre. Se sincroniza vía
--    la Edge Function en supabase/functions/sync-catalogo-sepa/ (stub).
CREATE TABLE IF NOT EXISTS catalogo_sepa_ref (
    codigo_barras        text PRIMARY KEY,
    nombre_sepa          text NOT NULL,
    marca                text,
    categoria_sugerida   categoria_producto,
    ultima_actualizacion timestamptz NOT NULL DEFAULT now()
);

-- Solo la sincroniza el proceso periódico (service_role, bypassea RLS).
-- Lectura pública porque alimenta el autocompletado de cualquier usuario
-- autenticado, igual que productos_base.
ALTER TABLE catalogo_sepa_ref ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectura publica de catalogo sepa"
  ON catalogo_sepa_ref
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_catalogo_sepa_nombre_trgm
    ON catalogo_sepa_ref USING GIN (inmutable_unaccent(lower(nombre_sepa)) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_productos_base_nombre_trgm
    ON productos_base USING GIN (inmutable_unaccent(lower(nombre)) public.gin_trgm_ops);

-- 2) Función de búsqueda difusa: recibe lo que el usuario tipeó
--    ("leche tregar", "yerba palo", "papel higienico elegante")
--    y devuelve primero coincidencias dentro de su propio catálogo
--    (productos_base) y, si no hay nada bueno, coincidencias en el
--    diccionario SEPA (con EAN ya resuelto para autocompletar).
CREATE OR REPLACE FUNCTION buscar_producto_similar(texto_busqueda TEXT, limite INT DEFAULT 6)
RETURNS TABLE (
    origen         TEXT,           -- 'propio' | 'sepa'
    codigo_barras  text,
    nombre         text,
    marca          text,
    categoria      categoria_producto,
    similitud      REAL
) AS $$
    SELECT 'propio' AS origen, p.codigo_barras, p.nombre, p.marca, p.categoria,
           public.similarity(inmutable_unaccent(lower(p.nombre)), inmutable_unaccent(lower(texto_busqueda))) AS similitud
    FROM productos_base p
    WHERE inmutable_unaccent(lower(p.nombre)) OPERATOR(public.%) inmutable_unaccent(lower(texto_busqueda))

    UNION ALL

    SELECT 'sepa' AS origen, s.codigo_barras, s.nombre_sepa AS nombre, s.marca, s.categoria_sugerida AS categoria,
           public.similarity(inmutable_unaccent(lower(s.nombre_sepa)), inmutable_unaccent(lower(texto_busqueda))) AS similitud
    FROM catalogo_sepa_ref s
    WHERE inmutable_unaccent(lower(s.nombre_sepa)) OPERATOR(public.%) inmutable_unaccent(lower(texto_busqueda))
      AND NOT EXISTS (
          SELECT 1 FROM productos_base p2 WHERE p2.codigo_barras = s.codigo_barras
      )

    ORDER BY similitud DESC
    LIMIT limite;
$$ LANGUAGE sql STABLE SET search_path = public;

-- Ejemplo de uso desde la app (autocompletado mientras el usuario tipea):
-- SELECT * FROM buscar_producto_similar('leche descremada tregar');
