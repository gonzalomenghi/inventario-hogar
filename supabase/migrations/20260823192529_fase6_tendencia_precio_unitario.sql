-- ============================================================
-- vista_tendencia_precio: agregar precio_unitario (precios_historico.precio,
-- el monto antes de aplicar el descuento) además del ya existente
-- precio_final.
--
-- La tendencia de precio se venía calculando en el cliente comparando
-- precio_final entre compras consecutivas, pero eso mezcla el precio
-- real del producto con promociones puntuales (2x1, descuento de 2da
-- unidad, etc.) — una compra con descuento seguida de una sin descuento
-- se veía como un aumento de precio aunque el producto no haya cambiado.
-- El cliente pasa a comparar precio_unitario a precio_unitario, que es
-- lo que efectivamente cobra el producto sin el ruido de la promo.
--
-- CREATE OR REPLACE VIEW alcanza acá: solo se agrega una columna al
-- final de la lista, no se reordena/renombra/saca ninguna existente.
-- ============================================================

-- Los primeros 6 columnas mantienen el orden/nombre exacto de la vista
-- original: CREATE OR REPLACE VIEW no permite reordenar/renombrar
-- columnas existentes, solo agregar nuevas al final.
CREATE OR REPLACE VIEW vista_tendencia_precio
WITH (security_invoker = true) AS
SELECT
  ph.user_id,
  ph.producto_id,
  p.nombre AS producto_nombre,
  ph.precio_final,
  ph.fecha_registro,
  ph.supermercado_id,
  ph.precio AS precio_unitario
FROM precios_historico ph
JOIN productos_base p ON p.id = ph.producto_id
ORDER BY ph.producto_id, ph.fecha_registro;

GRANT SELECT ON vista_tendencia_precio TO authenticated;
