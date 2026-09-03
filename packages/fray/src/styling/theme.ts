export type FrayStylesheetKind = 'theme' | 'colors'

export interface FrayStylesheetOption {
    value: string
    label: string
    href: string
}

export type FrayThemeVariableLayer = 'color' | 'theme'
export type FrayThemeVariableValue =
    | 'background'
    | 'border'
    | 'color'
    | 'dimension'
    | 'duration'
    | 'font'
    | 'radius'
    | 'shadow'

export interface FrayThemeVariableDefinition {
    name: `--fray-${string}`
    layer: FrayThemeVariableLayer
    family: string
    value: FrayThemeVariableValue
    description: string
    fallback?: `--fray-${string}`
}

/**
 * Public, machine-readable theming contract. Component-specific variables fall
 * back through a family rather than forcing every theme to target every host.
 */
export const frayThemeVariableCatalog = Object.freeze([
    variable('--fray-color-canvas', 'color', 'palette', 'color', 'Application canvas'),
    variable('--fray-color-surface', 'color', 'palette', 'color', 'Primary surface'),
    variable('--fray-color-surface-muted', 'color', 'palette', 'color', 'Subdued surface'),
    variable('--fray-color-surface-raised', 'color', 'palette', 'color', 'Raised surface'),
    variable('--fray-color-surface-inset', 'color', 'palette', 'color', 'Inset surface'),
    variable('--fray-color-text', 'color', 'palette', 'color', 'Primary text'),
    variable('--fray-color-text-muted', 'color', 'palette', 'color', 'Secondary text'),
    variable('--fray-color-border', 'color', 'palette', 'color', 'Ordinary border'),
    variable('--fray-color-border-strong', 'color', 'palette', 'color', 'Emphasized border'),
    variable('--fray-color-primary', 'color', 'palette', 'color', 'Primary accent'),
    variable('--fray-color-primary-hover', 'color', 'palette', 'color', 'Hovered accent'),
    variable('--fray-color-primary-active', 'color', 'palette', 'color', 'Active accent'),
    variable('--fray-color-primary-soft', 'color', 'palette', 'color', 'Subtle accent surface'),
    variable('--fray-color-on-primary', 'color', 'palette', 'color', 'Content on primary accent'),
    variable('--fray-color-focus', 'color', 'palette', 'color', 'Keyboard focus indication'),
    variable('--fray-color-selection', 'color', 'palette', 'color', 'Selected item surface'),
    variable('--fray-color-on-selection', 'color', 'palette', 'color', 'Content on selection'),
    variable('--fray-color-disabled', 'color', 'palette', 'color', 'Disabled surface'),
    variable('--fray-color-on-disabled', 'color', 'palette', 'color', 'Disabled content'),
    variable('--fray-color-error', 'color', 'status', 'color', 'Error state'),
    variable('--fray-color-on-error', 'color', 'status', 'color', 'Content on error'),
    variable('--fray-color-success', 'color', 'status', 'color', 'Success state'),
    variable('--fray-color-on-success', 'color', 'status', 'color', 'Content on success'),
    variable('--fray-color-highlight', 'color', 'palette', 'color', 'Light reflection/highlight'),
    variable('--fray-color-shadow', 'color', 'palette', 'color', 'Shadow tint'),

    variable('--fray-font-family', 'theme', 'typography', 'font', 'UI font stack'),
    variable('--fray-font-size', 'theme', 'typography', 'dimension', 'Base UI font size'),
    variable('--fray-line-height', 'theme', 'typography', 'dimension', 'Base UI line height'),
    variable('--fray-control-min-height', 'theme', 'control', 'dimension', 'Minimum control height'),
    variable('--fray-space-xs', 'theme', 'spacing', 'dimension', 'Extra-small spacing'),
    variable('--fray-space-sm', 'theme', 'spacing', 'dimension', 'Small spacing'),
    variable('--fray-space-md', 'theme', 'spacing', 'dimension', 'Medium spacing'),
    variable('--fray-space-lg', 'theme', 'spacing', 'dimension', 'Large spacing'),
    variable('--fray-radius-sm', 'theme', 'shape', 'radius', 'Small corner radius'),
    variable('--fray-radius-md', 'theme', 'shape', 'radius', 'Ordinary corner radius'),
    variable('--fray-radius-lg', 'theme', 'shape', 'radius', 'Large corner radius'),
    variable('--fray-motion-fast', 'theme', 'motion', 'duration', 'Fast interaction transition'),

    variable('--fray-ui-background', 'theme', 'surface', 'background', 'Default UI background'),
    variable('--fray-ui-color', 'theme', 'surface', 'color', 'Default UI text'),
    variable('--fray-ui-border', 'theme', 'surface', 'border', 'Default UI border'),
    variable('--fray-ui-shadow', 'theme', 'surface', 'shadow', 'Default raised shadow'),
    variable('--fray-focus-ring', 'theme', 'focus', 'shadow', 'Keyboard focus ring'),

    variable('--fray-panel-background', 'theme', 'panel', 'background', 'Panel surface', '--fray-ui-background'),
    variable('--fray-panel-color', 'theme', 'panel', 'color', 'Panel content', '--fray-ui-color'),
    variable('--fray-panel-border', 'theme', 'panel', 'border', 'Panel border', '--fray-ui-border'),
    variable('--fray-panel-shadow', 'theme', 'panel', 'shadow', 'Panel shadow', '--fray-ui-shadow'),
    variable('--fray-panel-radius', 'theme', 'panel', 'radius', 'Panel radius', '--fray-radius-md'),
    variable('--fray-dialog-shadow', 'theme', 'dialog', 'shadow', 'Modal dialog shadow', '--fray-panel-shadow'),
    variable('--fray-dialog-backdrop-background', 'theme', 'dialog', 'background', 'Modal backdrop'),

    variable('--fray-header-background', 'theme', 'header', 'background', 'Generic header surface'),
    variable('--fray-header-color', 'theme', 'header', 'color', 'Generic header content'),
    variable('--fray-header-border', 'theme', 'header', 'border', 'Generic header border'),
    variable('--fray-header-shadow', 'theme', 'header', 'shadow', 'Generic header shadow'),
    variable('--fray-section-header-background', 'theme', 'header', 'background', 'Section header surface', '--fray-header-background'),
    variable('--fray-section-header-color', 'theme', 'header', 'color', 'Section header content', '--fray-header-color'),
    variable('--fray-section-header-border', 'theme', 'header', 'border', 'Section header border', '--fray-header-border'),
    variable('--fray-section-header-shadow', 'theme', 'header', 'shadow', 'Section header shadow', '--fray-header-shadow'),
    variable('--fray-panel-header-background', 'theme', 'header', 'background', 'Panel header surface', '--fray-section-header-background'),
    variable('--fray-panel-header-color', 'theme', 'header', 'color', 'Panel header content', '--fray-section-header-color'),
    variable('--fray-table-header-background', 'theme', 'header', 'background', 'Table header surface', '--fray-section-header-background'),
    variable('--fray-table-header-color', 'theme', 'header', 'color', 'Table header content', '--fray-section-header-color'),
    variable('--fray-dialog-header-background', 'theme', 'header', 'background', 'Dialog header surface', '--fray-section-header-background'),
    variable('--fray-dialog-header-color', 'theme', 'header', 'color', 'Dialog header content', '--fray-section-header-color'),

    variable('--fray-button-background', 'theme', 'button', 'background', 'Generic button surface'),
    variable('--fray-button-background-hover', 'theme', 'button', 'background', 'Hovered button surface'),
    variable('--fray-button-background-active', 'theme', 'button', 'background', 'Pressed button surface'),
    variable('--fray-button-background-disabled', 'theme', 'button', 'background', 'Disabled button surface'),
    variable('--fray-button-color', 'theme', 'button', 'color', 'Generic button content'),
    variable('--fray-button-border', 'theme', 'button', 'border', 'Generic button border'),
    variable('--fray-button-shadow', 'theme', 'button', 'shadow', 'Generic button shadow'),
    variable('--fray-button-shadow-active', 'theme', 'button', 'shadow', 'Pressed button shadow'),
    variable('--fray-toggle-button-background', 'theme', 'button', 'background', 'Toggle option surface', '--fray-button-background'),
    variable('--fray-toggle-button-background-checked', 'theme', 'button', 'background', 'Selected toggle option', '--fray-selection-background'),
    variable('--fray-tab-button-background', 'theme', 'button', 'background', 'Tab surface', '--fray-button-background'),
    variable('--fray-tab-button-background-active', 'theme', 'button', 'background', 'Active tab surface', '--fray-tab-active-background'),
    variable('--fray-menu-button-background', 'theme', 'button', 'background', 'Menu action surface', '--fray-button-background'),
    variable('--fray-dropdown-trigger-background', 'theme', 'button', 'background', 'Dropdown arrow/trigger surface', '--fray-button-background'),
    variable('--fray-table-header-button-background', 'theme', 'button', 'background', 'Table-header action surface', '--fray-button-background'),

    variable('--fray-input-background', 'theme', 'input', 'background', 'Input surface'),
    variable('--fray-input-color', 'theme', 'input', 'color', 'Input content'),
    variable('--fray-input-border', 'theme', 'input', 'border', 'Input border'),
    variable('--fray-input-shadow', 'theme', 'input', 'shadow', 'Input shadow'),
    variable('--fray-input-background-disabled', 'theme', 'input', 'background', 'Disabled input surface'),
    variable('--fray-input-color-disabled', 'theme', 'input', 'color', 'Disabled input content'),

    variable('--fray-selection-background', 'theme', 'selection', 'background', 'Selected item surface'),
    variable('--fray-selection-color', 'theme', 'selection', 'color', 'Selected item content'),
    variable('--fray-row-hover-background', 'theme', 'row', 'background', 'Hovered list/table/tree row'),
    variable('--fray-table-row-background', 'theme', 'table', 'background', 'Odd table row surface'),
    variable('--fray-table-row-alt-background', 'theme', 'table', 'background', 'Even table row surface'),

    variable('--fray-checkbox-box-background', 'theme', 'checkbox', 'background', 'Unchecked checkbox box', '--fray-input-background'),
    variable('--fray-checkbox-box-background-checked', 'theme', 'checkbox', 'background', 'Checked checkbox box', '--fray-selection-background'),
    variable('--fray-checkbox-box-border', 'theme', 'checkbox', 'border', 'Checkbox box border', '--fray-input-border'),
    variable('--fray-checkbox-symbol-color', 'theme', 'checkbox', 'color', 'Checkbox symbol', '--fray-selection-color'),
    variable('--fray-radio-background', 'theme', 'radio', 'background', 'Radio/toggle option surface', '--fray-toggle-button-background'),
    variable('--fray-radio-background-checked', 'theme', 'radio', 'background', 'Selected radio/toggle option', '--fray-selection-background'),

    variable('--fray-toolbar-background', 'theme', 'toolbar', 'background', 'Toolbar surface', '--fray-panel-background'),
    variable('--fray-toolbar-color', 'theme', 'toolbar', 'color', 'Toolbar content', '--fray-panel-color'),
    variable('--fray-toolbar-border', 'theme', 'toolbar', 'border', 'Toolbar border', '--fray-panel-border'),
    variable('--fray-toolbar-shadow', 'theme', 'toolbar', 'shadow', 'Toolbar shadow', '--fray-panel-shadow'),
    variable('--fray-tabline-background', 'theme', 'tabs', 'background', 'Tab strip surface', '--fray-panel-background'),
    variable('--fray-tab-active-background', 'theme', 'tabs', 'background', 'Active tab surface', '--fray-panel-background'),
    variable('--fray-progress-track-background', 'theme', 'progress', 'background', 'Progress track'),
    variable('--fray-progress-value-background', 'theme', 'progress', 'background', 'Progress value'),
    variable('--fray-working-background-image', 'theme', 'status', 'background', 'Indeterminate/loading texture'),
] satisfies readonly FrayThemeVariableDefinition[])

