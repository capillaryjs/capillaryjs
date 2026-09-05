# Fray color palettes

Each `<name>/colors.css` file defines a replaceable, prefix-free color
language. It contains palette values only; it does not decide what a panel,
button, input, selection, or application surface looks like.

Every palette supplies three complete ramps:

```text
--palette-primary-{50,100,200,300,400,500,600,700,800,900,950}
--palette-secondary-{50,100,200,300,400,500,600,700,800,900,950}
--palette-neutral-{50,100,200,300,400,500,600,700,800,900,950}
```

These ramps are automatically derived from the base `500` values using `color-mix` in `colors/base.css`. A new palette only needs to provide the base values and `@import "../base.css"`.

It also supplies `--palette-<family>`, `--palette-<family>-light`, and
`--palette-<family>-dark` aliases; `--palette-light`, `--palette-dark`,
`--palette-contrast-light`, and `--palette-contrast-dark`; and named hue
primitives such as `--palette-red` and `--palette-green`. Additional numeric
stops may be added without changing the existing contract.

Themes map these values to semantic variables. For example, a theme may map a
light-mode button to `--palette-neutral-100`, a selected item to
`--palette-primary-600`, and an error to `--palette-red`. A different theme can
use the same palette in entirely different places.

Palette declarations use a zero-specificity boundary selector for `:root` or
the matching `[data-color]` root. They select no descendants; the custom
properties propagate through normal inheritance and a nested color root seeds
its own palette. `frayThemeVariableCatalog` entries whose `layer` is `palette`
expose the machine-readable required vocabulary.
