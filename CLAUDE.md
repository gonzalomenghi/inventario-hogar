# CLAUDE.md — Inventario del Hogar & Lista de Compras

Contexto persistente del proyecto para que Claude Code lo lea al abrir esta carpeta.
Este documento resume las decisiones ya tomadas. Actualizalo a medida que avancen las fases.

## 1. Qué es este proyecto

App web/mobile para:
- Gestionar el inventario del hogar (alimentos, higiene, limpieza) con mínimo esfuerzo de carga.
- Generar listas de compra automáticamente según lo que falta.
- Registrar precios y descuentos del supermercado (manual y, a futuro, vía OCR de tickets) para optimizar el gasto mensual.

**Principio rector del producto:** máxima simplicidad visual, mínima carga manual. Toda lógica de negocio (semáforo de stock, cálculo de precio con descuento, actualización de inventario al comprar) vive en el backend (Supabase/Postgres), no en el frontend.

## 2. Stack

- **Backend:** Supabase (PostgreSQL + Auth + RLS + Triggers + Realtime).
- **Frontend:** React Native + Expo (mobile-first, corre también en web).
- **Lenguaje:** TypeScript en todo el frontend.
- **Estado/datos:** hooks propios sobre `@supabase/supabase-js` con Realtime, sin librería de estado global por ahora (evaluar React Query si crece la complejidad de cache).

## 3. Fase 1 — Modelado de datos (COMPLETA)

Ubicación: `supabase/migrations/` (formato de migraciones de Supabase CLI, no un dump único). Proyecto linkeado vía `supabase link --project-ref qktpohqtwyvwypgohyda`. El proyecto tiene la integración GitHub↔Supabase activa (Settings → Integrations) con **auto-deploy a producción en merges a `master`** apuntando a esta misma carpeta — cualquier migración nueva que se agregue a `supabase/migrations/` y se mergee a `master` se aplica sola a la base real. Para agregar cambios de schema a futuro: escribir la migración (`supabase migration new nombre`) o seguir usando `supabase db pull` después de iterar en el SQL Editor, revisar el diff generado, y commitear.

### Tablas
- **`productos_base`**: catálogo maestro compartido entre usuarios (nombre, `categoria` enum: `alimentos`/`higiene`/`limpieza`, `codigo_barras`, `unidad_medida`). Lectura pública para autenticados, insert abierto a cualquier usuario autenticado (MVP; a futuro considerar moderación).
- **`supermercados`**: por usuario (`user_id`, `nombre`, `direccion`).
- **`inventario_hogar`**: stock por usuario y producto. Campo clave: `estado_stock` es una **columna generada** (`GENERATED ALWAYS AS ... STORED`) que calcula `rojo`/`amarillo`/`verde` comparando `cantidad_actual` vs `stock_minimo`. No recalcular esto en el frontend, nunca.
- **`listas_compra`**: cabecera de lista (`estado` enum: `activa`/`completada`/`cancelada`, `supermercado_id` opcional).
- **`detalle_lista`**: ítems de una lista (`comprado` boolean, `precio_unitario`, `tipo_descuento` enum: `ninguno`/`2x1`/`descuento_2da_unidad`/`porcentaje`/`monto_fijo`, `valor_descuento`, `precio_final`).
- **`precios_historico`**: log de precios por producto/supermercado, con `fuente` enum (`manual`/`ocr_ticket`/`lista_compra`) para trazabilidad.

### Trigger de negocio central: `fn_comprar_item_lista`
Se dispara en `BEFORE UPDATE` de `detalle_lista` cuando `comprado` pasa de `false` a `true`. En una sola operación:
1. Calcula `precio_final` según `tipo_descuento` (incluye lógica real de 2x1 y descuento en 2da unidad).
2. Hace **upsert** en `inventario_hogar` (crea el registro si no existía, o incrementa `cantidad_actual`).
3. Inserta el registro correspondiente en `precios_historico` (solo si se cargó `precio_unitario`).