export const frayThemeOptions = Object.freeze([
    option('shiny', 'Shiny', distributedAssetUrl('themes/shiny/theme.css')),
    option('java', 'Java', distributedAssetUrl('themes/java/theme.css')),
    option('minimal', 'Minimal', distributedAssetUrl('themes/minimal/theme.css')),
])

export const frayColorOptions = Object.freeze([
    option('iceblue', 'Ice blue', distributedAssetUrl('colors/iceblue/colors.css')),
    option('ocean', 'Ocean', distributedAssetUrl('colors/ocean/colors.css')),
    option('green', 'Green', distributedAssetUrl('colors/green/colors.css')),
    option('gray', 'Gray', distributedAssetUrl('colors/gray/colors.css')),
    option('orange', 'Orange', distributedAssetUrl('colors/orange/colors.css')),
    option('purple', 'Purple', distributedAssetUrl('colors/purple/colors.css')),
    option('red', 'Red', distributedAssetUrl('colors/red/colors.css')),
    option('yellow', 'Yellow', distributedAssetUrl('colors/yellow/colors.css')),
])

/** Replace one of the two independently loaded Fray presentation stylesheets. */
export function replaceFrayStylesheet(
    kind: FrayStylesheetKind,
    selection: FrayStylesheetOption,
    targetDocument: Document = globalThis.document,
): HTMLLinkElement {
    assertOption(selection)
    if (targetDocument?.head == null || targetDocument.documentElement == null) {
        throw new TypeError('replaceFrayStylesheet requires a document with a head and root')
    }

    const selector = `link[data-fray-stylesheet="${kind}"]`
    let link = targetDocument.head.querySelector<HTMLLinkElement>(selector)
    if (link == null) {
        link = targetDocument.createElement('link')
        link.rel = 'stylesheet'
        link.dataset.frayStylesheet = kind
        targetDocument.head.append(link)
    }
    link.dataset.fraySelection = selection.value
    if (link.getAttribute('href') !== selection.href) link.setAttribute('href', selection.href)

    if (kind === 'theme') targetDocument.documentElement.dataset.frayTheme = selection.value
    else targetDocument.documentElement.dataset.frayColor = selection.value
    return link
}

