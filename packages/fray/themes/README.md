# Fray theme custom properties

The alpha supports `@sylwellsoftware/fray/themes/light.css` and
`@sylwellsoftware/fray/themes/dark.css`. Import one after registering Fray structural
styles, or scope either bundle with `data-fray-theme`.

Consumers may override the variables after the theme import. The supported
control contract is:

- typography/spacing: `--base-font-size`, `--ui-font-size`, `--ui-padding`,
  `--ui-padding-h`, `--ui-padding-v`, `--spacing-small`, `--spacing-medium`;
- shape/focus: `--ui-border-radius`, `--ui-accent-color`,
  `--ui-accent-color-highlight`;
- text/input: `--ui-text-color`, `--ui-input-bg`, `--ui-input-border`,
  `--ui-input-bg-disabled`, `--ui-input-border-disabled`,
  `--ui-input-text-color-disabled`, `--input-width`, `--input-shadow`;
- actions: `--button-background`, `--button-background-hover`,
  `--button-background-disabled`, `--button-border`,
  `--button-border-disabled`, `--button-shadow`, `--button-color`,
  `--toggle-selected-bg`, `--toggle-selected-text`;
- panels/tabs/toolbars: `--panel-*`, `--panel-padding`, `--toolbar-*`,
  `--sectionheader-*`, `--tabline-bg`, `--tab-bg-active`;
- checkbox/error: `--cbx-o-border`, `--cbx-border-radius`, `--error-color`.

The root-default selector uses a zero-specificity `:where(...)` wrapper. The
explicit `data-fray-theme` selector retains attribute specificity so it also
wins when an application bundles more than one theme and the other bundle's
root fallback loads later. A consumer inline custom property or a more-specific
rule can still override a theme value. Import one bundle for one root default,
or import multiple bundles and select an explicit theme on each scoped subtree.
