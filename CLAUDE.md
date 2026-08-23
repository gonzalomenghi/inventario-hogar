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
- **`productos_base`**: catálogo maestro compartido entre usuarios (nombre, `categoria_id` FK a `categorias`, `codigo_barras`, `unidad_medida`). Lectura pública para autenticados, insert y update abiertos a cualquier usuario autenticado (MVP; a futuro considerar moderación). **`categoria` era un enum fijo hasta la Fase 6** — ver sección 4.4, ahí está la tabla `categorias` real y por qué se migró.
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
- **Pendiente real:** `supabase/functions/sync-catalogo-sepa/index.ts` es un stub (501, sin implementar) — falta el fetch/parseo del dataset SEPA y la definición de cómo dispararlo periódicamente (`pg_cron`+`pg_net` nativo de Supabase, o cron externo tipo GitHub Actions). **Bloqueado**, pero con más info real que antes:
  - Dataset correcto: **"Precios Claros - Base SEPA"** (minorista), slug `precios-claros-base-sepa`. 7 ZIP fijos, uno por día de la semana (se sobrescriben semanalmente, no son archivos por fecha):
    `https://datos.produccion.gob.ar/dataset/6f47ec76-d1ce-4e34-a7e1-621fe9b1d0b5/resource/<id>/download/sepa_<dia>.zip` (lunes a domingo).
  - Estructura de campos documentada oficialmente en un PDF: "Anexo II de la Resolución Nº 678/2020" — **no confirmada todavía** (hay indicios sueltos de la comunidad tipo `id_comercio`/`id_sucursal`/`id_producto`/`precio_lista`, pero no la lista completa; no armar el parser sobre esto, es mejor no tener nada que tener algo mal).
  - `datos.produccion.gob.ar` (el dominio que sirve los ZIP/PDF reales) está bloqueado tanto desde este entorno de Claude Code como desde la red del usuario (confirmado por el usuario directamente) — no es un problema de acceso de Claude, el sitio parece estar caído/inaccesible en general. El mirror `www.datos.gob.ar` (con su API CKAN, `/api/3/action/package_search?q=...`) sí respondía y fue la fuente de las URLs de arriba.
  - Próximo paso real: cuando alguien pueda acceder, bajar un ZIP o el PDF y pasar una muestra (encabezado + filas del CSV, o el texto del PDF) para escribir el parser contra la estructura real.

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

## 4.1 Fase 3 — Auto-generación de listas (COMPLETA, mergeada y deployada — confirmado: cron job activo en el proyecto real)

Migración `supabase/migrations/20260822205236_fase3_auto_generacion_listas.sql`. Tres funciones, no una Edge Function (más simple: es solo SQL disparado por `pg_cron`, no necesita runtime aparte):
- **`fn_generar_lista_compra_interna(p_user_id uuid)`**: la lógica real (arma `listas_compra` + `detalle_lista` desde `inventario_hogar` en rojo/amarillo; `cantidad_solicitada = max(stock_minimo - cantidad_actual, 1)`; si ya hay una lista activa, la devuelve en vez de duplicar). `SECURITY DEFINER`, **sin** `GRANT EXECUTE` a nadie — no se llama directo, solo internamente.
- **`fn_generar_lista_compra()`**: RPC pública que llama el frontend (`src/app/modo-supermercado.tsx`, botón "Crear lista de compras"). Usa `auth.uid()` adentro, nunca un `user_id` que mande el cliente. También es `SECURITY DEFINER` — **importante**: tuvo que serlo porque si es `SECURITY INVOKER` (default), el rol `authenticated` no tiene permiso para llamar a la función interna y todo falla con `permission denied for function fn_generar_lista_compra_interna` (encontrado y resuelto probando de verdad contra una base local, no evidente solo leyendo el código).
- **`fn_generar_listas_automaticas()`**: batch que recorre todos los usuarios con stock bajo sin lista activa y les genera una. La dispara `pg_cron` todos los días a las 08:00 UTC (05:00 ART) — job `generar-listas-automaticas-diario` (ver `cron.job` en la base). Tampoco expuesta por RPC.

El botón manual sigue disponible (llama el mismo RPC): sirve para generar/refrescar al toque sin esperar el schedule diario.

## 4.2 Fase 5 — Dashboard de ahorro (COMPLETA, mergeada y deployada)

