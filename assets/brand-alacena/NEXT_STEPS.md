# Cómo aplicar el logo de AlacenaApp en esta app (Expo)

Este folder (`assets/brand-alacena/`) tiene el logo elegido — Opción A,
"Alacena Cálida" — listo para usar. **No se tocó nada en `assets/images/`
todavía**: al momento de generar esto, esa carpeta ya tenía cambios sin
commitear (un ícono de checklist azul/verde en `icon.png`, `favicon.png`,
`android-icon-foreground.png`, `splash-icon.png` y un `logo.png` nuevo), así
que se dejaron intactos a propósito.

Cuando quieras reemplazar esos íconos por el de AlacenaApp, los mapeos son:

| Archivo del proyecto (`assets/images/`) | Reemplazar por (`assets/brand-alacena/`) |
|---|---|
| `icon.png` | `png/icon-square-1024.png` |
| `favicon.png` | `png/icon-square-48.png` |
| `android-icon-foreground.png` | `png/android-icon-foreground.png` (ya tiene el margen de seguridad de Android) |
| `android-icon-background.png` | `png/android-icon-background.png` (fondo sólido `#fcf4eb`) |
| `android-icon-monochrome.png` | `png/android-icon-monochrome.png` (silueta blanca, con margen de seguridad) |
| `splash-icon.png` | `png/icon-1024.png` (fondo transparente) |

Opcional, para que los fondos combinen con el ícono nuevo — en `app.json`:

- `expo.android.adaptiveIcon.backgroundColor`: `"#E6F4FE"` → `"#fcf4eb"`
- En el plugin `expo-splash-screen`, `backgroundColor`: `"#208AEF"` → `"#fcf4eb"`

El ícono de iOS "Liquid Glass" en `assets/expo.icon/` usa el formato Icon
Composer de Apple (capas vectoriales, no un PNG simple) — para actualizarlo
hay que rehacerlo en Icon Composer o Xcode a partir de `svg/icon.svg`.

Paleta completa, tipografía y lista de todos los archivos: ver
`brand-guide.md` en esta misma carpeta.
