/**
 * Optional replacements for user-facing text authored by Fray itself.
 *
 * Every property is optional so a caller can override only the messages it
 * needs and newer Fray releases can add messages without requiring an
 * application catalog update.
 */
export interface FrayMessageOverrides {
    readonly breadcrumbLabel?: string
    readonly calendarGridLabel?: string
    readonly calendarNextMonthLabel?: string
    readonly calendarPreviousMonthLabel?: string
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
    readonly datePickerDialogLabel?: string
    readonly datePickerOpenCalendarLabel?: string
    readonly dateTimePickerDateLabel?: string
    readonly dateTimePickerTimeLabel?: string
    readonly dialogCloseLabel?: string
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
    readonly themeOptionJavaLabel?: string
    readonly themeOptionMinimalLabel?: string
    readonly themeOptionShinyLabel?: string
    readonly timePickerPlaceholder?: string
    readonly toolbarLabel?: string
    readonly treeViewEmpty?: string
    readonly treeViewLoadError?: string
    readonly treeViewLoading?: string
}

export type FrayMessage<TKey extends keyof FrayMessageOverrides> =
    Exclude<FrayMessageOverrides[TKey], undefined>

/** Static localization selected before a Fray runtime is created. */
export interface FrayLocalizationOptions {
    /** BCP 47 locale used by Fray-owned `Intl` formatting. */
    readonly locale: string
    /** Partial replacements for Fray-authored English messages. */
    readonly messages?: FrayMessageOverrides
}

/** Resolved immutable localization carried by one Fray runtime. */
export interface FrayLocalization {
    /** Canonical configured locale, or `undefined` for the browser default. */
    readonly locale: string | undefined
    /** Resolve one Fray message after per-key English fallback. */
    message<TKey extends keyof FrayMessageOverrides>(key: TKey): FrayMessage<TKey>
}

type ResolvedFrayMessages = {
    readonly [TKey in keyof FrayMessageOverrides]-?: FrayMessage<TKey>
}

const englishFrayMessages = Object.freeze({
    breadcrumbLabel: 'Breadcrumb',
    calendarGridLabel: 'Choose a date',
    calendarNextMonthLabel: 'Next month',
    calendarPreviousMonthLabel: 'Previous month',
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
    datePickerDialogLabel: 'Choose a date',
    datePickerOpenCalendarLabel: 'Open calendar',
    dateTimePickerDateLabel: 'Date',
    dateTimePickerTimeLabel: 'Time',
    dialogCloseLabel: 'Close',
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
    themeOptionJavaLabel: 'Java',
    themeOptionMinimalLabel: 'Minimal',
    themeOptionShinyLabel: 'Shiny',
    timePickerPlaceholder: 'Select time…',
    toolbarLabel: 'Actions',
    treeViewEmpty: 'No tree items',
    treeViewLoadError: 'Unable to load tree items',
    treeViewLoading: 'Loading tree items…',
} satisfies ResolvedFrayMessages)

class RuntimeLocalization implements FrayLocalization {
    readonly locale: string | undefined
    private readonly messages: ResolvedFrayMessages

    constructor(
        locale: string | undefined,
        messages: ResolvedFrayMessages,
    ) {
        this.locale = locale
        this.messages = messages
        Object.freeze(this)
    }

    message<TKey extends keyof FrayMessageOverrides>(key: TKey): FrayMessage<TKey> {
        return this.messages[key] as FrayMessage<TKey>
    }
}

const defaultFrayLocalization: FrayLocalization = new RuntimeLocalization(
    undefined,
    englishFrayMessages,
)

/** @internal Normalize one runtime's static localization without retaining caller mutation. */
export function createRuntimeLocalization(
    options: FrayLocalizationOptions | undefined,
): FrayLocalization {
    if (options == null) return defaultFrayLocalization
    if (typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('Fray localization must be an object')
    }

    const locale = canonicalLocale(options.locale)
    const supplied = options.messages
    if (supplied != null && (typeof supplied !== 'object' || Array.isArray(supplied))) {
        throw new TypeError('Fray localization messages must be an object')
    }

    const resolved = {...englishFrayMessages} as ResolvedFrayMessages
    if (supplied != null) {
        for (const key of Object.keys(englishFrayMessages) as (keyof FrayMessageOverrides)[]) {
            const value = supplied[key]
            if (value === undefined) continue
            const fallback = englishFrayMessages[key]
            if (typeof value !== typeof fallback) {
                throw new TypeError(`Fray localization message "${key}" has the wrong type`)
            }
            Object.assign(resolved, {[key]: value})
        }
    }

    return new RuntimeLocalization(locale, Object.freeze(resolved))
}

function canonicalLocale(locale: unknown): string {
    if (typeof locale !== 'string' || locale.trim() === '') {
        throw new TypeError('Fray localization locale must be a non-empty BCP 47 language tag')
    }
    try {
        return Intl.getCanonicalLocales(locale)[0]!
    } catch (error) {
        throw new RangeError(`Invalid Fray localization locale: ${locale}`, {cause: error})
    }
}