Migración `supabase/migrations/20260822211818_fase5_dashboard_ahorro.sql`: tres vistas de solo lectura sobre `precios_historico`, todas `WITH (security_invoker = true)` + `GRANT SELECT ... TO authenticated` explícito (mismo gotcha de `catalogo_sepa_ref`: sin el grant, RLS ni se llega a evaluar).
- **`vista_gasto_mensual`**: gasto total y cantidad de compras por mes.
- **`vista_mejor_supermercado_producto`**: promedia `precio_final` por producto+supermercado y se queda con el más barato (subquery de promedios + `DISTINCT ON`, no funciona con window function directo en el `ORDER BY` de un `DISTINCT ON`).
- **`vista_tendencia_precio`**: histórico ordenado por producto/fecha; el cliente arma "subió/bajó X%" comparando el último precio contra el anterior (`hooks/useDashboardAhorro.ts`), no está en SQL.

`screens/DashboardAhorroScreen.tsx` (tab Historial, reemplaza el placeholder). **Nota de layout (resuelta en Fase 6):** la tab bar en web flota encima del contenido (`position: absolute` en `app-tabs.web.tsx`) — originalmente parcheado acá con un `paddingTop: 76` local en el `ScrollView`, después centralizado en `src/components/app-tabs.web.tsx` (`paddingTop: 76` en el `TabSlot`) para que ninguna pantalla nueva tenga que repetirlo. Ver Fase 6.

## 4.3 Fase 4 — OCR de tickets (COMPLETA, probada con un ticket real)

`supabase/functions/procesar-ticket/index.ts` — Edge Function stateless: recibe una foto o PDF (base64) y devuelve el JSON de ítems vía Claude (Anthropic, modelo `claude-opus-5`, `output_config.format` con `type: "json_schema"`). **No escribe nada en la base** — el cliente revisa/edita el resultado en `screens/EscanearTicketModal.tsx` y recién ahí matchea (`buscar_producto_similar`), y por cada ítem confirmado hace las dos cosas a la vez: suma la cantidad a `inventario_hogar` (upsert manual: lee la fila existente y suma, o crea una nueva si el producto no estaba trackeado — no hay forma de expresar un incremento atómico en un upsert de PostgREST) e inserta en `precios_historico` (`fuente = 'ocr_ticket'`). Se decidió así a propósito: comprar algo sube el stock Y queda registrado el precio, no tiene sentido separarlo en dos flujos. El modal es el mismo componente montado en dos lugares — FAB 📷 en `InventarioScreen.tsx` (junto al FAB `+` de agregar producto) y en `historial.tsx` — cada instancia le pasa su propio `onGuardado` (`refetch` del inventario o el refresh key del dashboard).
- Requiere el secret `ANTHROPIC_API_KEY` (`supabase secrets set ANTHROPIC_API_KEY=...`) — el usuario lo carga él mismo, nunca pasa por el chat. `SUPABASE_URL`/`SUPABASE_ANON_KEY` los inyecta la plataforma solos.
- Auth propia adentro de la función (además del JWT check de la plataforma): valida `supabase.auth.getUser()` con el token del caller y rechaza con 401 si no hay usuario real — la función factura por llamada, no puede quedar abierta a cualquiera con la anon key.
- Foto vs. PDF son bloques de contenido distintos en la Messages API (`type: 'image'` vs `type: 'document'`), no solo un `media_type` distinto — la función arma el bloque correcto según `mediaType`.
- **Bug real encontrado y resuelto** (no evidente leyendo el código, solo probando con un archivo real): en web, `expo-document-picker` devuelve el **data URI completo** (`data:application/pdf;base64,XXXX`) en el campo `base64`, sin sacar el prefijo — a diferencia de `expo-image-picker`, que sí lo limpia (`result.split(',')?.[1]`, ver su código fuente). Mandarle ese string completo a Claude tira `400 Invalid base64 data`. `EscanearTicketModal.tsx` ahora le saca el prefijo explícitamente antes de mandarlo.
- Nativo (iOS/Android) sin probar en esta sesión (sin capacidad de build nativo acá): usa `expo-file-system`'s `File.arrayBuffer()` + un encoder base64 a mano (`arrayBufferABase64` en el modal), porque la API nueva de `expo-file-system` no trae un helper de base64 y `DocumentPickerAsset.base64` solo existe en la plataforma web.
- `app.json` tiene el plugin `expo-image-picker` con los textos de permiso de cámara/fotos en español — hace falta para builds nativos, no aplica en web.

