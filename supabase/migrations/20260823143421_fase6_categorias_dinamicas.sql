-- ============================================================
-- Fase 6: categorías dinámicas (tabla en vez de enum fijo)
--
-- Hasta ahora "categoria" era un enum fijo (categoria_producto:
-- alimentos/higiene/limpieza), imposible de editar desde la app sin
-- una migración de schema. Esta migración lo reemplaza por una tabla
-- "categorias" (catálogo compartido, mismo criterio MVP-abierto que
-- productos_base) referenciada por FK desde productos_base y
-- catalogo_sepa_ref, y actualiza buscar_producto_similar para
-- devolver nombre/ícono en vez del enum.
-- ============================================================

-- 1) Tabla categorias -------------------------------------------------

CREATE TABLE public.categorias (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     text NOT NULL,
    icono      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicidad case-insensitive: permite detectar duplicados al crear una
-- categoría nueva desde el picker (error 23505 -> mensaje amigable).
CREATE UNIQUE INDEX categorias_nombre_lower_key ON public.categorias (lower(nombre));

CREATE TRIGGER trg_categorias_updated_at
  BEFORE UPDATE ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectura publica de categorias"
  ON public.categorias
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "usuarios autenticados pueden crear categorias"
  ON public.categorias
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "usuarios autenticados pueden editar categorias"
  ON public.categorias
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- Mismo gotcha ya documentado en CLAUDE.md: RLS solo no alcanza, hace
-- falta el GRANT de tabla explícito o Postgres tira "permission
-- denied" antes de evaluar las policies. Calcado del bloque de grants
-- de productos_base.
grant delete on table public.categorias to anon;
grant insert on table public.categorias to anon;
grant references on table public.categorias to anon;
grant select on table public.categorias to anon;
grant trigger on table public.categorias to anon;
grant truncate on table public.categorias to anon;
grant update on table public.categorias to anon;

grant delete on table public.categorias to authenticated;
grant insert on table public.categorias to authenticated;
grant references on table public.categorias to authenticated;
grant select on table public.categorias to authenticated;
grant trigger on table public.categorias to authenticated;
grant truncate on table public.categorias to authenticated;
grant update on table public.categorias to authenticated;

grant delete on table public.categorias to service_role;
grant insert on table public.categorias to service_role;
grant references on table public.categorias to service_role;
grant select on table public.categorias to service_role;
grant trigger on table public.categorias to service_role;
grant truncate on table public.categorias to service_role;
grant update on table public.categorias to service_role;

-- Semilla: las 3 categorías que hoy existen como valores de enum.
INSERT INTO public.categorias (nombre, icono) VALUES
  ('Alimentos', '🍎'),
  ('Higiene', '🧼'),
  ('Limpieza', '🧽');

-- 2) productos_base: falta la policy de UPDATE ------------------------
-- Hoy solo tiene SELECT + INSERT. Sin esto, guardar un cambio de
-- categoría (o cualquier otro campo) fallaría por RLS aunque el GRANT
-- de tabla ya exista. Mismo criterio MVP-abierto que ya tiene el INSERT.
CREATE POLICY "usuarios autenticados pueden editar productos"
  ON public.productos_base
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- 3) productos_base.categoria (enum) -> categoria_id (FK) -------------

ALTER TABLE public.productos_base ADD COLUMN categoria_id uuid;

UPDATE public.productos_base p
SET categoria_id = c.id
FROM public.categorias c
WHERE lower(c.nombre) = p.categoria::text;

ALTER TABLE public.productos_base ALTER COLUMN categoria_id SET NOT NULL;

ALTER TABLE public.productos_base
  ADD CONSTRAINT productos_base_categoria_id_fkey
  FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE RESTRICT;

DROP INDEX public.idx_productos_base_categoria;
CREATE INDEX idx_productos_base_categoria_id ON public.productos_base USING btree (categoria_id);

ALTER TABLE public.productos_base DROP COLUMN categoria;

-- 4) catalogo_sepa_ref.categoria_sugerida (enum) -> categoria_sugerida_id (FK, nullable)

ALTER TABLE public.catalogo_sepa_ref
  ADD COLUMN categoria_sugerida_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL;

UPDATE public.catalogo_sepa_ref s
SET categoria_sugerida_id = c.id
FROM public.categorias c
WHERE lower(c.nombre) = s.categoria_sugerida::text
  AND s.categoria_sugerida IS NOT NULL;

ALTER TABLE public.catalogo_sepa_ref DROP COLUMN categoria_sugerida;

-- 5) Reescribir buscar_producto_similar ---------------------------------
-- Cambia la lista de columnas devueltas (categoria enum -> categoria_id/
-- categoria_nombre/categoria_icono), así que hace falta DROP FUNCTION
-- primero (CREATE OR REPLACE no permite cambiar el shape de retorno),
-- mismo motivo ya documentado en la migración de matching original.
-- También es lo que libera al enum de su última referencia: hay que
-- dropear la función vieja ANTES del DROP TYPE de más abajo, o
-- Postgres rechaza el DROP TYPE por dependencia.
DROP FUNCTION IF EXISTS buscar_producto_similar(text, int);

-- 6) Enum ya sin columnas ni funciones que lo referencien --------------
DROP TYPE public.categoria_producto;

CREATE OR REPLACE FUNCTION buscar_producto_similar(texto_busqueda TEXT, limite INT DEFAULT 6)
RETURNS TABLE (
    origen           TEXT,           -- 'propio' | 'sepa'
    id               uuid,           -- id en productos_base si origen='propio'; NULL si 'sepa'
    codigo_barras    text,
    nombre           text,
    marca            text,
    categoria_id     uuid,
    categoria_nombre text,
    categoria_icono  text,
    unidad_medida    text,
    similitud        REAL
) AS $$
    SELECT 'propio' AS origen, p.id, p.codigo_barras, p.nombre, p.marca,
           c.id AS categoria_id, c.nombre AS categoria_nombre, c.icono AS categoria_icono,
           p.unidad_medida,
           public.similarity(inmutable_unaccent(lower(p.nombre)), inmutable_unaccent(lower(texto_busqueda))) AS similitud
    FROM productos_base p
    JOIN categorias c ON c.id = p.categoria_id
    WHERE inmutable_unaccent(lower(p.nombre)) OPERATOR(public.%) inmutable_unaccent(lower(texto_busqueda))

    UNION ALL

    -- LEFT JOIN a propósito: una sugerencia SEPA puede no tener
    -- categoría sugerida (categoria_sugerida_id nulo); el frontend
    -- tiene que tolerar categoria_id/categoria_nombre/categoria_icono
    -- en null para este caso.
    SELECT 'sepa' AS origen, NULL::uuid AS id, s.codigo_barras, s.nombre_sepa AS nombre, s.marca,
           c.id AS categoria_id, c.nombre AS categoria_nombre, c.icono AS categoria_icono,
           NULL::text AS unidad_medida,
           public.similarity(inmutable_unaccent(lower(s.nombre_sepa)), inmutable_unaccent(lower(texto_busqueda))) AS similitud
    FROM catalogo_sepa_ref s
    LEFT JOIN categorias c ON c.id = s.categoria_sugerida_id
    WHERE inmutable_unaccent(lower(s.nombre_sepa)) OPERATOR(public.%) inmutable_unaccent(lower(texto_busqueda))
      AND NOT EXISTS (
          SELECT 1 FROM productos_base p2 WHERE p2.codigo_barras = s.codigo_barras
      )

    ORDER BY similitud DESC
    LIMIT limite;
$$ LANGUAGE sql STABLE SET search_path = public;
