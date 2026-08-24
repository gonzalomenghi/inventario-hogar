# AlacenaApp

App web/mobile (Expo + React Native + Supabase) para gestionar el inventario del hogar, generar listas de compra automáticamente según lo que falta, y registrar precios/descuentos del supermercado (manual y vía OCR de tickets) para optimizar el gasto mensual.

**Principio rector del producto:** máxima simplicidad visual, mínima carga manual. Toda la lógica de negocio (semáforo de stock, cálculo de precio con descuento, actualización de inventario al comprar) vive en el backend (Supabase/Postgres), no en el frontend.

> El nombre visible de la app es "AlacenaApp"; el nombre de carpeta/repo (`inventario-hogar`) y el `slug`/`scheme` de Expo se mantienen sin cambios a propósito (afectan la asociación del proyecto EAS y deep links ya emitidos).

## Stack

- **Backend:** Supabase (PostgreSQL + Auth + RLS + Triggers + Realtime + Edge Functions + `pg_cron`).
- **Frontend:** React Native + Expo (mobile-first, corre también en web vía `react-native-web`).
- **Lenguaje:** TypeScript en todo el frontend.
- **Estado/datos:** hooks propios sobre `@supabase/supabase-js` con Realtime, sin librería de estado global.
- **Navegación:** Expo Router (file-based, bottom tabs).
- **Animaciones:** `react-native-reanimated`.
- **OCR de tickets:** Edge Function que llama a la API de Claude (Anthropic).

## Requisitos previos