## 4.4 Fase 6 — Refinamiento UI/UX (EN CURSO)

### Paleta de colores consolidada (COMPLETO)
`constants/colors.ts` — objeto `Colors` semántico (`primary`, `primaryLight`, `error`, `warning`, `success`, `textPrimary`, `textSecondary`, `border`, `backgroundMuted`, `white`). Antes cada pantalla repetía los mismos hex a mano (`#208AEF` duplicado en 6+ archivos); ahora las 7 pantallas/modales bajo `screens/` y `src/app/` (`InventarioScreen`, `DashboardAhorroScreen`, `ModoSupermercadoScreen`, `AuthScreen`, `EscanearTicketModal`, `AgregarProductoModal`, `modo-supermercado.tsx`, `historial.tsx`) importan de ahí. `shadowColor: '#000'` se dejó igual en todos lados (convención universal de sombra, no parte de la paleta semántica).

**Importante — no confundir con `src/constants/theme.ts`:** ese es el tema claro/oscuro del scaffold de Expo (`Colors.light`/`Colors.dark`), usado solo por `src/components/*` (`ThemedView`, `ThemedText`, la chrome de la tab bar en `app-tabs.tsx`/`.web.tsx`). Es un sistema aparte, no conectado a `constants/colors.ts` — las pantallas reales de la app no lo usan. Reconciliarlos queda pendiente si se retoma la tab bar.

### Categorías dinámicas + detalle/edición de producto (COMPLETO)
Antes `categoria` era el enum fijo `categoria_producto` (`alimentos`/`higiene`/`limpieza`), imposible de editar desde la app sin una migración de schema. Migración `supabase/migrations/20260823143421_fase6_categorias_dinamicas.sql`:
- Tabla **`categorias`** nueva (`id`, `nombre` único case-insensitive, `icono` texto libre — sin validación de formato, mismo criterio que `marca`). RLS + GRANT calcados de `productos_base` (lectura pública, insert/update abiertos a `authenticated`). Semillada con Alimentos🍎/Higiene🧼/Limpieza🧽.
- `productos_base.categoria` (enum) y `catalogo_sepa_ref.categoria_sugerida` (enum) pasaron a `categoria_id`/`categoria_sugerida_id` (FK a `categorias`, la de `catalogo_sepa_ref` nullable — una sugerencia SEPA puede no traer categoría). Se agregó la policy UPDATE que le faltaba a `productos_base` (antes solo tenía SELECT+INSERT; sin esto, guardar un cambio de categoría fallaba por RLS).
- `buscar_producto_similar` reescrita (mismo motivo de siempre: `DROP FUNCTION` + `CREATE`, cambia el shape de columnas) para devolver `categoria_id`/`categoria_nombre`/`categoria_icono` en vez del enum — `LEFT JOIN` en la rama `'sepa'` porque puede no haber categoría sugerida.
- **Bug real encontrado probando local (Docker) con datos preexistentes, no evidente leyendo el SQL:** el enum seguía referenciado por la versión vieja de `buscar_producto_similar`, así que `DROP TYPE categoria_producto` fallaba con "other objects depend on it" si se ejecutaba antes de reescribir la función. Orden correcto: `DROP FUNCTION` de la vieja → `DROP TYPE` → `CREATE` de la nueva.
- **Segundo bug real, este encontrado con Realtime:** ninguna tabla estaba en la publicación `supabase_realtime` (ni local ni en producción — confirmado con `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'` devolviendo 0 filas en ambas). La suscripción Realtime de `useInventario.ts` nunca hizo nada en la práctica, enmascarado porque sus actualizaciones optimistas ya hacen sentir la UI instantánea. Corregido en `supabase/migrations/20260823152319_fase6_categorias_realtime.sql` (`ALTER PUBLICATION supabase_realtime ADD TABLE categorias/inventario_hogar`) — necesario para que `hooks/useCategorias.ts` sincronice entre instancias montadas en paralelo (el picker dentro de un modal + `InventarioScreen`).

