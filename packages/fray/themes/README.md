# Fray structural, theme, and color CSS

Fray deliberately separates three stylesheet responsibilities:

1. `@sylwellsoftware/fray/styles/structural.css` contains the generated layout,
   flow, accessibility mechanics, stable selectors, and custom-property uses
   for the default `fray-` component hosts.
2. `@sylwellsoftware/fray/themes/<name>/theme.css` supplies geometry, surface
   treatment, and semantic theme variables. Supported treatments are `shiny`,
   `java`, and `minimal`.
3. `@sylwellsoftware/fray/colors/<name>/colors.css` supplies palette and
   semantic color variables. Supported palettes are `iceblue`, `ocean`,
   `green`, `gray`, `orange`, `purple`, `red`, and `yellow`.

Load the three artifacts independently:

```ts
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray/colors/ocean/colors.css'
import '@sylwellsoftware/fray/themes/shiny/theme.css'
```

`ThemePicker` and `ColorPicker` use the exported `frayThemeOptions` and
`frayColorOptions` catalogs by default. Each picker updates a separate
`<link data-fray-stylesheet>` element and the corresponding
`data-fray-theme`/`data-fray-color` root attribute. Applications may supply
their own option catalogs and URLs. The defaults resolve against Fray's
published package layout and therefore work for direct ESM/CDN loading. A
bundler cannot expose a universal runtime URL for package CSS; bundled
applications should import or emit each CSS asset as a URL and pass remapped
options to the pickers.

## Variable hierarchy

The public contract is exported as the machine-readable
`frayThemeVariableCatalog`. Every entry records its layer, family, value kind,
description, and optional fallback.

| Level | Representative variables | Purpose |
| --- | --- | --- |
| Palette | `--fray-color-primary`, `--fray-color-surface`, `--fray-color-text`, `--fray-color-border`, `--fray-color-focus` | Replaceable color-scheme primitives and semantic colors |
| Global theme | `--fray-font-*`, `--fray-space-*`, `--fray-radius-*`, `--fray-ui-*` | Shared typography, rhythm, shape, and surface treatment |
| Generic families | `--fray-header-*`, `--fray-button-*`, `--fray-input-*`, `--fray-panel-*`, `--fray-selection-*` | Defaults inherited by related controls |
| Family variants | `--fray-table-header-*`, `--fray-panel-header-*`, `--fray-toggle-button-*`, `--fray-tab-button-*`, `--fray-dropdown-trigger-*` | Optional narrow overrides for a theme that differentiates one family member |
| Component escape hatches | `--fray-checkbox-*`, `--fray-progress-*`, `--fray-dialog-*` | Behavior that is not meaningfully shared with a broader family |

Structural rules use the most-specific variable and fall back through the
family. A custom table-like component can follow the same pattern:

```css
my-grid > header {
  color: var(
    --my-grid-header-color,
    var(--fray-table-header-color, var(--fray-header-color))
  );
  background: var(
    --my-grid-header-background,
    var(--fray-table-header-background, var(--fray-header-background))
  );
}
```

The component now adopts every compatible Fray theme without the theme knowing
its selector. A theme can still specialize it by assigning
`--my-grid-header-*` on the component host.

## Selector exceptions

Variables are preferred but not exclusive. A treatment may target stable
`data-fray-component`, `data-part`, role, and ARIA-state hooks for effects that
custom properties cannot create alone. Shiny uses scoped pseudo-elements and
native progress/select pseudo-parts for layered highlights, dropdown arrows,
checkbox surfaces, headers, and button-like controls. Those decorations use
`pointer-events: none`, preserve native/ARIA state, and are disabled or reduced
under forced-colors where the browser's representation is safer.

Theme authors should not target application classes, generated IDs, or
incidental DOM depth. Color values should remain in `colors.css` whenever
practical; translucent white/black lighting used to construct a treatment is
permitted in `theme.css`.

The top-level `themes/light.css` and `themes/dark.css` exports are retained as
alpha compatibility bundles. New integrations should use the separated paths
above.
