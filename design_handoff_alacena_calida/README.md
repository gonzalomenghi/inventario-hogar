# Handoff: Rediseño "Alacena Cálida" — AlacenaApp

Repo destino: `gonzalomenghi/inventario-hogar` (branch `master`). Expo + React Native (web vía react-native-web), TypeScript, Expo Router, estilos con `StyleSheet.create` y paleta central en `constants/colors.ts`.

## Overview
Rediseño visual + microinteracciones de toda la app (Login, Inventario, Modo Supermercado, Historial, modales) manteniendo la marca AlacenaApp (logo, terracota `#c1552c`, Quicksand) y la estructura de navegación existente (3 tabs). No cambia lógica de negocio ni backend: es Fase 6 (refinamiento UI/UX).

## About the Design Files
`AlacenaApp Rediseño.dc.html` es una **referencia de diseño en HTML** — un prototipo que muestra el look & feel e interacciones deseadas, NO código para copiar. La tarea es **recrear estos diseños en el codebase RN/Expo existente** usando sus patrones ya establecidos (`PressableFeedback`, `Colors`, `StyleSheet`, reanimated). La fila superior del canvas (ids 1a–1e) es la recreación de la UI actual (punto de partida); la inferior (1f–1k) es el objetivo.

## Fidelity
**High-fidelity.** Colores, tipografía, radios, sombras y espaciados son finales. Recrear pixel-perfect con los componentes existentes del repo.

## Design Tokens

### `constants/colors.ts` — reemplazar por:
```ts
export const Colors = {
  primary: '#c1552c',        // sin cambio
  primaryDark: '#a94823',    // NUEVO: hover/pressed del primary
  primaryTint: '#f8e3d8',    // NUEVO: fondo del tab activo / chips terracota
  primaryLight: '#f3e5d6',   // sin cambio (fills muted, steppers)
  error: '#E5484D',
  warning: '#F5A623',
  success: '#30A46C',
  // tintes del semáforo (fondos de chips/alertas):
  errorTint: '#fbe4e4',      // NUEVO — texto sobre él: #a92e33
  warningTint: '#fdf0d5',    // NUEVO — texto sobre él: #9a6b0a
  successTint: '#ddefe3',    // NUEVO — texto sobre él: #1e7a4d
  textPrimary: '#2a1e1a',
  textSecondary: '#a08a7d',  // CAMBIO: gris cálido (antes #6B7280)
  border: '#e9d5bd',         // CAMBIO: arena (antes #D1D5DB)
  background: '#fcf4eb',     // NUEVO: fondo global de todas las pantallas
  backgroundMuted: '#f3e5d6',
  white: '#FFFFFF',
} as const;
```

### Tipografía
- Familia: **Quicksand** en toda la app. Instalar `@expo-google-fonts/quicksand` (weights 400/500/600/700) + `useFonts` en `src/app/_layout.tsx`. En web, anteponer `Quicksand` en `--font-display` de `src/global.css`.
- Títulos de pantalla: 21px / 700. Kicker sobre el título ("Tu alacena"): 12px / 600 / textSecondary.
- Nombre de ítem: 15.5px / 600. Meta de ítem: 12.5px / 500 / textSecondary.
- Headers de sección en cards: 13px / 700 / uppercase / letterSpacing .05em / textSecondary (ya no se usan headers sueltos grises fuera de cards).

### Radios
- Cards y sheets: 20 (sheets/modales: 28 arriba).
- Botones, inputs, chips, steppers, tab bar, FABs: 999 (pill total). Eliminar todos los `borderRadius: 8/12` de controles.

### Sombras
- Card: `shadowColor:'#2a1e1a', shadowOpacity:.06, shadowRadius:10, shadowOffset:{0,2}` (elevation 2).
- FAB primario: `shadowColor:'#c1552c', shadowOpacity:.4, shadowRadius:18, shadowOffset:{0,6}` (elevation 6).
- Tab bar flotante: `shadowColor:'#2a1e1a', shadowOpacity:.14, shadowRadius:20, shadowOffset:{0,6}`.