- Node.js (versión compatible con Expo SDK 57) y npm.
- Una cuenta/proyecto de [Supabase](https://supabase.com) (o el [Supabase CLI](https://supabase.com/docs/guides/cli) para correr todo localmente con Docker).
- Para builds nativos (no necesarios para desarrollar en web): Android Studio / Xcode, o usar Expo Go / development builds.

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Configurar variables de entorno — copiar `.env.example` a `.env` y completar con las credenciales de tu proyecto de Supabase:

   ```bash
   cp .env.example .env
   ```

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```

   Las credenciales nunca se hardcodean en el código — `lib/supabase.ts` las lee de estas variables `EXPO_PUBLIC_*`.

3. Aplicar el schema de la base de datos. Si vas a usar un proyecto de Supabase propio (no el del equipo), corré las migraciones contra él:

   ```bash
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push
   ```

   O, para desarrollar 100% en local con Docker (sin tocar ningún proyecto real):

   ```bash
   npx supabase start
   ```

   Esto levanta Postgres, Auth, Realtime y Studio localmente e imprime las credenciales (`API_URL`/`ANON_KEY`) para pegar en tu `.env`.

4. Levantar la app:

   ```bash
   npx expo start
   ```

   Desde ahí podés abrirla en web (`w`), Android, iOS, o con Expo Go.

## Estructura del proyecto

```
src/app/                  Rutas de Expo Router (file-based): tabs, layout raíz con el gate de sesión
  _layout.tsx              Sin sesión → AuthScreen; con sesión → AppTabs
  index.tsx                Tab "Inventario"
  modo-supermercado.tsx    Tab "Supermercado"
  historial.tsx             Tab "Historial" (dashboard de ahorro)
src/components/           Tab bar (nativa y web) y componentes del scaffold de Expo (tema claro/oscuro)

screens/                  Pantallas y modales de la app (lógica de UI real)
  InventarioScreen.tsx      Lista de inventario agrupada por categoría, semáforo de stock
  AgregarProductoModal.tsx  Alta de producto (búsqueda difusa o creación nueva) al inventario
  DetalleProductoModal.tsx  Detalle/edición de un producto del inventario
  ModoSupermercadoScreen.tsx Checklist de compra en vivo sobre una lista activa
  AgregarItemListaModal.tsx  Agregar un producto a mano a una lista de compra
  EscanearTicketModal.tsx   Escaneo de tickets (OCR) y confirmación de ítems
  DashboardAhorroScreen.tsx Gasto por mes y tendencia de precios
  CategoriaPicker.tsx / SupermercadoPicker.tsx / DescuentoPicker.tsx  Selectores reutilizables
  AuthScreen.tsx            Login/registro
  PressableFeedback.tsx     Wrapper de Pressable con feedback visual al tocar

hooks/                    Hooks de datos (fetch + Realtime + mutaciones) sobre Supabase
lib/supabase.ts           Cliente único de Supabase (con AsyncStorage para persistir sesión)
constants/colors.ts       Paleta de colores semántica de la app (fuente única de verdad)
types/database.types.ts   Tipos generados desde el schema de Supabase + alias de conveniencia

supabase/
  migrations/              Migraciones SQL (Supabase CLI) — el schema completo vive acá
  functions/                Edge Functions: procesar-ticket (OCR), sync-catalogo-sepa (stub)

assets/                   Íconos, splash, y el kit de marca (assets/brand-alacena/)
```

## Modelo de datos (resumen)

- **`productos_base`**: catálogo maestro compartido entre usuarios.
- **`categorias`**: categorías dinámicas (nombre + ícono), editables desde la app.
- **`supermercados`**: por usuario.
- **`inventario_hogar`**: stock por usuario y producto; `estado_stock` (rojo/amarillo/verde) es una columna generada, nunca se recalcula en el frontend.
- **`listas_compra`** / **`detalle_lista`**: listas de compra y sus ítems (cantidad, precio, descuento, supermercado).
- **`precios_historico`**: histórico de precios por producto/supermercado, con la fuente (manual, OCR, lista de compra).

La lógica de negocio central —calcular el precio final según el descuento, actualizar el stock y registrar el precio al marcar un ítem como comprado— vive en el trigger `fn_comprar_item_lista` (Postgres), no en el cliente. Todas las tablas de usuario tienen RLS (`auth.uid() = user_id`); `productos_base` y `categorias` son de lectura pública.

Para el detalle completo de tablas, triggers, funciones y decisiones de diseño, ver [`CLAUDE.md`](./CLAUDE.md).

## Funcionalidades principales

- **Inventario**: alta/edición/borrado de productos, ajuste rápido de cantidad (+/-), semáforo visual de stock, categorías colapsables.
- **Listas de compra**: auto-generación diaria (`pg_cron`) según lo que está en rojo/amarillo, o creación manual; agregar ítems con precio/descuento/supermercado; "Modo Supermercado" para tildar la compra en vivo (actualiza stock y precio automáticamente).
- **Escaneo de tickets (OCR)**: foto o PDF de un ticket → Claude extrae los ítems → se confirman/editan y se suman al inventario + histórico de precios.
- **Dashboard de ahorro**: gasto total por mes, mejor supermercado por producto, tendencia de precio unitario (sube/baja %) por producto.
- **Matching difuso de productos**: búsqueda por nombre/código de barras contra el catálogo propio y (a futuro) el dataset público SEPA/Precios Claros, para evitar duplicados.

## Scripts disponibles

```bash
npm start        # expo start
npm run android   # expo start --android
npm run ios       # expo start --ios
npm run web       # expo start --web
npm run lint      # expo lint
```

## Testing y verificación local

No hay suite de tests automatizada todavía. El flujo usado durante el desarrollo para verificar cambios de UI:

1. `npx supabase start` (levanta Supabase local en Docker).
2. Apuntar `.env` temporalmente a las credenciales locales que imprime `supabase start`.
3. `npx expo start --web` y probar el flujo a mano (o con Playwright).
4. Restaurar el `.env` original y `npx supabase stop`.

Para chequeo de tipos: `npx tsc --noEmit -p tsconfig.json`.

## Despliegue del backend

El proyecto de Supabase real tiene la integración GitHub↔Supabase activa: **cualquier migración nueva en `supabase/migrations/` que se mergee a `master` se aplica sola a la base de producción.** Para agregar cambios de schema: `npx supabase migration new <nombre>`, escribir el SQL, probarlo localmente, y mergear.

Las Edge Functions (`supabase/functions/`) se despliegan por separado con `npx supabase functions deploy <nombre>` y requieren sus propios secrets (ver `npx supabase secrets set`).

## Roadmap

1. ✅ Fase 1 — Modelado de datos
2. ✅ Fase 2 — Frontend base (Expo + Supabase)
3. ✅ Fase 3 — Auto-generación de listas de compra
4. ✅ Fase 4 — OCR de tickets
5. ✅ Fase 5 — Dashboard de ahorro
6. 🔄 Fase 6 — Refinamiento UI/UX (diseño visual, microinteracciones, rebrand) — pendiente: scanner de código de barras

Detalle completo de cada fase, decisiones de diseño y bugs reales encontrados durante el desarrollo: ver [`CLAUDE.md`](./CLAUDE.md).

## Convenciones del proyecto

- Toda lógica de negocio pesada (cálculos, validaciones críticas) va en SQL/Postgres (funciones y triggers), no en el cliente.
- Nombres de tablas, columnas y enums en español, en `snake_case`.
- Componentes y archivos de frontend en inglés/PascalCase (convención de React Native), pero el copy visible al usuario siempre en español.
- Antes de crear un producto nuevo en `productos_base`, buscar por nombre/código de barras para evitar duplicados en el catálogo compartido.

## Aprender más sobre Expo

- [Documentación de Expo](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction)
- [Guía de Supabase + Expo](https://supabase.com/docs/guides/getting-started/quickstarts/react-native)
