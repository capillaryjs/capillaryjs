/**
 * Optional replacements for user-facing text authored by Capillary UI itself.
 *
 * Every property is optional so a caller can override only the messages it
 * needs and newer Capillary UI releases can add messages without requiring an
 * application catalog update.
 */
export interface CapillaryUiMessageOverrides {
    readonly breadcrumbLabel?: string
    readonly checkboxOptionLabel?: string
    readonly checkboxStateLabel?: (label: string, state: string) => string
    readonly colorOptionGrayLabel?: string
    readonly colorOptionGreenLabel?: string
    readonly colorOptionIceBlueLabel?: string
    readonly colorOptionOceanLabel?: string
    readonly colorOptionOrangeLabel?: string
    readonly colorOptionPurpleLabel?: string
    readonly colorOptionRedLabel?: string
    readonly colorOptionYellowLabel?: string
    readonly dataTableEmpty?: string
    readonly dataTableLoadError?: string
    readonly dataTableLoading?: string
    readonly dataTableRetry?: string
    readonly dialogCloseLabel?: string
    readonly dropdownLoadError?: string
    readonly dropdownPlaceholder?: string
    readonly filterModeDenyLabel?: string
    readonly filterModeNeutralLabel?: string
    readonly filterModePreferLabel?: string
    readonly filterModeRequireLabel?: string
    readonly filterPanelEmpty?: string
    readonly filterPanelLabel?: string
    readonly filterPanelLoadError?: string
    readonly filterPanelLoading?: string
    readonly listViewEmpty?: string
    readonly listViewLabel?: string
    readonly listViewLoadError?: string
    readonly listViewLoading?: string
    readonly progressInProgress?: string
    readonly radioOptionLabel?: string
    readonly splitViewSeparatorLabel?: string
    readonly tabLineLabel?: string
    readonly tableFilterColumnLabel?: (label: string) => string
    readonly tableSortColumnLabel?: (label: string) => string
    readonly themeOptionCapillaryLabel?: string
    readonly themeOptionMinimalLabel?: string
    readonly themeOptionShinyLabel?: string
    readonly toolbarLabel?: string
    readonly treeViewEmpty?: string
    readonly treeViewLoadError?: string
    readonly treeViewLoading?: string
}

export type CapillaryUiMessage<TKey extends keyof CapillaryUiMessageOverrides> =
    Exclude<CapillaryUiMessageOverrides[TKey], undefined>

/** Static localization selected before a Capillary UI runtime is created. */
export interface CapillaryUiLocalizationOptions {
    /** BCP 47 locale used by Capillary UI-owned `Intl` formatting. */
    readonly locale: string
    /** Partial replacements for Capillary UI-authored English messages. */
    readonly messages?: CapillaryUiMessageOverrides
}

/** Resolved immutable localization carried by one Capillary UI runtime. */
export interface CapillaryUiLocalization {
    /** Canonical configured locale, or `undefined` for the browser default. */
    readonly locale: string | undefined
    /** Resolve one Capillary UI message after per-key English fallback. */
    message<TKey extends keyof CapillaryUiMessageOverrides>(key: TKey): CapillaryUiMessage<TKey>
}

type ResolvedCapillaryUiMessages = {
    readonly [TKey in keyof CapillaryUiMessageOverrides]-?: CapillaryUiMessage<TKey>
}

