export type FrayStylesheetKind = 'theme' | 'colors'

export interface FrayStylesheetOption {
    value: string
    label: string
    href: string
}

export type FrayThemeVariableLayer = 'palette' | 'theme'
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
    name: `--${string}`
    layer: FrayThemeVariableLayer
    family: string
    value: FrayThemeVariableValue
    description: string
    fallback?: `--${string}`
}

/**
 * Public, machine-readable theming contract. Component-specific variables fall
 * back through a family rather than forcing every theme to target every host.
 */
export const frayThemeVariableCatalog = Object.freeze([
    ...paletteRamp('primary'),
    ...paletteRamp('secondary'),
    ...paletteRamp('neutral'),
    variable('--palette-primary', 'palette', 'primary', 'color', 'Primary anchor color', '--palette-primary-500'),
    variable('--palette-primary-light', 'palette', 'primary', 'color', 'Light primary color', '--palette-primary-200'),
    variable('--palette-primary-dark', 'palette', 'primary', 'color', 'Dark primary color', '--palette-primary-800'),
    variable('--palette-secondary', 'palette', 'secondary', 'color', 'Secondary anchor color', '--palette-secondary-500'),
    variable('--palette-secondary-light', 'palette', 'secondary', 'color', 'Light secondary color', '--palette-secondary-200'),
    variable('--palette-secondary-dark', 'palette', 'secondary', 'color', 'Dark secondary color', '--palette-secondary-800'),
    variable('--palette-neutral', 'palette', 'neutral', 'color', 'Neutral anchor color', '--palette-neutral-500'),
    variable('--palette-neutral-light', 'palette', 'neutral', 'color', 'Light neutral color', '--palette-neutral-200'),
    variable('--palette-neutral-dark', 'palette', 'neutral', 'color', 'Dark neutral color', '--palette-neutral-800'),
    variable('--palette-light', 'palette', 'contrast', 'color', 'Light endpoint'),
    variable('--palette-dark', 'palette', 'contrast', 'color', 'Dark endpoint'),
    variable('--palette-contrast-light', 'palette', 'contrast', 'color', 'Light contrasting foreground', '--palette-light'),
    variable('--palette-contrast-dark', 'palette', 'contrast', 'color', 'Dark contrasting foreground', '--palette-dark'),
    variable('--palette-red', 'palette', 'hue', 'color', 'Red palette color'),
    variable('--palette-green', 'palette', 'hue', 'color', 'Green palette color'),

    variable('--font-family', 'theme', 'typography', 'font', 'UI font stack'),
    variable('--font-size', 'theme', 'typography', 'dimension', 'Base UI font size'),
    variable('--line-height', 'theme', 'typography', 'dimension', 'Base UI line height'),
    variable('--control-min-height', 'theme', 'control', 'dimension', 'Minimum control height'),
    variable('--space-xs', 'theme', 'spacing', 'dimension', 'Extra-small spacing'),
    variable('--space-sm', 'theme', 'spacing', 'dimension', 'Small spacing'),
    variable('--space-md', 'theme', 'spacing', 'dimension', 'Medium spacing'),
    variable('--space-lg', 'theme', 'spacing', 'dimension', 'Large spacing'),
    variable('--radius-sm', 'theme', 'shape', 'radius', 'Small corner radius'),
    variable('--radius-md', 'theme', 'shape', 'radius', 'Ordinary corner radius'),
    variable('--radius-lg', 'theme', 'shape', 'radius', 'Large corner radius'),
    variable('--motion-fast', 'theme', 'motion', 'duration', 'Fast interaction transition'),

    variable('--ui-background', 'theme', 'surface', 'background', 'Default UI background'),
    variable('--ui-color', 'theme', 'surface', 'color', 'Default UI text'),
    variable('--ui-border', 'theme', 'surface', 'border', 'Default UI border'),
    variable('--ui-shadow', 'theme', 'surface', 'shadow', 'Default raised shadow'),
    variable('--focus-ring', 'theme', 'focus', 'shadow', 'Keyboard focus ring'),
    variable('--focus-color', 'theme', 'focus', 'color', 'Keyboard focus color'),
    variable('--error-color', 'theme', 'status', 'color', 'Error state color'),
    variable('--error-contrast', 'theme', 'status', 'color', 'Content on an error surface'),
    variable('--success-color', 'theme', 'status', 'color', 'Success state color'),

    variable('--panel-background', 'theme', 'panel', 'background', 'Panel surface', '--ui-background'),
    variable('--panel-color', 'theme', 'panel', 'color', 'Panel content', '--ui-color'),
    variable('--panel-border', 'theme', 'panel', 'border', 'Panel border', '--ui-border'),
    variable('--panel-shadow', 'theme', 'panel', 'shadow', 'Panel shadow', '--ui-shadow'),
    variable('--panel-radius', 'theme', 'panel', 'radius', 'Panel radius', '--radius-md'),
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
    variable('--panel-header-background', 'theme', 'header', 'background', 'Panel header surface', '--section-header-background'),
    variable('--panel-header-color', 'theme', 'header', 'color', 'Panel header content', '--section-header-color'),
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
    variable('--checkbox-symbol-color', 'theme', 'checkbox', 'color', 'Checkbox symbol', '--selection-color'),
    variable('--radio-background', 'theme', 'radio', 'background', 'Radio/toggle option surface', '--toggle-button-background'),
    variable('--radio-background-checked', 'theme', 'radio', 'background', 'Selected radio/toggle option', '--selection-background'),

    variable('--toolbar-background', 'theme', 'toolbar', 'background', 'Toolbar surface', '--panel-background'),
    variable('--toolbar-color', 'theme', 'toolbar', 'color', 'Toolbar content', '--panel-color'),
    variable('--toolbar-border', 'theme', 'toolbar', 'border', 'Toolbar border', '--panel-border'),
    variable('--toolbar-shadow', 'theme', 'toolbar', 'shadow', 'Toolbar shadow', '--panel-shadow'),
    variable('--tabline-background', 'theme', 'tabs', 'background', 'Tab strip surface', '--panel-background'),
    variable('--tab-active-background', 'theme', 'tabs', 'background', 'Active tab surface', '--panel-background'),
    variable('--progress-track-background', 'theme', 'progress', 'background', 'Progress track'),
    variable('--progress-value-background', 'theme', 'progress', 'background', 'Progress value'),
    variable('--working-background-image', 'theme', 'status', 'background', 'Indeterminate/loading texture'),
    variable('--colored-base', 'theme', 'colored', 'color', 'Colored-trait base color', '--palette-primary'),
    variable('--colored-light', 'theme', 'colored', 'color', 'Colored-trait light color', '--palette-primary-light'),
    variable('--colored-dark', 'theme', 'colored', 'color', 'Colored-trait dark color', '--palette-primary-dark'),
    variable('--colored-contrast', 'theme', 'colored', 'color', 'Colored-trait foreground', '--palette-contrast-light'),
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

    if (kind === 'theme') targetDocument.documentElement.dataset.theme = selection.value
    else targetDocument.documentElement.dataset.color = selection.value
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
