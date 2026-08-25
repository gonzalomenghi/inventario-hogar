// @expo-google-fonts/quicksand expone cada peso como una familia de fuente
// DISTINTA (no "Quicksand" + fontWeight) — un solo lugar para los nombres
// exactos, evita strings mágicos repetidos por pantalla. Cargadas en
// src/app/_layout.tsx vía useFonts.
export const Fonts = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semibold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
} as const;