Frontend:
- **`hooks/useCategorias.ts`**: fetch + Realtime (canal con nombre único vía `useId()` — dos instancias montadas a la vez con el mismo nombre de canal tiran `cannot add postgres_changes callbacks... after subscribe()`) + `crearCategoria`/`editarCategoria`. `crearCategoria` hace un push local optimista además de confiar en Realtime (no depender del round-trip para que la categoría recién creada aparezca en la MISMA instancia que la creó), y si el insert choca con el índice único de nombre (23505 — choque real entre usuarios, o un doble submit del mismo formulario), busca la fila existente por nombre y la devuelve como si se hubiera creado en vez de solo fallar.
- **`screens/CategoriaPicker.tsx`**: selector de chips con alta/edición inline (chip "+" para crear, lápiz o mantener presionado un chip para editar nombre/ícono) — se maneja solo (llama a `useCategorias()` internamente), usado tanto en `AgregarProductoModal.tsx` como en el nuevo `DetalleProductoModal.tsx`. El mini-formulario de alta/edición es un `<View>` condicional, nunca un `<Modal>` anidado (los modales anidados de RN son poco confiables). Guard explícito contra doble submit (`if (guardando) return` al toque del handler, no solo el prop `disabled`) — un doble click/tap puede disparar el handler dos veces antes de que React re-renderice el botón deshabilitado.
- **`screens/DetalleProductoModal.tsx`**: se abre tocando una card en `InventarioScreen` (antes solo los botones +/- eran presionables). Muestra nombre/marca/código/cantidad de solo lectura, y categoría + stock mínimo + fecha de vencimiento editables. **Dos botones de guardado separados, no uno** — `categoria_id` vive en `productos_base` (catálogo compartido: cambiarlo afecta a cualquier usuario con el mismo producto) y `stock_minimo`/`fecha_vencimiento` viven en `inventario_hogar` (fila propia del usuario); son dos tablas y dos dueños distintos, así que un solo botón combinado ocultaría cuál mitad falló si la otra no.
- `InventarioScreen.tsx` arma las secciones del `SectionList` a partir de `useCategorias()` en vez de un array hardcodeado de 3 categorías fijas.
- `EscanearTicketModal.tsx` (sin selector de categoría en ese flujo) resuelve el id de "Alimentos" por nombre una sola vez por lote, no por ítem.

**Bug de layout preexistente, resuelto de paso:** la tab bar en web es `position: absolute` y flotaba encima del contenido de cada pantalla (documentado desde la Fase 5, parcheado ahí con un `paddingTop: 76` local en `DashboardAhorroScreen`). Al agregar el tap-to-detail en `InventarioScreen`, la card superior quedó con clicks interceptados por la tab bar — se centralizó el fix en `src/components/app-tabs.web.tsx` (`paddingTop: 76` en el `TabSlot`) y se sacó el parche local de `DashboardAhorroScreen`.

### Listas de compra manuales + completado con precio/descuento (COMPLETO)
Antes solo existía un camino para armar una lista: el botón "Crear lista de compras" (Fase 3), que la arma sola desde el stock en rojo/amarillo vía `fn_generar_lista_compra`. Una vez creada, `ModoSupermercadoScreen` solo dejaba tildar ítems y cargar un precio plano — sin supermercado, sin descuento, sin forma de agregar productos a mano.

**Cero migraciones.** RLS + GRANT completos ya existían para `listas_compra`/`detalle_lista`/`supermercados` (verificado leyendo la migración base), y el trigger `fn_comprar_item_lista` (también preexistente) ya calculaba `precio_final` a partir de lo que hubiera en la fila al momento de tildar `comprado`, hacía upsert de `inventario_hogar` y registraba `precios_historico` usando el `supermercado_id` **de la fila de `detalle_lista`** (no el de la lista). Consecuencia directa: agregar un producto a mano con precio/descuento ya cargados no necesita nada más al tildarlo, y agregar un producto a la lista no toca `inventario_hogar` en absoluto (el trigger lo crea recién al comprar) — se puede sumar algo nunca trackeado antes.

**Decisión de diseño:** no hay pantalla nueva de "asistente de lista manual". Todo se unificó en `ModoSupermercadoScreen`: un FAB "+" (`AgregarItemListaModal`) agrega productos con cantidad/precio/descuento/supermercado a la lista activa, sea auto-generada o manual. "Crear lista manual" (`src/app/modo-supermercado.tsx`) solo arranca una `listas_compra` vacía con supermercado elegido (`SupermercadoPicker`); se llena con ese mismo FAB.