**Importante:** toda la lógica de "comprar un ítem actualiza stock + guarda precio" está en este trigger, no debe reimplementarse en el frontend.

### RLS
Todas las tablas de usuario (`inventario_hogar`, `listas_compra`, `detalle_lista`, `precios_historico`, `supermercados`) tienen RLS activo con policy `auth.uid() = user_id` (o vía join a `listas_compra` en el caso de `detalle_lista`). `productos_base` es de lectura pública.

**Nota de testing:** desde el SQL Editor de Supabase, `auth.uid()` devuelve `null` porque corre como `service_role`. Para probar el flujo con RLS real hay que hacerlo logueado desde el frontend.

### Matching difuso de productos (COMPLETO, mergeado a master y deployado)
Migraciones `supabase/migrations/2026082216*_matching_productos*.sql`, aditivas puras (no tocan tablas existentes). Confirmado aplicado en el proyecto real (`supabase migration list` con remote timestamp poblado, `buscar_producto_similar` responde en producción):
- **`catalogo_sepa_ref`**: diccionario de referencia (EAN, nombre, marca, categoría sugerida) sincronizado periódicamente desde el dataset SEPA/Precios Claros (datos.produccion.gob.ar/dataset/sepa-precios). RLS con lectura pública; solo la escribe el proceso de sync (`service_role`).
- **`buscar_producto_similar(texto_busqueda, limite)`**: búsqueda difusa (`pg_trgm` + `unaccent`) que devuelve primero matches en `productos_base` propio (con `id` real, listo para usar) y, si no hay, sugerencias de `catalogo_sepa_ref` (`id` null — todavía no existen en el catálogo propio).
- **`hooks/useBuscarProductoSimilar.ts`**: wrapper del RPC con debounce (300ms). `screens/AgregarProductoModal.tsx` lo usa en el paso de búsqueda: un resultado `origen: 'propio'` se agrega directo a `inventario_hogar`; uno `origen: 'sepa'` prellena el formulario de "crear nuevo" (categoría/marca/código/unidad) en vez de agregarse directo, porque hay que crearlo en `productos_base` primero.
- **`types/database.types.ts`**: ya regenerado real (`supabase gen types typescript`) post-deploy, sin partes a mano.
- **3 bugs reales encontrados y resueltos, todos validados contra una base local en Docker (`supabase start` + inserts + `db query`), no solo "aplicó sin error":**
  1. `unaccent()` es `STABLE` no `IMMUTABLE` → no se puede usar directo en un índice funcional. Wrapper `inmutable_unaccent()`.
  2. Un `SET search_path` a nivel de archivo de migración **no se sostiene de forma confiable entre statements** en el runner de la CLI (cada DDL/función/índice resuelve por su lado) — todo quedó calificado explícito con `public.` (`OPERATOR(public.%)`, `public.gin_trgm_ops`) en vez de depender de él.
  3. Faltaban los `GRANT SELECT` a `anon`/`authenticated` sobre `catalogo_sepa_ref` — RLS controla acceso por fila, pero sin el grant de tabla Postgres tira `permission denied` antes de siquiera evaluar las policies. Ver `20260822164109_matching_productos_grants.sql`.
- **Pendiente real:** `supabase/functions/sync-catalogo-sepa/index.ts` es un stub (501, sin implementar) — falta el fetch/parseo del dataset SEPA y la definición de cómo dispararlo periódicamente (`pg_cron`+`pg_net` nativo de Supabase, o cron externo tipo GitHub Actions). **Bloqueado**: `datos.produccion.gob.ar` y el mirror `datos.gob.ar` estaban inalcanzables (connection refused / 502) la última vez que se intentó confirmar la estructura real del dataset — no armar el parser a ciegas, retomar cuando el sitio responda.

## 4. Fase 2 — Frontend (EN CURSO)

