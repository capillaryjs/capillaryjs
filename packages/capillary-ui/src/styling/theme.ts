export type CapillaryUiStylesheetKind = 'theme' | 'colors'
export type CapillaryUiAppearance = 'light' | 'dark' | 'system'
export type CapillaryUiThemeAppearanceCapability = 'light' | 'dark' | 'adaptive'

export interface CapillaryUiStylesheetOption {
    value: string
    label: string
    href: string
}

export interface CapillaryUiThemeOption extends CapillaryUiStylesheetOption {
    /** Appearance modes the selected theme deliberately supports. */
    appearance: CapillaryUiThemeAppearanceCapability
}

export type CapillaryUiThemeVariableLayer = 'palette' | 'theme'
export type CapillaryUiThemeVariableValue =
    | 'background'
    | 'border'
    | 'color'
    | 'dimension'
    | 'duration'
    | 'font'
    | 'opacity'
    | 'radius'
    | 'ratio'
    | 'shadow'

export interface CapillaryUiThemeVariableDefinition {
    name: `--${string}`
    layer: CapillaryUiThemeVariableLayer
    family: string
    value: CapillaryUiThemeVariableValue
    description: string
    fallback?: `--${string}`
}

/**
 * Public, machine-readable theming contract. Component-specific variables fall
 * back through a family rather than forcing every theme to target every host.
 */
