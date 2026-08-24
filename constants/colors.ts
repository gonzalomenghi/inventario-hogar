// Paleta compartida por las pantallas de la app (screens/, src/app/*.tsx).
// Antes cada archivo repetía los mismos hex a mano — un solo lugar para
// cambiarlos. No confundir con src/constants/theme.ts: eso es el tema
// claro/oscuro del scaffold de Expo que usa la barra de tabs
// (src/components/*), un sistema aparte que no comparte esta paleta.
//
// primary/primaryLight/textPrimary/backgroundMuted salen de la paleta de
// marca de AlacenaApp (assets/brand-alacena/brand-guide.md — acento
// terracota + neutros cálidos). error/warning/success quedan igual: son
// colores funcionales (semáforo de stock, deltas de precio), no de marca,
// cambiarlos no tiene que ver con el rebrand.
export const Colors = {
  primary: '#c1552c',
  primaryLight: '#f3e5d6', // texto claro sobre fondo primary
  error: '#E5484D',
  warning: '#F5A623', // semáforo amarillo
  success: '#30A46C', // semáforo verde, checks, precios que bajaron
  textPrimary: '#2a1e1a',
  textSecondary: '#6B7280',
  border: '#D1D5DB',
  backgroundMuted: '#f3e5d6',
  white: '#FFFFFF',
} as const;