### Iconos
`lucide-react-native`, **strokeWidth 2.75** siempre. Usados: `Home`, `ShoppingCart`, `BarChart3`, `Plus`, `Minus`, `Camera`, `Search`, `X`, `Check`, `ChevronDown`, `ChevronLeft`, `TrendingUp`, `TrendingDown`. Reemplazan a los emoji de UI (📷, +, −, ✓, ▾, ⋯) — los emoji de categorías (🍎 🧴 🧻) se mantienen: son datos del usuario.

## Screens / Views (diffs sugeridos por archivo)

### 1. `src/components/app-tabs.web.tsx` (y `app-tabs.tsx`) — ref 1f/1k
- **Mobile (<768px)**: tab bar abajo, flotante: contenedor `position:absolute; bottom:0; padding:12px 16px 16px`, con fondo degradado `transparent → #fcf4eb 40%`. Pill blanca `borderRadius:999, padding:6`, sombra tab bar. Cada tab: fila `icon 17px + label 13px`, `padding:9px 16px`, radius 999. Activo: fondo `primaryTint`, color `primary`, weight 700. Inactivo: `textSecondary`, weight 600, hover `#fcf4eb`. Labels: "Inventario", "Súper", "Ahorro".
- **Desktop (≥768px)**: pill arriba centrada `maxWidth:860` como hoy, mismo tratamiento activo/inactivo, marca a la izquierda (logo 24px + "AlacenaApp" con "App" en terracota), avatar circular 34px `primaryLight` con iniciales a la derecha.
- Reemplaza los colores del scaffold (`#F0F0F3`/`#E0E1E6` de `src/constants/theme.ts`) por los tokens de marca en este componente.

