# Fray base and theme CSS

Fray presentation is loaded in this order:

1. `themes/base.css`: custom-property defaults and palette derivation only.
2. Runtime-collected structural CSS for the application's declared components.
3. One `colors/<name>/colors.css`: palette anchors and endpoints only.
4. One `themes/<name>/theme.css`: intentional custom-property overrides only.

Application-owned layout CSS is separate from these Fray inputs.

## Base file

`base.css` provides usable default palette anchors, derives the primary,
secondary, and neutral ramps, and declares semantic defaults. It contains no
component selectors and no declarations that consume those variables.

The application imports it explicitly. Named themes and colors never import it,
which keeps ownership and load order visible.

## Theme files

A theme changes only variables. The sole ordinary-property exception is
`color-scheme`, because it informs browser-native rendering. A theme must not
contain component, trait, part, ARIA-state, or pseudo-element selectors. Those
selectors belong to component `static css` even when their values are driven by
theme variables.

Start with no overrides. Add a variable only when it produces a deliberate
visual difference from `base.css`; do not repeat defaults for completeness.

```css
@layer theme {
  :root {
    color-scheme: only light;
    --button-background: linear-gradient(white, #ddd);
    --button-shadow: -1px 1px 2px rgb(0 0 0 / 0.4);
  }
}
```

`frayThemeVariableCatalog` publishes the supported palette and semantic
variable contract. Component-specific variables should fall back through a
shared family so a theme can remain small.
