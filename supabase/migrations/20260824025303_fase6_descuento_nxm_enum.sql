-- Fase 6: generaliza 3x2/4x3 (y cualquier "llevá N, pagá N-1" futuro) en un
-- solo valor de enum nuevo en vez de agregar uno por combinación. El '2x1'
-- existente se deja intacto (no se toca lo que ya funciona/tiene histórico).
--
-- ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción en la que
-- se agrega el valor nuevo — por eso esta migración va sola, separada de la
-- que actualiza la función/trigger que lo va a usar (ver la siguiente).
ALTER TYPE public.tipo_descuento ADD VALUE 'nxm';