const englishCapillaryUiMessages = Object.freeze({
    breadcrumbLabel: 'Breadcrumb',
    checkboxOptionLabel: 'Option',
    checkboxStateLabel: (label: string, state: string) => `${label}: ${state}`,
    colorOptionGrayLabel: 'Gray',
    colorOptionGreenLabel: 'Green',
    colorOptionIceBlueLabel: 'Ice blue',
    colorOptionOceanLabel: 'Ocean',
    colorOptionOrangeLabel: 'Orange',
    colorOptionPurpleLabel: 'Purple',
    colorOptionRedLabel: 'Red',
    colorOptionYellowLabel: 'Yellow',
    dataTableEmpty: 'No rows',
    dataTableLoadError: 'Unable to load rows',
    dataTableLoading: 'Loading rows…',
    dataTableRetry: 'Retry',
    dialogCloseLabel: 'Close',
    dropdownLoadError: 'Unable to load options',
    dropdownPlaceholder: 'Select…',
    filterModeDenyLabel: 'deny',
    filterModeNeutralLabel: 'neutral',
    filterModePreferLabel: 'prefer',
    filterModeRequireLabel: 'require',
    filterPanelEmpty: 'No filter options',
    filterPanelLabel: 'Filter options',
    filterPanelLoadError: 'Unable to load filter options',
    filterPanelLoading: 'Loading filter options…',
    listViewEmpty: 'No items',
    listViewLabel: 'Items',
    listViewLoadError: 'Unable to load items',
    listViewLoading: 'Loading items…',
    progressInProgress: 'In progress',
    radioOptionLabel: 'Option',
    splitViewSeparatorLabel: 'Resize panes',
    tabLineLabel: 'Sections',
    tableFilterColumnLabel: (label: string) => `Filter ${label}`,
    tableSortColumnLabel: (label: string) => `Sort ${label}`,
    themeOptionCapillaryLabel: 'Capillary',
    themeOptionMinimalLabel: 'Minimal',
    themeOptionShinyLabel: 'Shiny',
    toolbarLabel: 'Actions',
    treeViewEmpty: 'No tree items',
    treeViewLoadError: 'Unable to load tree items',
    treeViewLoading: 'Loading tree items…',
} satisfies ResolvedCapillaryUiMessages)

class RuntimeLocalization implements CapillaryUiLocalization {
    readonly locale: string | undefined
    private readonly messages: ResolvedCapillaryUiMessages

    constructor(
        locale: string | undefined,
        messages: ResolvedCapillaryUiMessages,
    ) {
        this.locale = locale
        this.messages = messages
        Object.freeze(this)
    }

    message<TKey extends keyof CapillaryUiMessageOverrides>(key: TKey): CapillaryUiMessage<TKey> {
        return this.messages[key] as CapillaryUiMessage<TKey>
    }
}

const defaultCapillaryUiLocalization: CapillaryUiLocalization = new RuntimeLocalization(
    undefined,
    englishCapillaryUiMessages,
)

/** @internal Normalize one runtime's static localization without retaining caller mutation. */
export function createRuntimeLocalization(
    options: CapillaryUiLocalizationOptions | undefined,
): CapillaryUiLocalization {
    if (options == null) return defaultCapillaryUiLocalization
    if (typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('Capillary UI localization must be an object')
    }

    const locale = canonicalLocale(options.locale)
    const supplied = options.messages
    if (supplied != null && (typeof supplied !== 'object' || Array.isArray(supplied))) {
        throw new TypeError('Capillary UI localization messages must be an object')
    }

    const resolved = {...englishCapillaryUiMessages} as ResolvedCapillaryUiMessages
    if (supplied != null) {
        for (const key of Object.keys(englishCapillaryUiMessages) as (keyof CapillaryUiMessageOverrides)[]) {
            const value = supplied[key]
            if (value === undefined) continue
            const fallback = englishCapillaryUiMessages[key]
            if (typeof value !== typeof fallback) {
                throw new TypeError(`Capillary UI localization message "${key}" has the wrong type`)
            }
            Object.assign(resolved, {[key]: value})
        }
    }

    return new RuntimeLocalization(locale, Object.freeze(resolved))
}

function canonicalLocale(locale: unknown): string {
    if (typeof locale !== 'string' || locale.trim() === '') {
        throw new TypeError('Capillary UI localization locale must be a non-empty BCP 47 language tag')
    }
    try {
        return Intl.getCanonicalLocales(locale)[0]!
    } catch (error) {
        throw new RangeError(`Invalid Capillary UI localization locale: ${locale}`, {cause: error})
    }
}
