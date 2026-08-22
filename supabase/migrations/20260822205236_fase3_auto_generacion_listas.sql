-- ============================================================
-- Fase 3 — Auto-generación de listas de compra
--
-- Formaliza en el backend lo que hasta ahora era lógica de cliente en
-- src/app/modo-supermercado.tsx (botón "Crear lista de compras"):
-- arma una lista_compra a partir de lo que está en rojo/amarillo en
-- inventario_hogar. Se programa con pg_cron para que corra sola todos
-- los días; el botón manual del cliente pasa a llamar el mismo RPC.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Implementación real. SECURITY DEFINER porque el job de cron corre sin
-- sesión de usuario (auth.uid() sería null) y necesita poder escribir
-- en nombre de cada usuario. NO exponerla directo por RPC: solo la
-- llaman las dos funciones públicas de abajo, que sí controlan quién
-- puede pedir la generación para quién.
CREATE OR REPLACE FUNCTION fn_generar_lista_compra_interna(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lista_id uuid;
BEGIN
  -- Ya tiene una lista activa: no duplicar, devolver esa.
  SELECT id INTO v_lista_id
  FROM listas_compra
  WHERE user_id = p_user_id AND estado = 'activa'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lista_id IS NOT NULL THEN
    RETURN v_lista_id;
  END IF;

  INSERT INTO listas_compra (user_id)
  VALUES (p_user_id)
  RETURNING id INTO v_lista_id;

  -- Comprar lo que falta para volver al mínimo, al menos 1 unidad.
  INSERT INTO detalle_lista (lista_id, producto_id, cantidad_solicitada)
  SELECT v_lista_id, producto_id, GREATEST(stock_minimo - cantidad_actual, 1)
  FROM inventario_hogar
  WHERE user_id = p_user_id
    AND estado_stock IN ('rojo', 'amarillo');

  RETURN v_lista_id;
END;
$$;

REVOKE ALL ON FUNCTION fn_generar_lista_compra_interna(uuid) FROM PUBLIC;

-- RPC pública: el cliente la llama para generar/reusar SU PROPIA lista
-- activa. SECURITY DEFINER porque necesita poder invocar la función
-- interna (SECURITY DEFINER también, sin EXECUTE para "authenticated" a
-- propósito) — con SECURITY INVOKER el rol del cliente no tiene permiso
-- para llamarla y esto falla con "permission denied". Sigue siendo
-- seguro: adentro SOLO usa auth.uid(), nunca un user_id que mande el
-- cliente, así que no se puede pedir la generación para otro usuario.
CREATE OR REPLACE FUNCTION fn_generar_lista_compra()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  RETURN fn_generar_lista_compra_interna(auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION fn_generar_lista_compra() TO authenticated;

-- Batch para el cron: recorre todos los usuarios con stock bajo que
-- todavía no tengan una lista activa, y les genera una. No expuesta por
-- RPC (solo la dispara el schedule de más abajo).
CREATE OR REPLACE FUNCTION fn_generar_listas_automaticas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT ih.user_id
    FROM inventario_hogar ih
    WHERE ih.estado_stock IN ('rojo', 'amarillo')
      AND NOT EXISTS (
        SELECT 1 FROM listas_compra lc
        WHERE lc.user_id = ih.user_id AND lc.estado = 'activa'
      )
  LOOP
    PERFORM fn_generar_lista_compra_interna(v_user_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION fn_generar_listas_automaticas() FROM PUBLIC;

-- 05:00 ART = 08:00 UTC (Argentina no tiene horario de verano, UTC-3
-- todo el año). cron.schedule con un nombre ya usado lo reprograma en
-- vez de duplicarlo, así que es seguro volver a correr esta migración.
SELECT cron.schedule(
  'generar-listas-automaticas-diario',
  '0 8 * * *',
  $$ SELECT fn_generar_listas_automaticas(); $$
);
