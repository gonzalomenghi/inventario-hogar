-- ============================================================
-- buscar_producto_similar: agrega id/unidad_medida al resultado
--
-- La versión original (20260822161157) no devolvía el id de
-- productos_base para los matches con origen='propio', así que el
-- frontend no tenía forma de saber a qué producto agregar en
-- inventario_hogar sin repetir la búsqueda por nombre (impreciso).
-- Para 'sepa' el id queda NULL: todavía no existe en productos_base,
-- hay que crearlo si el usuario elige esa sugerencia.
--
-- CREATE OR REPLACE no permite cambiar la lista de columnas de
-- retorno de una función que devuelve tabla, así que hace falta el
-- DROP explícito primero.
-- ============================================================

DROP FUNCTION IF EXISTS buscar_producto_similar(text, int);

CREATE OR REPLACE FUNCTION buscar_producto_similar(texto_busqueda TEXT, limite INT DEFAULT 6)
RETURNS TABLE (
    origen         TEXT,           -- 'propio' | 'sepa'
    id             uuid,           -- id en productos_base si origen='propio'; NULL si 'sepa'
    codigo_barras  text,
    nombre         text,
    marca          text,
    categoria      categoria_producto,
    unidad_medida  text,
    similitud      REAL
) AS $$
    SELECT 'propio' AS origen, p.id, p.codigo_barras, p.nombre, p.marca, p.categoria,
           p.unidad_medida,
           public.similarity(inmutable_unaccent(lower(p.nombre)), inmutable_unaccent(lower(texto_busqueda))) AS similitud
    FROM productos_base p
    WHERE inmutable_unaccent(lower(p.nombre)) OPERATOR(public.%) inmutable_unaccent(lower(texto_busqueda))

    UNION ALL

    SELECT 'sepa' AS origen, NULL::uuid AS id, s.codigo_barras, s.nombre_sepa AS nombre, s.marca, s.categoria_sugerida AS categoria,
           NULL::text AS unidad_medida,
           public.similarity(inmutable_unaccent(lower(s.nombre_sepa)), inmutable_unaccent(lower(texto_busqueda))) AS similitud
    FROM catalogo_sepa_ref s
    WHERE inmutable_unaccent(lower(s.nombre_sepa)) OPERATOR(public.%) inmutable_unaccent(lower(texto_busqueda))
      AND NOT EXISTS (
          SELECT 1 FROM productos_base p2 WHERE p2.codigo_barras = s.codigo_barras
      )

    ORDER BY similitud DESC
    LIMIT limite;
$$ LANGUAGE sql STABLE SET search_path = public;
