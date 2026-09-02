/** Represents the filter mode for a query. */
export const FilterMode = {
    /** Deny mode: Excludes items that match the filter. */
    Deny: '!',
    /** Require mode: Includes only items that match the filter. */
    Require: '_',
    /** Prefer mode: If there are any filter options that are set to Prefer, at least one of the preferred filter options must match. Otherwise, it is treated as Neutral. */
    Prefer: '',
    /** Neutral mode: Does not affect the inclusion or exclusion of items. */
    Neutral: '☐',
} as const

export type FilterModeValue = typeof FilterMode[keyof typeof FilterMode]
