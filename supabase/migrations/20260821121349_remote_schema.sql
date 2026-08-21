drop extension if exists "pg_net";

create type "public"."categoria_producto" as enum ('alimentos', 'higiene', 'limpieza');

create type "public"."estado_lista" as enum ('activa', 'completada', 'cancelada');

create type "public"."fuente_precio" as enum ('manual', 'ocr_ticket', 'lista_compra');

create type "public"."tipo_descuento" as enum ('ninguno', '2x1', 'descuento_2da_unidad', 'porcentaje', 'monto_fijo');


  create table "public"."detalle_lista" (
    "id" uuid not null default gen_random_uuid(),
    "lista_id" uuid not null,
    "producto_id" uuid not null,
    "cantidad_solicitada" numeric(10,2) not null default 1,
    "comprado" boolean not null default false,
    "cantidad_comprada" numeric(10,2),
    "precio_unitario" numeric(10,2),
    "tipo_descuento" public.tipo_descuento not null default 'ninguno'::public.tipo_descuento,
    "valor_descuento" numeric(10,2),
    "precio_final" numeric(10,2),
    "supermercado_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."detalle_lista" enable row level security;


  create table "public"."inventario_hogar" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "producto_id" uuid not null,
    "cantidad_actual" numeric(10,2) not null default 0,
    "stock_minimo" numeric(10,2) not null default 1,
    "unidad_medida" text not null default 'unidad'::text,
    "fecha_vencimiento" date,
    "estado_stock" text generated always as (
CASE
    WHEN (cantidad_actual <= (0)::numeric) THEN 'rojo'::text
    WHEN (cantidad_actual <= stock_minimo) THEN 'amarillo'::text
    ELSE 'verde'::text
END) stored,
    "updated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."inventario_hogar" enable row level security;


  create table "public"."listas_compra" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "nombre" text not null default 'Lista de compras'::text,
    "estado" public.estado_lista not null default 'activa'::public.estado_lista,
    "supermercado_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone
      );


alter table "public"."listas_compra" enable row level security;


  create table "public"."precios_historico" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "producto_id" uuid not null,
    "supermercado_id" uuid,
    "precio" numeric(10,2) not null,
    "tipo_descuento" public.tipo_descuento not null default 'ninguno'::public.tipo_descuento,
    "valor_descuento" numeric(10,2),
    "precio_final" numeric(10,2) not null,
    "fuente" public.fuente_precio not null default 'manual'::public.fuente_precio,
    "fecha_registro" timestamp with time zone not null default now()
      );