- **`hooks/useSupermercados.ts`** + **`screens/SupermercadoPicker.tsx`**: mismo patrón que `useCategorias`/`CategoriaPicker`, pero sin Realtime (acá el picker nunca se monta en dos lugares a la vez, a diferencia de categorías) y sin edición (no hay pedido de renombrar supermercados). `crearSupermercado` generaliza la lógica de lookup-or-create que antes vivía inline en `EscanearTicketModal.tsx` — ahora la reusa.
- **`screens/DescuentoPicker.tsx`**: chip row fijo sobre los 5 valores de `tipo_descuento` (sin alta/edición). El campo de valor se muestra solo para `porcentaje`/`monto_fijo`/`descuento_2da_unidad` — `ninguno` y `2x1` no lo usan en la fórmula del trigger.
- **`screens/AgregarItemListaModal.tsx`**: mismo flujo de buscar-o-crear producto que `AgregarProductoModal.tsx` (duplicado a propósito, mismo criterio que los demás modales de `screens/`), pero el paso final inserta en `detalle_lista` (cantidad, precio, descuento, supermercado) en vez de `inventario_hogar`.
- **Bug real corregido en `ModoSupermercadoScreen.tsx`**: `marcarComprado` mandaba `precio_unitario: null` cada vez que el campo de edición local estaba vacío — **aunque el ítem ya tuviera precio cargado** (de un agregado manual), pisándolo silenciosamente al tildar sin tocar nada. Ahora hace fallback a los valores existentes del ítem (`precio_unitario`/`tipo_descuento`/`valor_descuento`/`supermercado_id`) cuando no se editó nada nuevo. Edición inline de descuento/supermercado vía una expansión liviana por fila (no un modal por ítem), reusando `DescuentoPicker`/`SupermercadoPicker`.

### Categorías colapsables + densidad (COMPLETO)
`InventarioScreen.tsx`: las secciones del `SectionList` ahora se pueden colapsar tocando el header (chevron `▾`/`▸` + conteo, ej. "🍎 Alimentos (4)"). Estado efímero (`Set<string>` de ids colapsados), sin persistir — son pocas categorías, re-expandir cuesta un tap. `SectionList` no tiene collapse nativo: se mantiene la sección en el array (el header sigue visible) pasando `data: []` cuando está colapsada. Repaso liviano de densidad en `InventarioScreen.tsx`/`ModoSupermercadoScreen.tsx` (padding de cards `12→10`, `marginBottom` `8→6`) — acotado a estas dos pantallas, sin tocar Historial/Auth ni rediseñar tipografía.

### Pendiente en Fase 6
- [ ] Scanner de código de barras (cámara → matching contra `codigo_barras` en `productos_base`).
- [ ] Microinteracciones (transiciones, feedback al tocar, animaciones de carga).

## 5. Roadmap completo (fases futuras)

1. ~~Fase 1 — Modelado de datos~~ ✅
2. ~~Fase 2 — Frontend base (Expo + Supabase)~~ ✅
3. ~~Fase 3 — Auto-generación de listas~~ ✅ (ver sección 4.1)
4. ~~Fase 4 — OCR de tickets~~ ✅ (ver sección 4.3)
5. ~~Fase 5 — Dashboard de ahorro~~ ✅ (ver sección 4.2)
6. Fase 6 — Refinamiento UI/UX: diseño visual, microinteracciones, scanner de código de barras. 🔄 en curso (ver sección 4.4)

## 6. Convenciones del proyecto

- Todo el código de negocio pesado (cálculos, validaciones críticas) va en SQL/Postgres (funciones y triggers), no en el cliente.
- Nombres de tablas, columnas y enums en español, en `snake_case` (así se definieron desde la Fase 1 — mantener consistencia).
- Componentes y archivos de frontend en inglés/PascalCase siguiendo convención de React Native (`InventarioScreen.tsx`), pero el copy visible al usuario siempre en español.
- Antes de crear un producto nuevo en `productos_base`, buscar por nombre/código de barras para evitar duplicados en el catálogo compartido.

## 7. Cómo seguir trabajando

Al retomar el proyecto, decile a Claude Code en qué fase/tarea puntual seguís (por ejemplo: "seguimos con la navegación de la Fase 2" o "arranquemos la Fase 3"). Este archivo tiene el contexto de fondo; no hace falta repetirlo en cada prompt.