export const capillaryUiThemeVariableCatalog = Object.freeze([
    ...paletteRamp('primary'),
    ...paletteRamp('secondary'),
    ...paletteRamp('neutral'),
    variable('--palette-primary', 'palette', 'primary', 'color', 'Primary anchor color', '--palette-primary-500'),
    variable('--palette-primary-light', 'palette', 'primary', 'color', 'Light primary color', '--palette-primary-200'),
    variable('--palette-primary-dark', 'palette', 'primary', 'color', 'Dark primary color', '--palette-primary-800'),
    variable('--palette-primary-surface-saturation', 'palette', 'primary', 'ratio', 'Muted primary surface saturation (0 neutral; 1 calibrated)'),
    variable('--palette-primary-surface-light', 'palette', 'primary', 'color', 'Light muted primary surface'),
    variable('--palette-primary-surface-medium', 'palette', 'primary', 'color', 'Medium muted primary surface'),
    variable('--palette-primary-surface-dark', 'palette', 'primary', 'color', 'Dark muted primary surface'),
    variable('--palette-secondary', 'palette', 'secondary', 'color', 'Secondary anchor color', '--palette-secondary-500'),
    variable('--palette-secondary-light', 'palette', 'secondary', 'color', 'Light secondary color', '--palette-secondary-200'),
    variable('--palette-secondary-dark', 'palette', 'secondary', 'color', 'Dark secondary color', '--palette-secondary-800'),
    variable('--palette-neutral', 'palette', 'neutral', 'color', 'Neutral anchor color', '--palette-neutral-500'),
    variable('--palette-neutral-light', 'palette', 'neutral', 'color', 'Light neutral color', '--palette-neutral-200'),
    variable('--palette-neutral-dark', 'palette', 'neutral', 'color', 'Dark neutral color', '--palette-neutral-800'),
    variable('--palette-light', 'palette', 'contrast', 'color', 'Light endpoint'),
    variable('--palette-dark', 'palette', 'contrast', 'color', 'Dark endpoint'),
    variable('--palette-light-clear', 'palette', 'contrast', 'color', 'Transparent light endpoint'),
    variable('--palette-light-faint', 'palette', 'contrast', 'color', 'Faint translucent light endpoint'),
    variable('--palette-primary-light-mix', 'palette', 'primary', 'color', 'Light-side primary ramp mix endpoint', '--palette-light'),
    variable('--palette-primary-dark-mix', 'palette', 'primary', 'color', 'Dark-side primary ramp mix endpoint', '--palette-dark'),
    variable('--palette-secondary-light-mix', 'palette', 'secondary', 'color', 'Light-side secondary ramp mix endpoint', '--palette-light'),
    variable('--palette-secondary-dark-mix', 'palette', 'secondary', 'color', 'Dark-side secondary ramp mix endpoint', '--palette-dark'),
    variable('--palette-neutral-light-mix', 'palette', 'neutral', 'color', 'Light-side neutral ramp mix endpoint', '--palette-light'),
    variable('--palette-neutral-dark-mix', 'palette', 'neutral', 'color', 'Dark-side neutral ramp mix endpoint', '--palette-dark'),
    variable('--palette-contrast-light', 'palette', 'contrast', 'color', 'Light contrasting foreground', '--palette-light'),
    variable('--palette-contrast-dark', 'palette', 'contrast', 'color', 'Dark contrasting foreground', '--palette-dark'),
    variable('--palette-status-negative', 'palette', 'status', 'color', 'Negative status color'),
    variable('--palette-status-positive', 'palette', 'status', 'color', 'Positive status color'),
    variable('--palette-status-neutral', 'palette', 'status', 'color', 'Neutral status color (not the neutral tonal ramp)'),

    variable('--font-family', 'theme', 'typography', 'font', 'UI font stack'),
    variable('--font-size', 'theme', 'typography', 'dimension', 'Base UI font size'),
    variable('--line-height', 'theme', 'typography', 'dimension', 'Base UI line height'),
    variable('--control-min-height', 'theme', 'control', 'dimension', 'Minimum control height'),
    variable('--control-row-min-height', 'theme', 'control', 'dimension', 'Additional common row floor before block padding'),
    variable('--control-row-padding-block', 'theme', 'control', 'dimension', 'Breathing room above and below a line-control row'),
    variable('--space-xs', 'theme', 'spacing', 'dimension', 'Extra-small spacing'),
    variable('--space-sm', 'theme', 'spacing', 'dimension', 'Small spacing'),
    variable('--space-md', 'theme', 'spacing', 'dimension', 'Medium spacing'),
    variable('--space-lg', 'theme', 'spacing', 'dimension', 'Large spacing'),
    variable('--radius-sm', 'theme', 'shape', 'radius', 'Small corner radius'),
    variable('--radius-md', 'theme', 'shape', 'radius', 'Ordinary corner radius'),
    variable('--radius-lg', 'theme', 'shape', 'radius', 'Large corner radius'),
    variable('--motion-fast', 'theme', 'motion', 'duration', 'Fast interaction transition'),

    variable('--application-background', 'theme', 'surface', 'background', 'Application canvas'),
    variable('--ui-background', 'theme', 'surface', 'background', 'Default UI background'),
    variable('--ui-primary-bg-color', 'theme', 'surface', 'color', 'Light chrome background', '--palette-primary-surface-light'),
    variable('--ui-medium-bg-color', 'theme', 'surface', 'color', 'Medium chrome background', '--palette-primary-surface-medium'),
    variable('--ui-dark-bg-color', 'theme', 'surface', 'color', 'Dark chrome background', '--palette-primary-surface-dark'),
    variable('--ui-color', 'theme', 'surface', 'color', 'Default UI text'),
    variable('--ui-border', 'theme', 'surface', 'border', 'Default UI border'),
    variable('--ui-shadow', 'theme', 'surface', 'shadow', 'Default raised shadow'),
    variable('--focus-ring', 'theme', 'focus', 'shadow', 'Keyboard focus ring'),
    variable('--focus-color', 'theme', 'focus', 'color', 'Keyboard focus color'),
    variable('--negative-color', 'theme', 'status', 'color', 'Negative status color', '--palette-status-negative'),
    variable('--positive-color', 'theme', 'status', 'color', 'Positive status color', '--palette-status-positive'),
    variable('--neutral-status-color', 'theme', 'status', 'color', 'Neutral status color', '--palette-status-neutral'),
    variable('--error-color', 'theme', 'status', 'color', 'Error state color'),
    variable('--error-contrast', 'theme', 'status', 'color', 'Content on an error surface'),
    variable('--error-control-border', 'theme', 'status', 'border', 'Error control edge'),
    variable('--error-control-underlay', 'theme', 'status', 'color', 'Error control outer halo'),
    variable('--error-control-shadow', 'theme', 'status', 'shadow', 'Error control outer halo shadow'),
    variable('--error-icon-border', 'theme', 'status', 'border', 'Error badge contrasting edge'),
    variable('--error-icon-shadow', 'theme', 'status', 'shadow', 'Error badge elevation'),
    variable('--success-color', 'theme', 'status', 'color', 'Success state color'),

    variable('--panel-background', 'theme', 'panel', 'background', 'Panel surface', '--ui-background'),
    variable('--panel-color', 'theme', 'panel', 'color', 'Panel content', '--ui-color'),
    variable('--panel-border', 'theme', 'panel', 'border', 'Panel border', '--ui-border'),
    variable('--panel-shadow', 'theme', 'panel', 'shadow', 'Panel shadow', '--ui-shadow'),
    variable('--panel-radius', 'theme', 'panel', 'radius', 'Panel radius', '--radius-md'),
    variable('--filter-panel-background', 'theme', 'filter-panel', 'background', 'Floating table-filter surface', '--panel-background'),
    variable('--filter-panel-color', 'theme', 'filter-panel', 'color', 'Floating table-filter content', '--panel-color'),
    variable('--filter-panel-border', 'theme', 'filter-panel', 'border', 'Floating table-filter edge', '--panel-border'),
    variable('--filter-panel-shadow', 'theme', 'filter-panel', 'shadow', 'Floating table-filter elevation', '--panel-shadow'),
    variable('--filter-panel-radius', 'theme', 'filter-panel', 'radius', 'Floating table-filter corner radius', '--panel-radius'),
    variable('--filter-panel-padding', 'theme', 'filter-panel', 'dimension', 'Floating table-filter inner spacing', '--space-md'),
    variable('--filter-panel-min-width', 'theme', 'filter-panel', 'dimension', 'Floating table-filter minimum width'),
    variable('--island-margin', 'theme', 'island', 'dimension', 'Outer spacing around an explicit island'),
    variable('--island-gap', 'theme', 'island', 'dimension', 'Shared gutter between managed island regions'),
    variable('--island-inset', 'theme', 'island', 'dimension', 'Perimeter inset of an island layout', '--island-gap'),
    variable('--island-padding', 'theme', 'island', 'dimension', 'Inner spacing within an explicit island'),
    variable('--island-background', 'theme', 'island', 'background', 'Explicit island surface', '--panel-background'),
    variable('--island-border', 'theme', 'island', 'border', 'Explicit island edge', '--panel-border'),
    variable('--island-radius', 'theme', 'island', 'radius', 'Explicit island radius', '--panel-radius'),
    variable('--island-shadow', 'theme', 'island', 'shadow', 'Explicit island elevation', '--panel-shadow'),
    variable('--dialog-shadow', 'theme', 'dialog', 'shadow', 'Modal dialog shadow', '--panel-shadow'),
    variable('--dialog-backdrop-background', 'theme', 'dialog', 'background', 'Modal backdrop'),

    variable('--header-background', 'theme', 'header', 'background', 'Generic header surface'),
    variable('--header-color', 'theme', 'header', 'color', 'Generic header content'),
    variable('--header-border', 'theme', 'header', 'border', 'Generic header border'),
    variable('--header-shadow', 'theme', 'header', 'shadow', 'Generic header shadow'),
    variable('--section-header-background', 'theme', 'header', 'background', 'Section header surface', '--header-background'),
    variable('--section-header-color', 'theme', 'header', 'color', 'Section header content', '--header-color'),
    variable('--section-header-border', 'theme', 'header', 'border', 'Section header border', '--header-border'),
    variable('--section-header-shadow', 'theme', 'header', 'shadow', 'Section header shadow', '--header-shadow'),
    variable('--groupbox-section-header-color', 'theme', 'groupbox', 'color', 'Section GroupBox heading', '--section-header-color'),
    variable('--groupbox-section-separator', 'theme', 'groupbox', 'border', 'Section GroupBox heading separator', '--ui-border'),
    variable('--groupbox-column-header-color', 'theme', 'groupbox', 'color', 'Column GroupBox heading', '--ui-color'),
    variable('--groupbox-column-separator', 'theme', 'groupbox', 'border', 'Column GroupBox separator', '--ui-border'),
    variable('--groupbox-content-gap', 'theme', 'groupbox', 'dimension', 'Spacing between direct GroupBox content rows'),
    variable('--table-header-background', 'theme', 'header', 'background', 'Table header surface', '--section-header-background'),
    variable('--table-header-color', 'theme', 'header', 'color', 'Table header content', '--section-header-color'),
    variable('--dialog-header-background', 'theme', 'header', 'background', 'Dialog header surface', '--section-header-background'),
    variable('--dialog-header-color', 'theme', 'header', 'color', 'Dialog header content', '--section-header-color'),

    variable('--button-background', 'theme', 'button', 'background', 'Generic button surface'),
    variable('--button-background-hover', 'theme', 'button', 'background', 'Hovered button surface'),
    variable('--button-background-active', 'theme', 'button', 'background', 'Pressed button surface'),
    variable('--button-background-disabled', 'theme', 'button', 'background', 'Disabled button surface'),
    variable('--button-color', 'theme', 'button', 'color', 'Generic button content'),
    variable('--button-border', 'theme', 'button', 'border', 'Generic button border'),
    variable('--button-shadow', 'theme', 'button', 'shadow', 'Generic button shadow'),
    variable('--button-shadow-active', 'theme', 'button', 'shadow', 'Pressed button shadow'),
    variable('--button-border-style-active', 'theme', 'button', 'border', 'Pressed button border style'),
    variable('--toggle-button-background', 'theme', 'button', 'background', 'Toggle option surface', '--button-background'),
    variable('--toggle-button-background-checked', 'theme', 'button', 'background', 'Selected toggle option', '--selection-background'),
    variable('--tab-button-background', 'theme', 'button', 'background', 'Tab surface', '--button-background'),
    variable('--tab-button-background-active', 'theme', 'button', 'background', 'Active tab surface', '--tab-active-background'),
    variable('--menu-button-background', 'theme', 'button', 'background', 'Menu action surface', '--button-background'),
    variable('--dropdown-trigger-background', 'theme', 'button', 'background', 'Dropdown arrow/trigger surface', '--button-background'),
    variable('--table-header-button-background', 'theme', 'button', 'background', 'Table-header action surface', '--button-background'),

    variable('--input-background', 'theme', 'input', 'background', 'Input surface'),
    variable('--input-color', 'theme', 'input', 'color', 'Input content'),
    variable('--input-border', 'theme', 'input', 'border', 'Input border'),
    variable('--input-shadow', 'theme', 'input', 'shadow', 'Input shadow'),
    variable('--input-background-disabled', 'theme', 'input', 'background', 'Disabled input surface'),
    variable('--input-color-disabled', 'theme', 'input', 'color', 'Disabled input content'),

    variable('--selection-background', 'theme', 'selection', 'background', 'Selected item surface'),
    variable('--selection-color', 'theme', 'selection', 'color', 'Selected item content'),
    variable('--row-hover-background', 'theme', 'row', 'background', 'Hovered list/table/tree row'),
    variable('--table-row-background', 'theme', 'table', 'background', 'Odd table row surface'),
    variable('--table-row-alt-background', 'theme', 'table', 'background', 'Even table row surface'),

    variable('--checkbox-box-background', 'theme', 'checkbox', 'background', 'Unchecked checkbox box', '--input-background'),
    variable('--checkbox-box-background-checked', 'theme', 'checkbox', 'background', 'Checked checkbox box', '--selection-background'),
    variable('--checkbox-box-border', 'theme', 'checkbox', 'border', 'Checkbox box border', '--input-border'),
    variable('--checkbox-box-border-checked', 'theme', 'checkbox', 'border', 'Checked checkbox box border', '--checkbox-box-border'),
    variable('--checkbox-box-size', 'theme', 'checkbox', 'dimension', 'Checkbox box size'),
    variable('--checkbox-box-radius', 'theme', 'checkbox', 'radius', 'Checkbox box corner radius', '--radius-sm'),
    variable('--checkbox-box-shadow', 'theme', 'checkbox', 'shadow', 'Checkbox box elevation'),
    variable('--checkbox-box-shadow-checked', 'theme', 'checkbox', 'shadow', 'Checked checkbox box elevation', '--checkbox-box-shadow'),
    variable('--checkbox-symbol-color', 'theme', 'checkbox', 'color', 'Checkbox symbol', '--selection-color'),
    variable('--checkbox-negative-background', 'theme', 'checkbox', 'background', 'Negative semantic checkbox box', '--palette-status-negative'),
    variable('--checkbox-negative-color', 'theme', 'checkbox', 'color', 'Negative semantic checkbox symbol', '--palette-contrast-light'),
    variable('--checkbox-negative-border', 'theme', 'checkbox', 'border', 'Negative semantic checkbox box border', '--checkbox-box-border-checked'),
    variable('--checkbox-negative-shadow', 'theme', 'checkbox', 'shadow', 'Negative semantic checkbox elevation', '--checkbox-box-shadow-checked'),
    variable('--checkbox-positive-background', 'theme', 'checkbox', 'background', 'Positive semantic checkbox box', '--palette-status-positive'),
    variable('--checkbox-positive-color', 'theme', 'checkbox', 'color', 'Positive semantic checkbox symbol', '--palette-contrast-light'),
    variable('--checkbox-positive-border', 'theme', 'checkbox', 'border', 'Positive semantic checkbox box border', '--checkbox-box-border-checked'),
    variable('--checkbox-positive-shadow', 'theme', 'checkbox', 'shadow', 'Positive semantic checkbox elevation', '--checkbox-box-shadow-checked'),
    variable('--checkbox-neutral-background', 'theme', 'checkbox', 'background', 'Neutral semantic checkbox box', '--palette-status-neutral'),
    variable('--checkbox-neutral-color', 'theme', 'checkbox', 'color', 'Neutral semantic checkbox symbol', '--palette-contrast-light'),
    variable('--checkbox-neutral-border', 'theme', 'checkbox', 'border', 'Neutral semantic checkbox box border', '--checkbox-box-border-checked'),
    variable('--checkbox-neutral-shadow', 'theme', 'checkbox', 'shadow', 'Neutral semantic checkbox elevation', '--checkbox-box-shadow-checked'),
    variable('--radio-box-background-checked', 'theme', 'radio', 'background', 'Selected radio ring surface', '--checkbox-box-background-checked'),
    variable('--radio-box-border-checked', 'theme', 'radio', 'border', 'Selected radio ring border', '--checkbox-box-border-checked'),
    variable('--radio-box-shadow-checked', 'theme', 'radio', 'shadow', 'Selected radio ring elevation', '--checkbox-box-shadow-checked'),
    variable('--radio-symbol-color', 'theme', 'radio', 'color', 'Selected radio dot', '--checkbox-symbol-color'),
    variable('--radio-symbol-size', 'theme', 'radio', 'dimension', 'Selected radio dot size'),
    variable('--radio-group-gap', 'theme', 'radio', 'dimension', 'Spacing between radio options'),

    variable('--toolbar-background', 'theme', 'toolbar', 'background', 'Toolbar surface', '--panel-background'),
    variable('--toolbar-color', 'theme', 'toolbar', 'color', 'Toolbar content', '--panel-color'),
    variable('--toolbar-border', 'theme', 'toolbar', 'border', 'Toolbar border', '--panel-border'),
    variable('--toolbar-shadow', 'theme', 'toolbar', 'shadow', 'Toolbar shadow', '--panel-shadow'),
    variable('--navigation-bar-background', 'theme', 'navigation', 'background', 'Navigation bar surface'),
    variable('--navigation-bar-color', 'theme', 'navigation', 'color', 'Navigation bar content'),
    variable('--navigation-bar-border', 'theme', 'navigation', 'border', 'Navigation bar border'),
    variable('--navigation-bar-shadow', 'theme', 'navigation', 'shadow', 'Navigation bar elevation'),
    variable('--navigation-bar-padding', 'theme', 'navigation', 'dimension', 'Navigation bar inner spacing'),
    variable('--navigation-bar-gap', 'theme', 'navigation', 'dimension', 'Navigation item gap'),
    variable('--navigation-link-color', 'theme', 'navigation', 'color', 'Navigation link content'),
    variable('--navigation-link-color-hover', 'theme', 'navigation', 'color', 'Hovered navigation link content'),
    variable('--navigation-link-color-active', 'theme', 'navigation', 'color', 'Pressed navigation link content'),
    variable('--navigation-link-color-current', 'theme', 'navigation', 'color', 'Current navigation link content'),
    variable('--navigation-link-color-disabled', 'theme', 'navigation', 'color', 'Disabled navigation link content'),
    variable('--navigation-link-background', 'theme', 'navigation', 'background', 'Navigation link surface'),
    variable('--navigation-link-background-hover', 'theme', 'navigation', 'background', 'Hovered navigation link surface'),
    variable('--navigation-link-background-active', 'theme', 'navigation', 'background', 'Pressed navigation link surface'),
    variable('--navigation-link-background-current', 'theme', 'navigation', 'background', 'Current navigation link surface'),
    variable('--navigation-link-background-disabled', 'theme', 'navigation', 'background', 'Disabled navigation link surface'),
    variable('--navigation-link-border', 'theme', 'navigation', 'border', 'Navigation link border'),
    variable('--navigation-link-border-current', 'theme', 'navigation', 'border', 'Current navigation link border'),
    variable('--navigation-link-shadow', 'theme', 'navigation', 'shadow', 'Navigation link elevation'),
    variable('--navigation-link-shadow-current', 'theme', 'navigation', 'shadow', 'Current navigation link elevation'),
    variable('--navigation-link-padding', 'theme', 'navigation', 'dimension', 'Navigation link inner spacing'),
    variable('--navigation-link-radius', 'theme', 'navigation', 'radius', 'Navigation link corner radius'),
    variable('--navigation-link-font-weight-current', 'theme', 'navigation', 'font', 'Current navigation link emphasis'),
    variable('--tabline-background', 'theme', 'tabs', 'background', 'Tab strip surface', '--panel-background'),
    variable('--tab-active-background', 'theme', 'tabs', 'background', 'Active tab surface', '--panel-background'),
    variable('--progress-track-background', 'theme', 'progress', 'background', 'Progress track'),
    variable('--progress-track-color', 'theme', 'progress', 'color', 'Progress track label'),
    variable('--progress-track-shadow', 'theme', 'progress', 'shadow', 'Progress track depth'),
    variable('--progress-value-background', 'theme', 'progress', 'background', 'Progress value'),
    variable('--progress-value-color', 'theme', 'progress', 'color', 'Completed progress label'),
    variable('--progress-value-shadow', 'theme', 'progress', 'shadow', 'Completed progress depth'),
    variable('--working-background-image', 'theme', 'status', 'background', 'Indeterminate/loading texture'),
    variable('--colored-base', 'theme', 'colored', 'color', 'Colored-trait base color', '--palette-primary'),
    variable('--colored-light', 'theme', 'colored', 'color', 'Colored-trait light color', '--palette-primary-light'),
    variable('--colored-dark', 'theme', 'colored', 'color', 'Colored-trait dark color', '--palette-primary-dark'),
    variable('--colored-contrast', 'theme', 'colored', 'color', 'Colored-trait foreground', '--palette-contrast-light'),
    variable('--colored-shadow', 'theme', 'colored', 'shadow', 'Colored-trait depth'),
    variable('--block-graph-block-border', 'theme', 'block graph', 'border', 'Block graph category border', '--ui-border'),
    variable('--block-graph-block-radius', 'theme', 'block graph', 'radius', 'Block graph category radius', '--radius-sm'),
    variable('--block-graph-block-shadow', 'theme', 'block graph', 'shadow', 'Block graph category depth'),
] satisfies readonly CapillaryUiThemeVariableDefinition[])