### 2. `screens/InventarioScreen.tsx` — ref 1f
- **Header propio** (nuevo, arriba de la lista): logo 30px + kicker "Tu alacena" + título "Inventario"; avatar 38px `primaryLight` con iniciales del email, a la derecha. Padding 18/20.
- **Chips de resumen** (nuevo, fila horizontal bajo el header): `N para reponer` (fondo errorTint, texto #a92e33), `N justos` (warningTint/#9a6b0a), `N ok` (successTint/#1e7a4d). Cada chip: dot 8px del color pleno + texto 12.5px/700, `padding:7px 13px`, radius 999. Los N salen de contar `estado_stock` de `items` (ya viene del backend).
- **Sección de categoría → card**: card blanca radius 20, sombra card, `marginBottom:12`. Header interno: emoji en círculo 38px `backgroundMuted` + nombre 16px/700 + badge contador (fondo `background`, radius 999, 12px/700 textSecondary) + `ChevronDown` que rota −90° al colapsar (la animación con `useSharedValue` ya existe — conservarla). Ítems dentro de la card, `padding:0 8px 8px`.
- **Fila de ítem**: dot semáforo 11px con **halo** (en RN: `View` de 19px radius 999 con fondo `xxxTint` y dot centrado). Nombre + meta. **Stepper unificado** a la derecha: contenedor `backgroundMuted` radius 999 padding 3, con botón `Minus` 30px, cantidad 14.5px/700 minWidth 26 centrada, botón `Plus` 30px; pressed: fondo `#dfc6a8`. Reemplaza los dos botones sueltos de 32px. Mantener `FadeIn/FadeOut/LinearTransition` existentes.
- **FABs**: `+` primario 58px radius 999 fondo `primary`, icono `Plus` blanco 26, sombra FAB, `bottom:86` (arriba de la tab bar); cámara secundario 46px fondo blanco icono `Camera` terracota, `bottom:150`.
- Fondo de pantalla: `Colors.background`.

### 3. `screens/AgregarProductoModal.tsx` + `AgregarItemListaModal.tsx` — ref 1f (sheet abierto)
- Sheet: radius superior 28, **handle** (barra 40×4 radius 999 `border`, centrada, margin 14 abajo).
- Header: título 19px/700 + botón cerrar circular 32px fondo `background` con icono `X` 15px textSecondary (reemplaza el texto "Cerrar").
- Buscador: pill `background` radius 999 `padding:12px 18px`, icono `Search` 17px textSecondary a la izquierda. Sin borde.
- Resultados: filas con nombre 15px/600 + categoría con su emoji 12.5px textSecondary; separador `#f6ecdd`; acción "Agregar" 13px/700 terracota a la derecha; badge "catálogo" pill `backgroundMuted` 11px/700.
- "+ Crear como producto nuevo": 14px/700 terracota.
- Botón primario: pill radius 999 `padding:15`, sombra FAB.

### 4. `screens/ModoSupermercadoScreen.tsx` — ref 1g
- **Header**: botón volver circular 36px blanco con `ChevronLeft` terracota (reemplaza "‹ Salir"; mismo onPress → confirm). Kicker "Modo supermercado" + título "Compra en {supermercado}" (o "Lista de compras" si no tiene).
- **Card de progreso** (reemplaza el resumen de texto): card **oscura `#2a1e1a`** radius 22 `padding:16px 18px`. Izquierda: "{n} de {total} en el changuito" 13px/600 color `#cbb5a5`. Derecha: total estimado 20px/700 blanco + "estimado" 12px `#cbb5a5`. Debajo: barra de progreso 8px radius 999, track `rgba(255,255,255,.15)`, fill degradado `#c1552c → #e0784a`, ancho = comprados/total.
- **Fila pendiente**: card blanca radius 18 `padding:12px 14px`. Checkbox circular **44px** borde 2.5px `border` (hover borde success). Precio: pill `background` radius 999 `padding:8px 14px` "$ {precio}" 14px/700 (placeholder "—" en `#d8c2ae` si no hay precio) — al tocar abre el TextInput/expansión actual.
- **Expansión (⋯)**: chips de descuento como pills sin borde — activo fondo `primary` texto blanco, inactivo fondo `background`; label "DESCUENTO" 12px/700 uppercase textSecondary. **Preview del ahorro** (nuevo, cuando hay descuento + precio): banda `successTint` radius 12 con `Check` 15px + "Con {promo} pagás ${x} — ahorrás ${y}" 12.5px/700 `#1e7a4d` (la fórmula ya existe: `precio_estimado` viene calculado de Postgres, solo mostrar la diferencia).
- **Comprados**: separador "EN EL CHANGUITO · {n}" (líneas `border` + label 12px/700 uppercase) y filas con fondo `rgba(255,255,255,.6)`, check lleno success 44px, nombre tachado textSecondary — reemplaza `opacity:.5`.
- Al tildar: mantener el update optimista; agregar transición de la fila hacia la sección de comprados con el `LinearTransition` ya disponible.

### 5. `screens/DashboardAhorroScreen.tsx` — ref 1h
- Header de pantalla: kicker "Tu ahorro" + título "Historial".
- **Card "Gasto por mes"**: monto del mes actual grande 26px/700 + delta vs. mes anterior 13px/600 (verde si bajó `#1e7a4d`, rojo si subió) + **gráfico de barras** de los últimos 4–6 meses: columnas flex, altura proporcional al gasto (normalizar contra el máximo), radius `10 10 4 4`; meses pasados fondo `border` (#e9d5bd), mes actual degradado `#e0784a → #c1552c`; labels de mes 11.5px/700 abajo (actual en terracota). Solo Views — sin librería de charts.
- **Card "Dónde conviene comprar"** (antes "Mejor supermercado por producto"): filas con emoji de categoría en círculo 36px `backgroundMuted`, nombre + precio prom., y badge del súper pill `successTint` texto `#1e7a4d` 12.5px/700.
- **Card "Tendencia de precios"**: círculo 36px `errorTint`/`successTint` con `TrendingUp`/`TrendingDown`, nombre + precio, delta `+12%`/`−5%` 13.5px/700 a la derecha en el color correspondiente.
- **Cuenta**: reducir a una fila simple email (12.5px textSecondary) + "Cerrar sesión" (13px/700 terracota) al final del scroll — eliminar el footer con borde y botón outline (en `src/app/historial.tsx`).
- FAB cámara: mismo patrón que Inventario (blanco, icono `Camera` terracota).

### 6. `screens/AuthScreen.tsx` — ref 1i
- Fondo `background` con **círculos decorativos**: 260px `backgroundMuted` arriba-derecha (offset −90), 52px `primaryTint` cerca, 200px `backgroundMuted` abajo-izquierda (offset −70). `position:absolute`, detrás del form.
- Logo cuadrado 76px centrado (`assets/images/logo.png`, no el horizontal) + headline "Tu alacena,\nsiempre al día" 26px/700 centrado + sub "Inventario, listas y precios en un solo lugar" 14px/500 textSecondary.
- Inputs: **pill blancas sin borde** `padding:15px 22px` 15px, sombra card. Focus (web): outline 2px `primary`.
- Botón primario: pill, sombra FAB, 15.5px/700. Link de registro: base textSecondary con la acción en terracota/700. Divisor "o" con líneas `border`. Google: pill blanca sombra card 14.5px/700.

### 7. `screens/EscanearTicketModal.tsx` — ref 1j
- Sheet radius 28 + handle. Título del paso de confirmación: "Ticket detectado".
- Supermercado y fecha como **dos cards** `background` radius 16 lado a lado, label 11px/700 uppercase + valor 14.5px/700 (tocables → editan con el TextInput actual).
- Ítems: filas pill `background` radius 16. Match existente: check lleno success 26px + sub "Coincide con «{producto}»" 12px textSecondary. **Producto nuevo**: fondo `warningTint`, circle-outline 2.5px warning, sub "Producto nuevo → 🍎 Alimentos" 12px/600 `#9a6b0a`. Precio 14px/700 a la derecha. Tocar el check excluye/incluye (estado `incluido` ya existe).
- CTA: "Sumar {n} ítems al inventario" pill primaria.
- Paso inicial (elegir foto/galería/PDF): mismos 3 botones pero pills blancas con sombra card e iconos Lucide (`Camera`, `Image`, `FileText`) en vez de emoji.

### 8. Pickers (`CategoriaPicker`, `SupermercadoPicker`, `DescuentoPicker`)
- Chips: pills **sin borde** — inactivo fondo `background` texto textPrimary 600, activo fondo `primary` texto blanco 700, pressed `primaryDark`. Chip "+" circular 36px fondo `backgroundMuted` icono `Plus` terracota.
- Form inline de alta: fondo `backgroundMuted` radius 16, inputs blancos pill.

## Interactions & Behavior
- Pressed: mantener `PressableFeedback` (opacity .6) como base; en botones primarios además oscurecer a `primaryDark`.
- Colapso de categorías: animación de chevron existente (200ms) — conservar.
- Altas/bajas de ítems: `FadeIn/FadeOut` 150ms + `LinearTransition` 200ms — conservar.
- Sheets: `animationType="slide"` actual; overlay `rgba(42,30,26,.35)` (antes negro puro).
- Barra de progreso del súper: animar el ancho con `withTiming` 300ms al tildar.
- Web hovers: tabs y filas `#fcf4eb`; steppers `#e9d5bd`; botones primarios `primaryDark`.

## State Management
Sin cambios: mismos hooks (`useInventario`, `useCategorias`, `useDashboardAhorro`, etc.) y triggers de Postgres. Nuevos derivados en frontend: conteos del semáforo (Inventario), % de progreso y ahorro por descuento (Súper), normalización de barras y delta mensual (Historial).

## Assets
- `assets/images/logo.png` y `logo-horizontal.png` — ya en el repo (kit `assets/brand-alacena/`).
- Quicksand — `@expo-google-fonts/quicksand`.
- Iconos — `lucide-react-native` (strokeWidth 2.75).

## Files
- `AlacenaApp Rediseño.dc.html` — canvas con todo: fila superior 1a–1e = UI actual (referencia de partida), fila inferior 1f–1k = objetivo. 1f es interactivo (steppers, colapso, sheet). 1k = layout escritorio (grid `1fr 320px`, rail derecho con "Para reponer", gasto del mes y alertas de precio — contenido ya disponible en los hooks).
