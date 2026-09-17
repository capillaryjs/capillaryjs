# Capillary UI color palettes

Each `<name>/colors.css` file is a replaceable, variable-only palette. It owns
color anchors and endpoints, not the appearance of a panel, button, input,
selection, or application surface. Palette files contain no component
selectors and never import another stylesheet.

Published palettes are `gray`, `green`, `iceblue`, `ocean`, `orange`, `purple`,
`red`, and `yellow`.

## Palette contract

A palette supplies:

- `--palette-light` and `--palette-dark` endpoints;
- `--palette-contrast-light` and `--palette-contrast-dark` foregrounds;
- `--palette-status-negative`, `--palette-status-positive`, and
  `--palette-status-neutral` status primitives. The last is deliberately
  distinct from the `--palette-neutral-*` tonal ramp;
- `--palette-primary-500`, `--palette-secondary-500`, and
  `--palette-neutral-500` anchors.
- palette-primary-surface-saturation, a 0–1 multiplier for the three muted
  primary chrome surfaces.

`themes/base.css` derives the remaining numeric ramp stops, ordinary
`primary`/`light`/`dark` aliases, and transparent light variants with
`color-mix()`. A palette may override a
`--palette-<family>-light-mix` or `--palette-<family>-dark-mix` endpoint when a
ramp intentionally changes hue.

```css
@layer palette {
  :root {
    --palette-light: #fff;
    --palette-dark: #111827;
    --palette-contrast-light: #fff;
    --palette-contrast-dark: #111827;
    --palette-status-negative: #c62828;
    --palette-status-positive: #2e7d32;
    --palette-status-neutral: #64748b;
    --palette-primary-500: #2989d8;
    --palette-primary-surface-saturation: 1;
    --palette-secondary-500: #7137a8;
    --palette-neutral-500: #7892aa;
  }
}
```

Color files must not declare semantic roles such as `--button-*`,
`--input-*`, or `--panel-*`. The base and active theme map derived palette
values to those roles.

## Muted primary surfaces

The base also derives `--palette-primary-surface-light`,
`--palette-primary-surface-medium`, and `--palette-primary-surface-dark` from
`--palette-primary-500` and `--palette-light`. These are pale, desaturated
surface tones, separate from the accent ramp: Ice blue's cyan
`--palette-primary-light-mix` intentionally does not tint these surfaces.
The existing `--ui-primary-bg-color`, `--ui-medium-bg-color`, and
`--ui-dark-bg-color` variables alias them, respectively. Shiny panels, table
headers, button gradients, and other consumers retain their existing wiring.

The derivation uses relative HSL to reduce primary saturation and apply a small
hue offset, followed by `color-mix(in srgb, ..., var(--palette-light))`. Its
rational coefficients preserve the historical Ice blue colors exactly:

| Surface | Ice blue sRGB | Hue offset | Saturation multiplier | Primary tint weight |
| --- | --- | --- | --- | --- |
| light | `#f5f7f8` | `-248/35` degrees | `759/2975` | `17/253` |
| medium | `#ebeff3` | `102/35` degrees | `253/700` | `32/253` |
| dark | `#d7dee3` | `-73/35` degrees | `759/2975` | `68/253` |

These are calibration ratios, not arbitrary rounded percentages: the reference
primary `#2989d8` has HSL hue `7248/35`, saturation `17500/253` percent, and
lightness `12850/255` percent. The three legacy targets have different hues
and saturations, so one white/primary ramp cannot reproduce all three. The
same calibrated recipe runs for every palette; there is no Ice blue override.
Changing the primary anchor or light endpoint recomputes all three surfaces.
Applications may still override the surface tokens or existing UI aliases.

`--palette-primary-surface-saturation` controls how much primary hue the three
surfaces retain. It is a palette number from `0` through `1`: `1` is the
calibrated default (and preserves Ice blue exactly), `0.5` halves the primary
saturation, and `0` makes all three surfaces completely neutral. It affects
only these muted surfaces, never the primary accent ramp or component semantic
roles that use it.

Shiny's chrome and progress-track gradients explicitly interpolate in sRGB,
preserving their legacy appearance when stops become derived `color()` values.
Custom gradients that need the same legacy interpolation should likewise declare
`in srgb` instead of relying on the browser's choice of interpolation space.

This derivation requires relative HSL colors and `color-mix()`, verified in
the package's Chromium, Firefox, and WebKit browser matrix.

## Loading and replacement

Load one palette after Capillary UI's base and structural CSS and before the active
theme:

```ts
import '@capillaryjs/capillary-ui/colors/iceblue/colors.css'
```

`capillaryUiColorOptions` lists the built-in files. `ColorPicker` and
`replaceCapillaryUiStylesheet('colors', option)` replace the link marked
`data-cap-stylesheet="colors"`; applications own selection and persistence
policy.

When adding a palette, test its derived ramps and contrast in every supported
theme, forced-colors mode, and application states that introduce semantic
status colors.