export const capillaryUiThemeOptions = Object.freeze([
    themeOption('capillary', 'Capillary', distributedAssetUrl('themes/capillary/theme.css'), 'light'),
    themeOption('shiny', 'Shiny', distributedAssetUrl('themes/shiny/theme.css'), 'light'),
    themeOption('soft', 'Soft', distributedAssetUrl('themes/soft/theme.css'), 'light'),
    themeOption('white', 'White', distributedAssetUrl('themes/white/theme.css'), 'light'),
    themeOption('minimal', 'Minimal', distributedAssetUrl('themes/minimal/theme.css'), 'adaptive'),
])

export const capillaryUiColorOptions = Object.freeze([
    option('iceblue', 'Ice blue', distributedAssetUrl('colors/iceblue/colors.css')),
    option('ocean', 'Ocean', distributedAssetUrl('colors/ocean/colors.css')),
    option('green', 'Green', distributedAssetUrl('colors/green/colors.css')),
    option('gray', 'Gray', distributedAssetUrl('colors/gray/colors.css')),
    option('orange', 'Orange', distributedAssetUrl('colors/orange/colors.css')),
    option('purple', 'Purple', distributedAssetUrl('colors/purple/colors.css')),
    option('red', 'Red', distributedAssetUrl('colors/red/colors.css')),
    option('yellow', 'Yellow', distributedAssetUrl('colors/yellow/colors.css')),
])

