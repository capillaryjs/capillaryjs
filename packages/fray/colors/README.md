# Fray color palettes

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
- `--palette-red` and `--palette-green` status primitives;
- `--palette-primary-500`, `--palette-secondary-500`, and
  `--palette-neutral-500` anchors.

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
    --palette-red: #c62828;
    --palette-green: #2e7d32;
    --palette-primary-500: #2989d8;
    --palette-secondary-500: #7137a8;
    --palette-neutral-500: #7892aa;
  }
}
```

Color files must not declare semantic roles such as `--button-*`,
`--input-*`, or `--panel-*`. The base and active theme map derived palette
values to those roles.

## Loading and replacement

Load one palette after Fray's base and structural CSS and before the active
theme:

```ts
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
```

`frayColorOptions` lists the built-in files. `ColorPicker` and
`replaceFrayStylesheet('colors', option)` replace the link marked
`data-fray-stylesheet="colors"`; applications own selection and persistence
policy.

When adding a palette, test its derived ramps and contrast in every supported
theme, forced-colors mode, and application states that introduce semantic
status colors.
