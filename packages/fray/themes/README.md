# Fray structural, theme, and color CSS

Fray separates three stylesheet responsibilities:

1. `styles/structural.css` contains generated layout, flow, sizing,
   positioning, overflow, interaction mechanics, and justified structural
   hooks for the default component hosts.
2. `themes/<name>/theme.css` contains typography, spacing, geometry, surfaces,
   depth, native-element presentation, reusable trait presentation, and the
   mapping from palette values to semantic UI variables.
3. `colors/<name>/colors.css` contains primary, secondary, and neutral color
   ramps and contrast/color primitives only.

Load the three artifacts independently:

```ts
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray/colors/ocean/colors.css'
import '@sylwellsoftware/fray/themes/shiny/theme.css'
```

`ThemePicker` and `ColorPicker` replace separate
`link[data-fray-stylesheet]` elements and update the `data-theme` and
`data-color` root attributes. The link metadata retains its Fray prefix because
it is operational/diagnostic metadata rather than theme vocabulary.

## Selectors and scope

Themes target native elements directly and expose reusable prefix-free traits:

```text
buttonlike          inputlike          datacomponentlike
headerlike          coloredlike        panellike
toolbarlike         selectshell

buttonshell         buttoninner
inputshell          inputinner
datacomponentshell  datacomponentinner
headershell         headerinner
panelshell          panelinner
toolbarshell        toolbarinner
coloredshell        coloredinner
```

`like` means a complete single-node treatment. `shell` means an independently
rendered outer region; `inner` means an independently rendered content region.
Components do not add wrappers solely to obtain these traits.

Every theme uses a named cascade layer. A zero-specificity boundary rule seeds
its inherited variables on `:root` or the matching `[data-theme]`. Presentation
selectors live in `@scope`; nested theme roots and `[data-theme-exclude]` stop
the outer theme's selectors. This separation is deliberate because scope
limits do not stop custom-property inheritance. Low-specificity `:where()`
groups let application CSS override both kinds of rule.

Themes do not select `data-fray-component` or `data-part`. The former is
diagnostic metadata. The latter is restricted to component-owned structural
or behavioral mechanics that cannot be expressed through native structure,
roles, ARIA state, or a justified public trait.

## Variables

The active color file supplies only `--palette-*`. The active theme maps those
values to prefix-free semantic families such as `--ui-*`, `--header-*`,
`--button-*`, `--input-*`, `--panel-*`, and `--selection-*`. Generated
structural CSS may consume these variables where configurable host names make
a direct theme selector inappropriate.

Custom colored content can set:

```css
.severity-block {
  --colored-light: #ffd7d2;
  --colored-base: #c8332a;
  --colored-dark: #721710;
  --colored-contrast: white;
}
```

An element carrying `coloredlike`, `coloredshell`, or `coloredinner` then lets
each theme decide whether to use a flat fill, gradient, other treatment, or no
special polish. When no values are supplied, the primary palette is used.

`frayThemeVariableCatalog` publishes the palette and theme variable contract.
The top-level `themes/light.css` and `themes/dark.css` files remain temporary
compatibility bundles; new integrations use the separated files.
