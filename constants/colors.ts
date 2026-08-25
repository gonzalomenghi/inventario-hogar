// Paleta compartida por las pantallas de la app (screens/, src/app/*.tsx).
// Antes cada archivo repetía los mismos hex a mano — un solo lugar para
// cambiarlos. No confundir con src/constants/theme.ts: eso es el tema
// claro/oscuro del scaffold de Expo que usa la barra de tabs nativa
// (src/components/app-tabs.tsx), un sistema aparte que no comparte esta
// paleta (app-tabs.web.tsx sí usa esta).
//
// Tokens del rediseño "Alacena Cálida" (design_handoff_alacena_calida/):
// primary/primaryDark/primaryTint/primaryLight/textPrimary/background/
// backgroundMuted salen de esa paleta de marca (acento terracota + neutros
// cálidos). error/warning/success y sus *Tint quedan igual en el pleno: son
// colores funcionales (semáforo de stock, deltas de precio), no de marca —
// los *Tint son fondos suaves para chips/alertas, no reemplazan al color
// pleno (que sigue usándose para dots/iconos).
export const Colors = {
  primary: '#c1552c',
  primaryDark: '#a94823', // hover/pressed del primary
  primaryTint: '#f8e3d8', // fondo del tab activo / chips terracota
  primaryLight: '#f3e5d6', // texto claro sobre fondo primary; fills muted, steppers
  error: '#E5484D',
  warning: '#F5A623', // semáforo amarillo
  success: '#30A46C', // semáforo verde, checks, precios que bajaron
  errorTint: '#fbe4e4', // fondo de chip/alerta
  errorTintText: '#a92e33', // texto/ícono sobre errorTint
  warningTint: '#fdf0d5',
  warningTintText: '#9a6b0a',
  successTint: '#ddefe3',
  successTintText: '#1e7a4d',
  textPrimary: '#2a1e1a',
  textSecondary: '#a08a7d', // gris cálido
  border: '#e9d5bd', // arena
  background: '#fcf4eb', // fondo global de todas las pantallas
  backgroundMuted: '#f3e5d6',
  white: '#FFFFFF',
} as const;
