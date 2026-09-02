import type {UrlLike} from '@sylwellsoftware/glue'

import {FilterMode} from '../../../util/filterMode.js'
import type {FilterModeValue} from '../../../util/filterMode.js'

export interface TableSort {
    field: string
    direction: 'asc' | 'desc'
}

export type TableFilterEntry<TValue = unknown> = readonly [
    value: TValue,
    mode: FilterModeValue,
]

export type TableFilters = Record<string, readonly TableFilterEntry[]>

export interface TableQueryState {
    sort?: TableSort | null
    filters?: TableFilters
}

/**
 * Serialize Fray's experimental remote-table wire format.
 *
 * - `sort=field:asc|desc`
 * - repeated `filter=field:mode:JSON(value)` entries
 */
export function serializeTableQuery<TUrl extends UrlLike>(
    url: TUrl,
    {sort = null, filters = {}}: TableQueryState = {},
): TUrl {
    assertUrlLike(url)
    if (sort != null) {
        assertSort(sort)
        url.searchParams.set('sort', `${sort.field}:${sort.direction}`)
    }
    for (const [field, entries] of Object.entries(filters)) {
        for (const [value, mode] of entries) {
            if (!isFilterMode(mode)) {
                throw new TypeError(`Unknown filter mode for ${field}: ${String(mode)}`)
            }
            url.searchParams.append(
                'filter',
                `${field}:${mode}:${JSON.stringify(value)}`,
            )
        }
    }
    return url
}

export function applyLocalTableState<TRow>(
    rows: readonly TRow[],
    sort: TableSort | null,
    filters: TableFilters,
): TRow[] {
    if (!Array.isArray(rows)) throw new TypeError('Local table data must be an array')
    const filtered = rows.filter((row) => matchesFilters(row, filters))
    if (sort == null) return filtered
    assertSort(sort)
    const direction = sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((left, right) =>
        compareValues(readField(left, sort.field), readField(right, sort.field)) * direction)
}

function matchesFilters<TRow>(row: TRow, filters: TableFilters): boolean {
    for (const [field, entries] of Object.entries(filters)) {
        const value = readField(row, field)
        const denied = entries.filter(([, mode]) => mode === FilterMode.Deny)
        if (denied.some(([candidate]) => Object.is(candidate, value))) return false

        const required = entries.filter(([, mode]) => mode === FilterMode.Require)
        if (required.length > 0
            && !required.some(([candidate]) => Object.is(candidate, value))) return false

        const preferred = entries.filter(([, mode]) => mode === FilterMode.Prefer)
        if (preferred.length > 0
            && !preferred.some(([candidate]) => Object.is(candidate, value))) return false
    }
    return true
}

export function assertSort(sort: unknown): asserts sort is TableSort {
    if (sort == null
        || typeof sort !== 'object'
        || typeof Reflect.get(sort, 'field') !== 'string'
        || !isSortDirection(Reflect.get(sort, 'direction'))) {
        throw new TypeError('Table sort must contain a field and asc/desc direction')
    }
}

function isSortDirection(value: unknown): value is TableSort['direction'] {
    return value === 'asc' || value === 'desc'
}

function isFilterMode(value: unknown): value is FilterModeValue {
    return Object.values(FilterMode).some((mode) => mode === value)
}

function compareValues(left: unknown, right: unknown): number {
    if (Object.is(left, right)) return 0
    if (left == null) return -1
    if (right == null) return 1
    if (typeof left === 'number' && typeof right === 'number') return left - right
    return String(left).localeCompare(String(right))
}

function readField(value: unknown, field: string): unknown {
    if (value == null || (typeof value !== 'object' && typeof value !== 'function')) {
        return undefined
    }
    return Reflect.get(value, field)
}

function assertUrlLike(value: unknown): asserts value is UrlLike {
    if (value == null
        || (typeof value !== 'object' && typeof value !== 'function')
        || typeof Reflect.get(value, 'toString') !== 'function') {
        throw new TypeError('Table serializer requires a URL')
    }
    const searchParams = Reflect.get(value, 'searchParams')
    if (searchParams == null
        || typeof Reflect.get(searchParams, 'set') !== 'function'
        || typeof Reflect.get(searchParams, 'append') !== 'function') {
        throw new TypeError('Table serializer requires URL search parameters')
    }
}
