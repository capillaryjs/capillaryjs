/** Represents the filter mode for a query. */
export const FilterMode = {
    /** Deny mode: Excludes items that match the filter. */
    Deny: 'deny',
    /** Require mode: Includes only items that match the filter. */
    Require: 'require',
    /** Prefer mode: If there are any filter options that are set to Prefer, at least one of the preferred filter options must match. Otherwise, it is treated as Neutral. */
    Prefer: 'prefer',
    /** Neutral mode: Does not affect the inclusion or exclusion of items. */
    Neutral: 'neutral',
} as const

export type FilterModeValue = typeof FilterMode[keyof typeof FilterMode]

/** Return whether a value is one of Fray's semantic filter modes. */
export function isFilterMode(value: unknown): value is FilterModeValue {
    return Object.values(FilterMode).some((mode) => mode === value)
}
