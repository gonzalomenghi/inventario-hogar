-- Fase 6: permitir deshacer un ítem marcado "comprado" por error, y editar
-- el precio real de un ítem ya comprado (antes quedaba fijo en lo que se
-- cargó al tildarlo, sin forma de corregirlo).
--
-- fn_comprar_item_lista solo reaccionaba a la transición false -> true.
-- Ahora reacciona a tres casos, todos disparados por el mismo trigger
-- BEFORE UPDATE ya existente:
--   1) false -> true: comprar (como antes), pero ahora guarda el id de la
--      fila de precios_historico que crea (detalle_lista.precio_historico_id)
--      para poder ubicarla con precisión más adelante.
--   2) true -> false: revertir — resta de inventario_hogar lo que se había
--      sumado, borra esa fila de precios_historico (si existía) y limpia
--      cantidad_comprada/precio_final/precio_historico_id.
--   3) true -> true con precio/descuento/supermercado editado: corregir —
--      recalcula precio_final y actualiza (no duplica) la fila de
--      precios_historico ya asociada.
ALTER TABLE public.detalle_lista
  ADD COLUMN precio_historico_id uuid REFERENCES public.precios_historico(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.fn_comprar_item_lista()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
    v_user_id           uuid;
    v_cantidad           numeric(10,2);
    v_historico_id       uuid;
begin
    select user_id into v_user_id
    from listas_compra
    where id = new.lista_id;

    -- 1) Transición false -> true: registrar la compra
    if new.comprado = true and (old.comprado is distinct from true) then
        v_cantidad := coalesce(new.cantidad_comprada, new.cantidad_solicitada);

        if new.precio_unitario is not null then
            new.precio_final := public.fn_calcular_precio_final(
                new.precio_unitario, new.tipo_descuento, new.valor_descuento
            );
        end if;

        insert into inventario_hogar (user_id, producto_id, cantidad_actual, stock_minimo, unidad_medida)
        values (v_user_id, new.producto_id, v_cantidad, 1, 'unidad')
        on conflict (user_id, producto_id)
        do update set
            cantidad_actual = inventario_hogar.cantidad_actual + excluded.cantidad_actual,
            updated_at = now();

        if new.precio_unitario is not null then
            insert into precios_historico (
                user_id, producto_id, supermercado_id, precio,
                tipo_descuento, valor_descuento, precio_final, fuente
            )
            values (
                v_user_id, new.producto_id, new.supermercado_id, new.precio_unitario,
                new.tipo_descuento, new.valor_descuento, new.precio_final, 'lista_compra'
            )
            returning id into v_historico_id;

            new.precio_historico_id := v_historico_id;
        end if;

    -- 2) Transición true -> false: deshacer una compra tildada por error.
    -- No toca cantidad_solicitada (sigue siendo la misma lista pendiente).
    -- El borrado de la fila de precios_historico NO va acá: dispararía la
    -- acción ON DELETE SET NULL de su FK contra esta misma fila de
    -- detalle_lista que todavía se está actualizando (BEFORE UPDATE), lo
    -- cual Postgres rechaza con "tuple to be updated was already modified
    -- by an operation triggered by the current command". Se resuelve en el
    -- trigger AFTER de abajo, cuando esta fila ya está committeada con
    -- precio_historico_id en null.
    elsif new.comprado = false and old.comprado = true then
        v_cantidad := coalesce(old.cantidad_comprada, old.cantidad_solicitada);

        update inventario_hogar
        set cantidad_actual = greatest(cantidad_actual - v_cantidad, 0),
            updated_at = now()
        where user_id = v_user_id and producto_id = old.producto_id;

        new.cantidad_comprada := null;
        new.precio_final := null;
        new.precio_historico_id := null;

    -- 3) Sigue comprado, pero se editó precio/descuento/supermercado: el
    -- usuario está corrigiendo el precio estimado por el real. Recalcula
    -- precio_final y actualiza (no duplica) el registro histórico.
    elsif new.comprado = true and old.comprado = true and (
        new.precio_unitario is distinct from old.precio_unitario or
        new.tipo_descuento is distinct from old.tipo_descuento or
        new.valor_descuento is distinct from old.valor_descuento or
        new.supermercado_id is distinct from old.supermercado_id
    ) then
        if new.precio_unitario is not null then
            new.precio_final := public.fn_calcular_precio_final(
                new.precio_unitario, new.tipo_descuento, new.valor_descuento
            );
        else
            new.precio_final := null;
        end if;

        if old.precio_historico_id is not null then
            update precios_historico
            set precio = new.precio_unitario,
                tipo_descuento = new.tipo_descuento,
                valor_descuento = new.valor_descuento,
                precio_final = new.precio_final,
                supermercado_id = new.supermercado_id
            where id = old.precio_historico_id;
        elsif new.precio_unitario is not null then
            -- Se había comprado sin precio cargado y recién ahora se carga uno.
            insert into precios_historico (
                user_id, producto_id, supermercado_id, precio,
                tipo_descuento, valor_descuento, precio_final, fuente
            )
            values (
                v_user_id, new.producto_id, new.supermercado_id, new.precio_unitario,
                new.tipo_descuento, new.valor_descuento, new.precio_final, 'lista_compra'
            )
            returning id into v_historico_id;

            new.precio_historico_id := v_historico_id;
        end if;
    end if;

    return new;
end;
$function$;

-- Complemento del caso 2 de arriba: borra la fila de precios_historico
-- recién después de que la fila de detalle_lista ya quedó committeada con
-- precio_historico_id en null, para no chocar con su propia FK.
CREATE OR REPLACE FUNCTION public.fn_borrar_historico_al_revertir()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    if new.comprado = false and old.comprado = true and old.precio_historico_id is not null then
        delete from precios_historico where id = old.precio_historico_id;
    end if;
    return null;
end;
$function$;

DROP TRIGGER IF EXISTS trg_borrar_historico_al_revertir ON public.detalle_lista;
CREATE TRIGGER trg_borrar_historico_al_revertir
AFTER UPDATE ON public.detalle_lista
FOR EACH ROW
EXECUTE FUNCTION public.fn_borrar_historico_al_revertir();
