# Fray color palettes

Each `<name>/colors.css` file is a replaceable variable-only palette. It does
not decide what a panel, button, input, selection, or application surface looks
like, and it never imports another stylesheet.

A palette normally supplies:

- `--palette-light` and `--palette-dark` endpoints;
- light/dark contrast colors and named red/green primitives;
- `--palette-primary-500`, `--palette-secondary-500`, and
  `--palette-neutral-500` anchors.

`themes/base.css` derives the remaining numeric ramp stops and the ordinary
`primary`, `light`, and `dark` aliases with `color-mix`. It also derives clear
and faint translucent variants of the light endpoint for palette-aware chrome.
A palette may override `--palette-<family>-light-mix` or
`--palette-<family>-dark-mix` when a ramp intentionally changes hue.

```css
@layer palette {
  :root {
    --palette-light: #fff;
    --palette-dark: #111827;
    --palette-primary-500: #2989d8;
    --palette-secondary-500: #7137a8;
    --palette-neutral-500: #7892aa;
  }
}
```

Color files contain no semantic `--button-*`, `--input-*`, or `--panel-*`
variables and no descendant selectors. Themes map the derived palette to those
semantic roles.
