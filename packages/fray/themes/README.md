# Fray base and themes

Fray presentation is assembled from independently owned files in this order:

1. `themes/base.css` — defaults and palette derivation.
2. Collected component CSS or `styles/structural.css` — selectors and layout.
3. One `colors/<name>/colors.css` — palette anchors and endpoints.
4. One `themes/<name>/theme.css` — intentional semantic-role overrides.

Application layout CSS is separate from these inputs.

## Base file

`base.css` provides usable default palette anchors, derives primary, secondary,
and neutral ramps, and declares the semantic variable fallback hierarchy. It
contains no component selectors and no declarations that consume those
variables.

Applications import the base explicitly. Named themes and palettes never
import it, so the cascade and ownership order remain visible.

## Theme files

Published themes are:

| Theme | Appearance capability | Intent |
| --- | --- | --- |
| `minimal` | Adaptive (`light`, `dark`, or system) | Restrained platform-oriented treatment |
| `java` | Light | Desktop control treatment inspired by classic Java interfaces |
| `shiny` | Light | Gloss, depth, and chromed graphical surfaces |

A theme changes custom properties. The sole ordinary-property exception is
`color-scheme`, which informs browser-native rendering. Themes must not contain
component, trait, part, ARIA-state, or pseudo-element selectors; those belong
to the component's `static css`.

Start a new theme with no overrides and add a variable only when it creates an
intentional difference from `base.css`:

```css
@layer theme {
  :root {
    color-scheme: only light;
    --button-background: linear-gradient(white, #ddd);
    --button-shadow: -1px 1px 2px rgb(0 0 0 / 0.4);
  }
}
```

`frayThemeVariableCatalog` is the machine-readable public contract. Its
fallback chain runs from palette roles through global UI roles and shared
families, then to optional component-specific roles. A small theme can
therefore override a family without naming every component.

## Runtime selection and appearance

`frayThemeOptions` lists built-in theme links and their light/dark capability.
`ThemePicker` or `replaceFrayStylesheet('theme', option)` replaces the marked
theme link. `setFrayAppearance('light' | 'dark' | 'system')` controls adaptive
themes; `system` removes the explicit root attribute so browser preference
applies.

Theme availability, default selection, persistence, and whether users can
switch at runtime are application policy.

When changing a theme, verify all supported palettes, native control states,
keyboard focus, disabled/error/selection contrast, forced colors, reduced
motion, and 200% text.