export function findFrayStylesheetOption(
    options: readonly FrayStylesheetOption[],
    value: string,
): FrayStylesheetOption {
    const selection = options.find((option) => option.value === value)
    if (selection == null) throw new RangeError(`Unknown Fray stylesheet selection: ${value}`)
    return selection
}

function variable(
    name: FrayThemeVariableDefinition['name'],
    layer: FrayThemeVariableLayer,
    family: string,
    value: FrayThemeVariableValue,
    description: string,
    fallback?: FrayThemeVariableDefinition['fallback'],
): FrayThemeVariableDefinition {
    return fallback == null
        ? Object.freeze({name, layer, family, value, description})
        : Object.freeze({name, layer, family, value, description, fallback})
}

function option(value: string, label: string, href: string): FrayStylesheetOption {
    return Object.freeze({value, label, href})
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

function assertOption(option: unknown): asserts option is FrayStylesheetOption {
    if (option == null || typeof option !== 'object') {
        throw new TypeError('Fray stylesheet selection must be an option')
    }
    for (const field of ['value', 'label', 'href'] as const) {
        if (typeof Reflect.get(option, field) !== 'string'
            || String(Reflect.get(option, field)).length === 0) {
            throw new TypeError(`Fray stylesheet option ${field} must be a non-empty string`)
        }
    }
}