/** Replace one of the two independently loaded Capillary UI presentation stylesheets. */
export function replaceCapillaryUiStylesheet(
    kind: CapillaryUiStylesheetKind,
    selection: CapillaryUiStylesheetOption,
    targetDocument: Document = globalThis.document,
): HTMLLinkElement {
    assertOption(selection)
    if (targetDocument?.head == null || targetDocument.documentElement == null) {
        throw new TypeError('replaceCapillaryUiStylesheet requires a document with a head and root')
    }

    const selector = `link[data-cap-stylesheet="${kind}"]`
    let link = targetDocument.head.querySelector<HTMLLinkElement>(selector)
    if (link == null) {
        link = targetDocument.createElement('link')
        link.rel = 'stylesheet'
        link.dataset.capStylesheet = kind
        targetDocument.head.append(link)
    }
    link.dataset.capSelection = selection.value
    if (link.getAttribute('href') !== selection.href) link.setAttribute('href', selection.href)

    if (kind === 'theme') targetDocument.documentElement.dataset.theme = selection.value
    else targetDocument.documentElement.dataset.color = selection.value
    return link
}

/**
 * Select how an adaptive Capillary UI theme resolves its light and dark mappings.
 * `system` removes the root attribute so the browser preference applies.
 */
export function setCapillaryUiAppearance(
    appearance: CapillaryUiAppearance,
    targetDocument: Document = globalThis.document,
): void {
    if (targetDocument?.documentElement == null) {
        throw new TypeError('setCapillaryUiAppearance requires a document with a root')
    }
    if (appearance !== 'light' && appearance !== 'dark' && appearance !== 'system') {
        throw new TypeError('Capillary UI appearance must be light, dark, or system')
    }
    if (appearance === 'system') targetDocument.documentElement.removeAttribute('data-appearance')
    else targetDocument.documentElement.dataset.appearance = appearance
}

