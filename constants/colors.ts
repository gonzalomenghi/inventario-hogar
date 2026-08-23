// Paleta compartida por las pantallas de la app (screens/, src/app/*.tsx).
// Antes cada archivo repetía los mismos hex a mano — un solo lugar para
// cambiarlos. No confundir con src/constants/theme.ts: eso es el tema
// claro/oscuro del scaffold de Expo que usa la barra de tabs
// (src/components/*), un sistema aparte que no comparte esta paleta.
export const Colors = {
  primary: '#208AEF',
  primaryLight: '#DCEBFF', // texto claro sobre fondo primary
  error: '#E5484D',
  warning: '#F5A623', // semáforo amarillo
  success: '#30A46C', // semáforo verde, checks, precios que bajaron
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  border: '#D1D5DB',
  backgroundMuted: '#F3F4F6',
  white: '#FFFFFF',
} as const;
