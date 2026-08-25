-- Fase 6: no tocar inventario_hogar/precios_historico hasta confirmar la
-- compra completa. Antes, cada tilde individual en Modo Supermercado ya
-- sumaba stock y guardaba el precio en el histórico — pero "en el
-- changuito" no es "ya lo compré": recién lo es al pagar en caja. El
-- inventario ahora se actualiza en un solo commit, disparado por un botón
-- nuevo ("Confirmar compra") una vez terminada toda la compra.
--
-- Esto simplifica fn_comprar_item_lista: ahora SOLO calcula/recalcula
-- precio_final en las transiciones de comprado, sin tocar otras tablas.
-- El commit real se movió a fn_confirmar_compra_lista, nueva, que procesa
-- de una vez todos los ítems tildados de la lista y la pasa a
-- 'completada'. Como consecuencia, ya no hace falta precio_historico_id
-- ni el trigger AFTER que se agregó en la migración anterior para
-- esquivar el choque de FK (ese choque solo existía porque el UPDATE de
-- detalle_lista podía disparar un DELETE en precios_historico en el medio
-- de la compra — ahora eso nunca pasa antes de confirmar).

DROP TRIGGER IF EXISTS trg_borrar_historico_al_revertir ON public.detalle_lista;
DROP FUNCTION IF EXISTS public.fn_borrar_historico_al_revertir();

ALTER TABLE public.detalle_lista DROP COLUMN IF EXISTS precio_historico_id;

CREATE OR REPLACE FUNCTION public.fn_comprar_item_lista()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    -- false -> true: solo calcular precio_final. Nada de efectos en otras
    -- tablas todavía (eso pasa recién en fn_confirmar_compra_lista).
    if new.comprado = true and (old.comprado is distinct from true) then
        if new.precio_unitario is not null then
            new.precio_final := public.fn_calcular_precio_final(
                new.precio_unitario, new.tipo_descuento, new.valor_descuento
            );
        end if;

    -- true -> false: revertir un tilde por error. Como todavía no se tocó
    -- inventario_hogar/precios_historico, alcanza con limpiar las
    -- columnas de "compra en curso".
    elsif new.comprado = false and old.comprado = true then
        new.cantidad_comprada := null;
        new.precio_final := null;

    -- Sigue comprado, pero se editó precio/descuento: recalcular
    -- precio_final. Todavía no hay fila de precios_historico que
    -- actualizar (esa recién se crea al confirmar la compra).
    elsif new.comprado = true and old.comprado = true and (
        new.precio_unitario is distinct from old.precio_unitario or
        new.tipo_descuento is distinct from old.tipo_descuento or
        new.valor_descuento is distinct from old.valor_descuento
    ) then
        if new.precio_unitario is not null then
            new.precio_final := public.fn_calcular_precio_final(
                new.precio_unitario, new.tipo_descuento, new.valor_descuento
            );
        else
            new.precio_final := null;
        end if;
    end if;

    return new;
end;
$function$;

-- Confirmar la compra completa: procesa de una sola vez TODOS los ítems
-- tildados ("en el changuito") de la lista — recién acá se suma a
-- inventario_hogar y se guarda precios_historico, y la lista pasa a
-- 'completada'. Los ítems que quedaron sin tildar se dejan como están:
-- no se compraron, no afectan nada (siguen en la lista, ya 'completada',
-- por si se quieren rescatar a mano más adelante).
-- SECURITY DEFINER + auth.uid() adentro, mismo patrón que
-- fn_generar_lista_compra: nunca confía en un user_id que mande el
-- cliente, y valida que la lista sea del usuario antes de tocar nada.
CREATE OR REPLACE FUNCTION public.fn_confirmar_compra_lista(p_lista_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
    v_user_id uuid;
    r record;
begin
    if auth.uid() is null then
        raise exception 'No autenticado';
    end if;

    select user_id into v_user_id
    from listas_compra
    where id = p_lista_id and user_id = auth.uid();

    if v_user_id is null then
        raise exception 'Lista no encontrada o no pertenece al usuario';
    end if;

    for r in
        select * from detalle_lista where lista_id = p_lista_id and comprado = true
    loop
        insert into inventario_hogar (user_id, producto_id, cantidad_actual, stock_minimo, unidad_medida)
        values (v_user_id, r.producto_id, coalesce(r.cantidad_comprada, r.cantidad_solicitada), 1, 'unidad')
        on conflict (user_id, producto_id)
        do update set
            cantidad_actual = inventario_hogar.cantidad_actual + excluded.cantidad_actual,
            updated_at = now();

        if r.precio_unitario is not null then
            insert into precios_historico (
                user_id, producto_id, supermercado_id, precio,
                tipo_descuento, valor_descuento, precio_final, fuente
            )
            values (
                v_user_id, r.producto_id, r.supermercado_id, r.precio_unitario,
                r.tipo_descuento, r.valor_descuento, r.precio_final, 'lista_compra'
            );
        end if;
    end loop;

    update listas_compra set estado = 'completada' where id = p_lista_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_confirmar_compra_lista(uuid) TO authenticated;