alter table "public"."precios_historico" enable row level security;


  create table "public"."productos_base" (
    "id" uuid not null default gen_random_uuid(),
    "nombre" text not null,
    "categoria" public.categoria_producto not null,
    "unidad_medida" text not null default 'unidad'::text,
    "codigo_barras" text,
    "imagen_url" text,
    "marca" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."productos_base" enable row level security;


  create table "public"."supermercados" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "nombre" text not null,
    "direccion" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."supermercados" enable row level security;

CREATE UNIQUE INDEX detalle_lista_pkey ON public.detalle_lista USING btree (id);

CREATE INDEX idx_detalle_lista_lista ON public.detalle_lista USING btree (lista_id);

CREATE INDEX idx_inventario_estado ON public.inventario_hogar USING btree (estado_stock);

CREATE INDEX idx_inventario_user ON public.inventario_hogar USING btree (user_id);

CREATE INDEX idx_listas_user_estado ON public.listas_compra USING btree (user_id, estado);

CREATE INDEX idx_precios_producto_fecha ON public.precios_historico USING btree (producto_id, fecha_registro DESC);

CREATE INDEX idx_precios_user ON public.precios_historico USING btree (user_id);

CREATE INDEX idx_productos_base_categoria ON public.productos_base USING btree (categoria);

CREATE INDEX idx_productos_base_codigo_barras ON public.productos_base USING btree (codigo_barras);

CREATE UNIQUE INDEX inventario_hogar_pkey ON public.inventario_hogar USING btree (id);

CREATE UNIQUE INDEX inventario_hogar_user_id_producto_id_key ON public.inventario_hogar USING btree (user_id, producto_id);

CREATE UNIQUE INDEX listas_compra_pkey ON public.listas_compra USING btree (id);

CREATE UNIQUE INDEX precios_historico_pkey ON public.precios_historico USING btree (id);

CREATE UNIQUE INDEX productos_base_codigo_barras_key ON public.productos_base USING btree (codigo_barras);

CREATE UNIQUE INDEX productos_base_pkey ON public.productos_base USING btree (id);

CREATE UNIQUE INDEX supermercados_pkey ON public.supermercados USING btree (id);

CREATE UNIQUE INDEX supermercados_user_id_nombre_key ON public.supermercados USING btree (user_id, nombre);

alter table "public"."detalle_lista" add constraint "detalle_lista_pkey" PRIMARY KEY using index "detalle_lista_pkey";

alter table "public"."inventario_hogar" add constraint "inventario_hogar_pkey" PRIMARY KEY using index "inventario_hogar_pkey";

alter table "public"."listas_compra" add constraint "listas_compra_pkey" PRIMARY KEY using index "listas_compra_pkey";

alter table "public"."precios_historico" add constraint "precios_historico_pkey" PRIMARY KEY using index "precios_historico_pkey";

alter table "public"."productos_base" add constraint "productos_base_pkey" PRIMARY KEY using index "productos_base_pkey";

alter table "public"."supermercados" add constraint "supermercados_pkey" PRIMARY KEY using index "supermercados_pkey";

alter table "public"."detalle_lista" add constraint "detalle_lista_lista_id_fkey" FOREIGN KEY (lista_id) REFERENCES public.listas_compra(id) ON DELETE CASCADE not valid;

alter table "public"."detalle_lista" validate constraint "detalle_lista_lista_id_fkey";

alter table "public"."detalle_lista" add constraint "detalle_lista_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos_base(id) ON DELETE RESTRICT not valid;

alter table "public"."detalle_lista" validate constraint "detalle_lista_producto_id_fkey";

alter table "public"."detalle_lista" add constraint "detalle_lista_supermercado_id_fkey" FOREIGN KEY (supermercado_id) REFERENCES public.supermercados(id) ON DELETE SET NULL not valid;

alter table "public"."detalle_lista" validate constraint "detalle_lista_supermercado_id_fkey";

alter table "public"."inventario_hogar" add constraint "inventario_hogar_cantidad_actual_check" CHECK ((cantidad_actual >= (0)::numeric)) not valid;

alter table "public"."inventario_hogar" validate constraint "inventario_hogar_cantidad_actual_check";

alter table "public"."inventario_hogar" add constraint "inventario_hogar_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos_base(id) ON DELETE RESTRICT not valid;

alter table "public"."inventario_hogar" validate constraint "inventario_hogar_producto_id_fkey";

alter table "public"."inventario_hogar" add constraint "inventario_hogar_stock_minimo_check" CHECK ((stock_minimo >= (0)::numeric)) not valid;

alter table "public"."inventario_hogar" validate constraint "inventario_hogar_stock_minimo_check";

alter table "public"."inventario_hogar" add constraint "inventario_hogar_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."inventario_hogar" validate constraint "inventario_hogar_user_id_fkey";

alter table "public"."inventario_hogar" add constraint "inventario_hogar_user_id_producto_id_key" UNIQUE using index "inventario_hogar_user_id_producto_id_key";

alter table "public"."listas_compra" add constraint "listas_compra_supermercado_id_fkey" FOREIGN KEY (supermercado_id) REFERENCES public.supermercados(id) ON DELETE SET NULL not valid;

alter table "public"."listas_compra" validate constraint "listas_compra_supermercado_id_fkey";

alter table "public"."listas_compra" add constraint "listas_compra_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."listas_compra" validate constraint "listas_compra_user_id_fkey";

alter table "public"."precios_historico" add constraint "precios_historico_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos_base(id) ON DELETE CASCADE not valid;

alter table "public"."precios_historico" validate constraint "precios_historico_producto_id_fkey";

alter table "public"."precios_historico" add constraint "precios_historico_supermercado_id_fkey" FOREIGN KEY (supermercado_id) REFERENCES public.supermercados(id) ON DELETE SET NULL not valid;

alter table "public"."precios_historico" validate constraint "precios_historico_supermercado_id_fkey";

alter table "public"."precios_historico" add constraint "precios_historico_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."precios_historico" validate constraint "precios_historico_user_id_fkey";

alter table "public"."productos_base" add constraint "productos_base_codigo_barras_key" UNIQUE using index "productos_base_codigo_barras_key";

alter table "public"."supermercados" add constraint "supermercados_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."supermercados" validate constraint "supermercados_user_id_fkey";

alter table "public"."supermercados" add constraint "supermercados_user_id_nombre_key" UNIQUE using index "supermercados_user_id_nombre_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.fn_comprar_item_lista()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
    v_user_id           uuid;
    v_cantidad           numeric(10,2);
    v_precio_final        numeric(10,2);
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
            v_precio_final := case new.tipo_descuento
                when 'porcentaje' then
                    new.precio_unitario * (1 - coalesce(new.valor_descuento, 0) / 100.0)
                when 'monto_fijo' then
                    greatest(new.precio_unitario - coalesce(new.valor_descuento, 0), 0)
                when '2x1' then
                    new.precio_unitario * 0.5
                when 'descuento_2da_unidad' then
                    new.precio_unitario * (1 - coalesce(new.valor_descuento, 0) / 200.0) -- desc. aplica solo a la 2da unidad
                else
                    new.precio_unitario
            end;
            new.precio_final := round(v_precio_final, 2);
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$
;

grant delete on table "public"."detalle_lista" to "anon";

grant insert on table "public"."detalle_lista" to "anon";

grant references on table "public"."detalle_lista" to "anon";

grant select on table "public"."detalle_lista" to "anon";

grant trigger on table "public"."detalle_lista" to "anon";

grant truncate on table "public"."detalle_lista" to "anon";

grant update on table "public"."detalle_lista" to "anon";

grant delete on table "public"."detalle_lista" to "authenticated";

grant insert on table "public"."detalle_lista" to "authenticated";

grant references on table "public"."detalle_lista" to "authenticated";

grant select on table "public"."detalle_lista" to "authenticated";

grant trigger on table "public"."detalle_lista" to "authenticated";

grant truncate on table "public"."detalle_lista" to "authenticated";

grant update on table "public"."detalle_lista" to "authenticated";

grant delete on table "public"."detalle_lista" to "service_role";

grant insert on table "public"."detalle_lista" to "service_role";

grant references on table "public"."detalle_lista" to "service_role";

grant select on table "public"."detalle_lista" to "service_role";

grant trigger on table "public"."detalle_lista" to "service_role";

grant truncate on table "public"."detalle_lista" to "service_role";

grant update on table "public"."detalle_lista" to "service_role";

grant delete on table "public"."inventario_hogar" to "anon";

grant insert on table "public"."inventario_hogar" to "anon";

grant references on table "public"."inventario_hogar" to "anon";

grant select on table "public"."inventario_hogar" to "anon";

grant trigger on table "public"."inventario_hogar" to "anon";

grant truncate on table "public"."inventario_hogar" to "anon";

grant update on table "public"."inventario_hogar" to "anon";

grant delete on table "public"."inventario_hogar" to "authenticated";

grant insert on table "public"."inventario_hogar" to "authenticated";

grant references on table "public"."inventario_hogar" to "authenticated";

grant select on table "public"."inventario_hogar" to "authenticated";

grant trigger on table "public"."inventario_hogar" to "authenticated";

grant truncate on table "public"."inventario_hogar" to "authenticated";

grant update on table "public"."inventario_hogar" to "authenticated";

grant delete on table "public"."inventario_hogar" to "service_role";

grant insert on table "public"."inventario_hogar" to "service_role";

grant references on table "public"."inventario_hogar" to "service_role";

grant select on table "public"."inventario_hogar" to "service_role";

grant trigger on table "public"."inventario_hogar" to "service_role";

grant truncate on table "public"."inventario_hogar" to "service_role";

grant update on table "public"."inventario_hogar" to "service_role";

grant delete on table "public"."listas_compra" to "anon";

grant insert on table "public"."listas_compra" to "anon";

grant references on table "public"."listas_compra" to "anon";

grant select on table "public"."listas_compra" to "anon";

grant trigger on table "public"."listas_compra" to "anon";

grant truncate on table "public"."listas_compra" to "anon";

grant update on table "public"."listas_compra" to "anon";

grant delete on table "public"."listas_compra" to "authenticated";

grant insert on table "public"."listas_compra" to "authenticated";

grant references on table "public"."listas_compra" to "authenticated";

grant select on table "public"."listas_compra" to "authenticated";

grant trigger on table "public"."listas_compra" to "authenticated";

grant truncate on table "public"."listas_compra" to "authenticated";

grant update on table "public"."listas_compra" to "authenticated";

grant delete on table "public"."listas_compra" to "service_role";

grant insert on table "public"."listas_compra" to "service_role";

grant references on table "public"."listas_compra" to "service_role";

grant select on table "public"."listas_compra" to "service_role";

grant trigger on table "public"."listas_compra" to "service_role";

grant truncate on table "public"."listas_compra" to "service_role";

grant update on table "public"."listas_compra" to "service_role";

grant delete on table "public"."precios_historico" to "anon";

grant insert on table "public"."precios_historico" to "anon";

grant references on table "public"."precios_historico" to "anon";

grant select on table "public"."precios_historico" to "anon";

grant trigger on table "public"."precios_historico" to "anon";

grant truncate on table "public"."precios_historico" to "anon";

grant update on table "public"."precios_historico" to "anon";

grant delete on table "public"."precios_historico" to "authenticated";

grant insert on table "public"."precios_historico" to "authenticated";

grant references on table "public"."precios_historico" to "authenticated";

grant select on table "public"."precios_historico" to "authenticated";

grant trigger on table "public"."precios_historico" to "authenticated";

grant truncate on table "public"."precios_historico" to "authenticated";

grant update on table "public"."precios_historico" to "authenticated";

grant delete on table "public"."precios_historico" to "service_role";

grant insert on table "public"."precios_historico" to "service_role";

grant references on table "public"."precios_historico" to "service_role";

grant select on table "public"."precios_historico" to "service_role";

grant trigger on table "public"."precios_historico" to "service_role";

grant truncate on table "public"."precios_historico" to "service_role";

grant update on table "public"."precios_historico" to "service_role";

grant delete on table "public"."productos_base" to "anon";

grant insert on table "public"."productos_base" to "anon";

grant references on table "public"."productos_base" to "anon";

grant select on table "public"."productos_base" to "anon";

grant trigger on table "public"."productos_base" to "anon";

grant truncate on table "public"."productos_base" to "anon";

grant update on table "public"."productos_base" to "anon";

grant delete on table "public"."productos_base" to "authenticated";

grant insert on table "public"."productos_base" to "authenticated";

grant references on table "public"."productos_base" to "authenticated";

grant select on table "public"."productos_base" to "authenticated";

grant trigger on table "public"."productos_base" to "authenticated";

grant truncate on table "public"."productos_base" to "authenticated";

grant update on table "public"."productos_base" to "authenticated";

grant delete on table "public"."productos_base" to "service_role";

grant insert on table "public"."productos_base" to "service_role";

grant references on table "public"."productos_base" to "service_role";

grant select on table "public"."productos_base" to "service_role";

grant trigger on table "public"."productos_base" to "service_role";

grant truncate on table "public"."productos_base" to "service_role";

grant update on table "public"."productos_base" to "service_role";

grant delete on table "public"."supermercados" to "anon";

grant insert on table "public"."supermercados" to "anon";

grant references on table "public"."supermercados" to "anon";

grant select on table "public"."supermercados" to "anon";

grant trigger on table "public"."supermercados" to "anon";

grant truncate on table "public"."supermercados" to "anon";

grant update on table "public"."supermercados" to "anon";

grant delete on table "public"."supermercados" to "authenticated";

grant insert on table "public"."supermercados" to "authenticated";

grant references on table "public"."supermercados" to "authenticated";

grant select on table "public"."supermercados" to "authenticated";

grant trigger on table "public"."supermercados" to "authenticated";

grant truncate on table "public"."supermercados" to "authenticated";

grant update on table "public"."supermercados" to "authenticated";

grant delete on table "public"."supermercados" to "service_role";

grant insert on table "public"."supermercados" to "service_role";

grant references on table "public"."supermercados" to "service_role";

grant select on table "public"."supermercados" to "service_role";

grant trigger on table "public"."supermercados" to "service_role";

grant truncate on table "public"."supermercados" to "service_role";

grant update on table "public"."supermercados" to "service_role";


  create policy "usuarios ven sus propios detalles de lista"
  on "public"."detalle_lista"
  as permissive
  for all
  to public
using ((auth.uid() = ( SELECT listas_compra.user_id
   FROM public.listas_compra
  WHERE (listas_compra.id = detalle_lista.lista_id))))
with check ((auth.uid() = ( SELECT listas_compra.user_id
   FROM public.listas_compra
  WHERE (listas_compra.id = detalle_lista.lista_id))));



  create policy "usuarios ven su propio inventario"
  on "public"."inventario_hogar"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "usuarios ven sus propias listas"
  on "public"."listas_compra"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "usuarios ven su propio historico de precios"
  on "public"."precios_historico"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "lectura publica de catalogo"
  on "public"."productos_base"
  as permissive
  for select
  to public
using (true);



  create policy "usuarios autenticados pueden crear productos"
  on "public"."productos_base"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "usuarios ven sus propios supermercados"
  on "public"."supermercados"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


CREATE TRIGGER trg_comprar_item_lista BEFORE UPDATE ON public.detalle_lista FOR EACH ROW EXECUTE FUNCTION public.fn_comprar_item_lista();

CREATE TRIGGER trg_detalle_lista_updated_at BEFORE UPDATE ON public.detalle_lista FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_inventario_updated_at BEFORE UPDATE ON public.inventario_hogar FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


