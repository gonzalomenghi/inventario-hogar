-- Fase 6: total estimado de una lista de compra.
--
-- 1) Saca la fórmula de precio con descuento del trigger y la deja en una
--    función IMMUTABLE aparte (fn_calcular_precio_final) — la necesitamos en
--    dos lugares ahora (el trigger de compra Y la columna generada de abajo)
--    y no queremos dos copias de la misma lógica de negocio divergiendo.
-- 2) Agrega el caso 'nxm' ("llevá N, pagá N-1" — generaliza 3x2, 4x3 y
--    cualquier variante futura con el mismo patrón; N vive en
--    valor_descuento, reutilizando la columna existente).
-- 3) Agrega detalle_lista.precio_estimado, columna generada que aplica esa
--    misma fórmula ANTES de comprar (precio_final solo se completa recién al
--    tildar el ítem, vía el trigger). El frontend suma precio_final (ítems
--    ya comprados) o precio_estimado (pendientes) para mostrar el total
--    estimado de la lista sin reimplementar la fórmula de descuento en JS.
CREATE OR REPLACE FUNCTION public.fn_calcular_precio_final(
  p_precio_unitario numeric,
  p_tipo_descuento public.tipo_descuento,
  p_valor_descuento numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $function$
begin
  if p_precio_unitario is null then
    return null;
  end if;

  return round(
    case p_tipo_descuento
      when 'porcentaje' then
        p_precio_unitario * (1 - coalesce(p_valor_descuento, 0) / 100.0)
      when 'monto_fijo' then
        greatest(p_precio_unitario - coalesce(p_valor_descuento, 0), 0)
      when '2x1' then
        p_precio_unitario * 0.5
      when 'descuento_2da_unidad' then
        p_precio_unitario * (1 - coalesce(p_valor_descuento, 0) / 200.0) -- desc. aplica solo a la 2da unidad
      when 'nxm' then
        -- Llevá N pagá N-1: valor_descuento es la N. N<=1 no es una promo
        -- real (ni siquiera "llevá 1 pagá 0"), se ignora y no descuenta nada.
        case
          when coalesce(p_valor_descuento, 0) > 1 then
            p_precio_unitario * ((p_valor_descuento - 1) / p_valor_descuento)
          else
            p_precio_unitario
        end
      else
        p_precio_unitario
    end,
    2
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_calcular_precio_final(numeric, public.tipo_descuento, numeric)
  TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.fn_comprar_item_lista()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
    v_user_id           uuid;
    v_cantidad           numeric(10,2);
begin
    -- Solo actuar en la transición false -> true
    if new.comprado = true and (old.comprado is distinct from true) then

        -- Usuario dueño de la lista
        select user_id into v_user_id
        from listas_compra
        where id = new.lista_id;

        -- Cantidad efectiva comprada (si no se especifica, se usa la solicitada)
        v_cantidad := coalesce(new.cantidad_comprada, new.cantidad_solicitada);

        -- Calcular precio final si no vino calculado
        if new.precio_unitario is not null then
            new.precio_final := public.fn_calcular_precio_final(
                new.precio_unitario, new.tipo_descuento, new.valor_descuento
            );
        end if;

        -- 1) Upsert de inventario: crea el registro si no existe, o incrementa stock
        insert into inventario_hogar (user_id, producto_id, cantidad_actual, stock_minimo, unidad_medida)
        values (v_user_id, new.producto_id, v_cantidad, 1, 'unidad')
        on conflict (user_id, producto_id)
        do update set
            cantidad_actual = inventario_hogar.cantidad_actual + excluded.cantidad_actual,
            updated_at = now();

        -- 2) Registrar precio histórico (solo si se cargó un precio)
        if new.precio_unitario is not null then
            insert into precios_historico (
                user_id, producto_id, supermercado_id, precio,
                tipo_descuento, valor_descuento, precio_final, fuente
            )
            values (
                v_user_id, new.producto_id, new.supermercado_id, new.precio_unitario,
                new.tipo_descuento, new.valor_descuento, new.precio_final, 'lista_compra'
            );
        end if;
    end if;

    return new;
end;
$function$;

ALTER TABLE public.detalle_lista
  ADD COLUMN precio_estimado numeric(10,2) GENERATED ALWAYS AS (
    public.fn_calcular_precio_final(precio_unitario, tipo_descuento, valor_descuento)
  ) STORED;
