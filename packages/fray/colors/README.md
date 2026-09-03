# Fray color palettes

Each `<name>/colors.css` file defines the complete `--fray-color-*` contract
without defining component geometry or treatment. It can therefore be replaced
without rebuilding Fray components or replacing the active theme stylesheet.

Palette files must provide canvas and surface colors, primary and muted text,
ordinary and strong borders, primary/hover/active/soft accents, focus and
selection colors, disabled colors, success/error roles, and highlight/shadow
tints. The required list is available programmatically from
`frayThemeVariableCatalog` entries whose `layer` is `color`.

Palette names describe a color direction, not a theme. A theme may constrain
which palettes it advertises, but the CSS contract itself keeps the two assets
independently replaceable.
