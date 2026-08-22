-- ============================================================
-- Fase 5 — Dashboard de ahorro
--
-- Vistas de solo lectura sobre precios_historico. security_invoker
-- hace que cada vista respete el RLS de la tabla de base con el rol
-- del que consulta (no del dueño de la vista) — sin esto, cualquier
-- usuario vería el histórico de precios de todos. Necesitan además el
-- GRANT explícito a "authenticated" aparte del RLS (mismo gotcha que
-- catalogo_sepa_ref en la migración de matching de productos: RLS
-- controla fila, GRANT controla si se puede tocar la tabla/vista).
-- ============================================================

-- Gasto total por mes (para el resumen "cuánto gastaste este mes").
CREATE VIEW vista_gasto_mensual
WITH (security_invoker = true) AS
SELECT
  user_id,
  date_trunc('month', fecha_registro) AS mes,
  sum(precio_final) AS gasto_total,
  count(*) AS cantidad_compras
FROM precios_historico
GROUP BY user_id, date_trunc('month', fecha_registro);

GRANT SELECT ON vista_gasto_mensual TO authenticated;

-- Mejor supermercado por producto: promedia lo pagado en cada
-- supermercado y se queda con el más barato por producto.
CREATE VIEW vista_mejor_supermercado_producto
WITH (security_invoker = true) AS
WITH promedios AS (
  SELECT
    ph.user_id,
    ph.producto_id,
    ph.supermercado_id,
    avg(ph.precio_final) AS precio_promedio
  FROM precios_historico ph
  WHERE ph.supermercado_id IS NOT NULL
  GROUP BY ph.user_id, ph.producto_id, ph.supermercado_id
)
SELECT DISTINCT ON (pr.user_id, pr.producto_id)
  pr.user_id,
  pr.producto_id,
  p.nombre AS producto_nombre,
  pr.supermercado_id,
  s.nombre AS supermercado_nombre,
  pr.precio_promedio
FROM promedios pr
JOIN productos_base p ON p.id = pr.producto_id
JOIN supermercados s ON s.id = pr.supermercado_id
ORDER BY pr.user_id, pr.producto_id, pr.precio_promedio ASC;

GRANT SELECT ON vista_mejor_supermercado_producto TO authenticated;

-- Histórico de precios por producto, ordenado — el cliente arma la
-- tendencia (último vs. anterior, delta %) agrupando por producto_id;
-- se resuelve mejor ahí que duplicando esa lógica en SQL.
CREATE VIEW vista_tendencia_precio
WITH (security_invoker = true) AS
SELECT
  ph.user_id,
  ph.producto_id,
  p.nombre AS producto_nombre,
  ph.precio_final,
  ph.fecha_registro,
  ph.supermercado_id
FROM precios_historico ph
JOIN productos_base p ON p.id = ph.producto_id
ORDER BY ph.producto_id, ph.fecha_registro;

GRANT SELECT ON vista_tendencia_precio TO authenticated;