Archivos ya creados (en las carpetas correspondientes del proyecto Expo):
- `lib/supabase.ts` — cliente único, con `AsyncStorage` para persistir sesión. Credenciales vía `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `.env` (ver `.env.example`), nunca hardcodeadas.
- `types/database.types.ts` — generado con `supabase gen types typescript --project-id qktpohqtwyvwypgohyda`, más alias de conveniencia a mano al final del archivo (`InventarioItem`, `DetalleListaItem`, etc.) que hay que mantener si cambia el schema. Volver a correr el comando después de cualquier migración nueva.
- `hooks/useAuth.ts` + `screens/AuthScreen.tsx` — login/registro por email y contraseña con Supabase Auth. `src/app/_layout.tsx` gatea toda la app: sin sesión muestra `AuthScreen`, con sesión muestra `AppTabs`. Cerrar sesión está en la tab Historial (temporal, hasta que exista una pantalla de cuenta dedicada).
- `hooks/useInventario.ts` — fetch de inventario + suscripción Realtime + `ajustarCantidad` con actualización optimista (+/- responde instantáneo en UI, confirma contra DB después, revierte si falla).
- `screens/InventarioScreen.tsx` — lista agrupada por categoría (`SectionList`), semáforo visual (dot de color), controles +/- por ítem, FAB "+" que abre `AgregarProductoModal`. **Nota:** el estado vacío (`items.length === 0`) se maneja con un `return` explícito antes del `SectionList`, no con su prop `ListEmptyComponent` — en web, con sesión real autenticada, `ListEmptyComponent` no llegaba a renderizar (pantalla en blanco) a pesar de que el fetch resolvía bien; no reproducido en RN puro, así que si se vuelve a tocar este componente, evitar depender de `ListEmptyComponent`.
- `screens/AgregarProductoModal.tsx` — bottom sheet: busca vía `useBuscarProductoSimilar` (RPC `buscar_producto_similar`, difusa) o crea un producto nuevo (categoría/unidad/marca/código de barras) y en el mismo paso lo agrega a `inventario_hogar` del usuario. Un resultado `origen: 'propio'` se agrega directo; uno `origen: 'sepa'` prellena el formulario de creación. Si el producto ya está en su inventario, el insert falla por la constraint única `(user_id, producto_id)` y se lo indica al usuario para que lo ajuste desde la lista en vez de duplicarlo.
- `screens/ModoSupermercadoScreen.tsx` — checklist en vivo sobre `detalle_lista` de una lista activa; al tildar un ítem, actualiza `comprado = true` (y opcionalmente `precio_unitario`), lo cual dispara `fn_comprar_item_lista` en el backend.
- Navegación: `src/app/index.tsx` (Inventario), `src/app/modo-supermercado.tsx` (resuelve la `lista_compra` activa del usuario y renderiza `ModoSupermercadoScreen`; si no hay ninguna, ofrece un botón "Crear lista de compras" que arma una lista nueva con los productos en rojo/amarillo del inventario — MVP manual hasta que exista la auto-generación de Fase 3, ver nota más abajo), `src/app/historial.tsx` (placeholder, Fase 5). Bottom tabs vía Expo Router (`src/components/app-tabs.tsx` nativo, `app-tabs.web.tsx` para web). `app.json` usa `web.output: "single"` (SPA sin SSR) porque el cliente de Supabase no es SSR-safe (`AsyncStorage` asume `window`, Realtime necesita WebSocket nativo).

### Pendiente en Fase 2
- [x] Navegación (bottom tabs: Inventario / Modo Supermercado / Historial) — Expo Router.
- [x] Variables de entorno: `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `.env`.
- [x] Pantalla de login/registro con Supabase Auth (email/contraseña).
- [x] Pantalla para dar de alta productos nuevos en `productos_base` + agregarlos a `inventario_hogar` (con búsqueda en el catálogo existente antes de crear uno nuevo, para evitar duplicados).
- [x] Creación de una `lista_compra` activa — botón en `src/app/modo-supermercado.tsx`, llama al RPC `fn_generar_lista_compra()` (ver Fase 3 más abajo).