export function getCapillaryUiAppearance(
    targetDocument: Document = globalThis.document,
): CapillaryUiAppearance {
    if (targetDocument?.documentElement == null) {
        throw new TypeError('getCapillaryUiAppearance requires a document with a root')
    }
    const appearance = targetDocument.documentElement.dataset.appearance
    return appearance === 'light' || appearance === 'dark' ? appearance : 'system'
}

export function findCapillaryUiStylesheetOption(
    options: readonly CapillaryUiStylesheetOption[],
    value: string,
): CapillaryUiStylesheetOption {
    const selection = options.find((option) => option.value === value)
    if (selection == null) throw new RangeError(`Unknown Capillary UI stylesheet selection: ${value}`)
    return selection
}

function variable(
    name: CapillaryUiThemeVariableDefinition['name'],
    layer: CapillaryUiThemeVariableLayer,
    family: string,
    value: CapillaryUiThemeVariableValue,
    description: string,
    fallback?: CapillaryUiThemeVariableDefinition['fallback'],
): CapillaryUiThemeVariableDefinition {
    return fallback == null
        ? Object.freeze({name, layer, family, value, description})
        : Object.freeze({name, layer, family, value, description, fallback})
}

function paletteRamp(family: 'primary' | 'secondary' | 'neutral') {
    return [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((stop) =>
        variable(
            `--palette-${family}-${stop}`,
            'palette',
            family,
            'color',
            `${family[0]?.toUpperCase()}${family.slice(1)} palette stop ${stop}`,
        ))
}

function option(value: string, label: string, href: string): CapillaryUiStylesheetOption {
    return Object.freeze({value, label, href})
}

function themeOption(
    value: string,
    label: string,
    href: string,
    appearance: CapillaryUiThemeAppearanceCapability,
): CapillaryUiThemeOption {
    return Object.freeze({value, label, href, appearance})
}

/**
 * Resolve assets from the published package layout (`dist/index.js` is a
 * sibling of `themes/` and `colors/`). The indirection is deliberate: Vite
 * library mode otherwise turns static CSS URLs into data URLs, which would
 * defeat the separately replaceable stylesheet contract.
 */
function distributedAssetUrl(path: string): string {
    const packageRelativePath = import.meta.url.includes('/src/styling/')
        ? `../../${path}`
        : `../${path}`
    return new URL(packageRelativePath, import.meta.url).href
}

function assertOption(option: unknown): asserts option is CapillaryUiStylesheetOption {
    if (option == null || typeof option !== 'object') {
        throw new TypeError('Capillary UI stylesheet selection must be an option')
    }
    for (const field of ['value', 'label', 'href'] as const) {
        if (typeof Reflect.get(option, field) !== 'string'
            || String(Reflect.get(option, field)).length === 0) {
            throw new TypeError(`Capillary UI stylesheet option ${field} must be a non-empty string`)
        }
    }
}