**Fase 2 completa.** Falta solo lo marcado como pendiente real en la sección de matching difuso (sync de `catalogo_sepa_ref`, bloqueado externamente).

## 4.1 Fase 3 — Auto-generación de listas (COMPLETA, mergeada y deployada)

Migración `supabase/migrations/20260822205236_fase3_auto_generacion_listas.sql`. Tres funciones, no una Edge Function (más simple: es solo SQL disparado por `pg_cron`, no necesita runtime aparte):
- **`fn_generar_lista_compra_interna(p_user_id uuid)`**: la lógica real (arma `listas_compra` + `detalle_lista` desde `inventario_hogar` en rojo/amarillo; `cantidad_solicitada = max(stock_minimo - cantidad_actual, 1)`; si ya hay una lista activa, la devuelve en vez de duplicar). `SECURITY DEFINER`, **sin** `GRANT EXECUTE` a nadie — no se llama directo, solo internamente.
- **`fn_generar_lista_compra()`**: RPC pública que llama el frontend (`src/app/modo-supermercado.tsx`, botón "Crear lista de compras"). Usa `auth.uid()` adentro, nunca un `user_id` que mande el cliente. También es `SECURITY DEFINER` — **importante**: tuvo que serlo porque si es `SECURITY INVOKER` (default), el rol `authenticated` no tiene permiso para llamar a la función interna y todo falla con `permission denied for function fn_generar_lista_compra_interna` (encontrado y resuelto probando de verdad contra una base local, no evidente solo leyendo el código).
- **`fn_generar_listas_automaticas()`**: batch que recorre todos los usuarios con stock bajo sin lista activa y les genera una. La dispara `pg_cron` todos los días a las 08:00 UTC (05:00 ART) — job `generar-listas-automaticas-diario` (ver `cron.job` en la base). Tampoco expuesta por RPC.

El botón manual sigue disponible (llama el mismo RPC): sirve para generar/refrescar al toque sin esperar el schedule diario.

## 5. Roadmap completo (fases futuras)

1. ~~Fase 1 — Modelado de datos~~ ✅
2. ~~Fase 2 — Frontend base (Expo + Supabase)~~ ✅
3. ~~Fase 3 — Auto-generación de listas~~ ✅ (ver sección 4.1)
4. Fase 4 — OCR de tickets: Edge Function que recibe imagen → modelo de visión → JSON estructurado (ítems, precios, descuentos) → matching contra `productos_base` (por nombre + código de barras) → carga en `precios_historico` con `fuente = 'ocr_ticket'`.
5. Fase 5 — Dashboard de ahorro: vistas agregadas sobre `precios_historico` (gasto mensual, mejor supermercado por producto, tendencias de precio).
6. Fase 6 — Refinamiento UI/UX: diseño visual, microinteracciones, scanner de código de barras.

## 6. Convenciones del proyecto

- Todo el código de negocio pesado (cálculos, validaciones críticas) va en SQL/Postgres (funciones y triggers), no en el cliente.
- Nombres de tablas, columnas y enums en español, en `snake_case` (así se definieron desde la Fase 1 — mantener consistencia).
- Componentes y archivos de frontend en inglés/PascalCase siguiendo convención de React Native (`InventarioScreen.tsx`), pero el copy visible al usuario siempre en español.
- Antes de crear un producto nuevo en `productos_base`, buscar por nombre/código de barras para evitar duplicados en el catálogo compartido.

## 7. Cómo seguir trabajando

Al retomar el proyecto, decile a Claude Code en qué fase/tarea puntual seguís (por ejemplo: "seguimos con la navegación de la Fase 2" o "arranquemos la Fase 3"). Este archivo tiene el contexto de fondo; no hace falta repetirlo en cada prompt.