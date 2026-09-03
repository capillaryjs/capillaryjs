import {DerivedEmitter} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'

import {FilterMode, isFilterMode} from '../../util/filterMode.js'
import type {FilterModeValue} from '../../util/filterMode.js'

export type FilterOptionState = Readonly<Record<string, FilterModeValue>>
export type FilterState = Readonly<Record<string, FilterOptionState>>

export interface SerializedFilterState {
    readonly version: 1
    readonly dimensions: Record<string, Record<string, FilterModeValue>>
}

export interface FilterOptionDefinition<TItem> {
    /** Stable persisted identity within its dimension. */
    key: string
    matches: (item: TItem) => boolean
}

export interface FilterDimensionDefinition<TItem> {
    /** Stable persisted identity for the dimension. */
    key: string
    options: readonly FilterOptionDefinition<TItem>[]
}

/**
 * Test an item against semantic filter state.
 *
 * Dimensions combine with AND. Within one dimension, deny wins, every required
 * option must match, and at least one preferred option must match when any are
 * active. Unknown persisted dimensions and options are retained by
 * serialization but do not constrain matching.
 */
export function matchesFilterState<TItem>(
    item: TItem,
    state: FilterState,
    dimensions: readonly FilterDimensionDefinition<TItem>[],
): boolean {
    assertDefinitions(dimensions)
    for (const dimension of dimensions) {
        const optionState = state[dimension.key]
        if (optionState == null) continue
        const active = dimension.options.flatMap((option) => {
            const mode = optionState[option.key]
            return mode == null || mode === FilterMode.Neutral ? [] : [{option, mode}]
        })
        if (active.some(({option, mode}) => mode === FilterMode.Deny && option.matches(item))) {
            return false
        }
        const required = active.filter(({mode}) => mode === FilterMode.Require)
        if (required.some(({option}) => !option.matches(item))) {
            return false
        }
        const preferred = active.filter(({mode}) => mode === FilterMode.Prefer)
        if (preferred.length > 0 && !preferred.some(({option}) => option.matches(item))) {
            return false
        }
    }
    return true
}

export function filterByState<TItem>(
    items: readonly TItem[],
    state: FilterState,
    dimensions: readonly FilterDimensionDefinition<TItem>[],
): TItem[] {
    if (!Array.isArray(items)) throw new TypeError('Filtered items must be an array')
    return items.filter((item) => matchesFilterState(item, state, dimensions))
}

/** Derive a reusable predicate without giving Fray ownership of persistence. */
export function deriveFilterPredicate<TItem>(
    state: ReadableEmitter<FilterState, unknown>,
    dimensions: readonly FilterDimensionDefinition<TItem>[],
    owner: unknown = null,
): DerivedEmitter<(item: TItem) => boolean, readonly [ReadableEmitter<FilterState, unknown>]> {
    assertDefinitions(dimensions)
    return new DerivedEmitter(
        [state] as const,
        ([current]) => (item: TItem) => matchesFilterState(item, current, dimensions),
        {owner, purpose: 'filter predicate'},
    )
}

/** Derive a filtered collection from application-owned items and filter state. */
export function deriveFilteredItems<TItem>(
    items: ReadableEmitter<readonly TItem[], unknown>,
    state: ReadableEmitter<FilterState, unknown>,
    dimensions: readonly FilterDimensionDefinition<TItem>[],
    owner: unknown = null,
): DerivedEmitter<
    TItem[],
    readonly [ReadableEmitter<readonly TItem[], unknown>, ReadableEmitter<FilterState, unknown>]
> {
    assertDefinitions(dimensions)
    return new DerivedEmitter(
        [items, state] as const,
        ([currentItems, currentState]) => filterByState(currentItems, currentState, dimensions),
        {owner, purpose: 'filtered items'},
    )
}

/** Convert state to deterministic, versioned, plain JSON-compatible data. */
export function serializeFilterState(state: FilterState): SerializedFilterState {
    assertFilterState(state)
    const dimensions: Record<string, Record<string, FilterModeValue>> = {}
    for (const dimensionKey of Object.keys(state).sort()) {
        const options: Record<string, FilterModeValue> = {}
        const dimension = state[dimensionKey]!
        for (const optionKey of Object.keys(dimension).sort()) {
            options[optionKey] = dimension[optionKey]!
        }
        dimensions[dimensionKey] = options
    }
    return {version: 1, dimensions}
}

/** Validate and restore versioned filter data. Unknown keys are preserved. */
export function parseFilterState(value: unknown): FilterState {
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.dimensions)) {
        throw new TypeError('Filter state must use version 1 with a dimensions object')
    }
    const state: Record<string, Record<string, FilterModeValue>> = {}
    for (const [dimensionKey, rawOptions] of Object.entries(value.dimensions)) {
        assertKey(dimensionKey, 'Filter dimension')
        if (!isRecord(rawOptions)) {
            throw new TypeError(`Filter dimension ${dimensionKey} must be an object`)
        }
        const options: Record<string, FilterModeValue> = {}
        for (const [optionKey, mode] of Object.entries(rawOptions)) {
            assertKey(optionKey, `Filter option in ${dimensionKey}`)
            if (!isFilterMode(mode)) {
                throw new TypeError(
                    `Unknown filter mode for ${dimensionKey}.${optionKey}: ${String(mode)}`,
                )
            }
            options[optionKey] = mode
        }
        state[dimensionKey] = options
    }
    return state
}

function assertFilterState(value: unknown): asserts value is FilterState {
    if (!isRecord(value)) throw new TypeError('Filter state must be an object')
    for (const [dimensionKey, options] of Object.entries(value)) {
        assertKey(dimensionKey, 'Filter dimension')
        if (!isRecord(options)) {
            throw new TypeError(`Filter dimension ${dimensionKey} must be an object`)
        }
        for (const [optionKey, mode] of Object.entries(options)) {
            assertKey(optionKey, `Filter option in ${dimensionKey}`)
            if (!isFilterMode(mode)) {
                throw new TypeError(
                    `Unknown filter mode for ${dimensionKey}.${optionKey}: ${String(mode)}`,
                )
            }
        }
    }
}

function assertDefinitions<TItem>(
    dimensions: readonly FilterDimensionDefinition<TItem>[],
): void {
    if (!Array.isArray(dimensions)) throw new TypeError('Filter dimensions must be an array')
    const dimensionKeys = new Set<string>()
    for (const dimension of dimensions) {
        assertKey(dimension.key, 'Filter dimension')
        if (dimensionKeys.has(dimension.key)) {
            throw new Error(`Duplicate filter dimension: ${dimension.key}`)
        }
        dimensionKeys.add(dimension.key)
        if (!Array.isArray(dimension.options)) {
            throw new TypeError(`Filter dimension ${dimension.key} options must be an array`)
        }
        const optionKeys = new Set<string>()
        for (const option of dimension.options) {
            assertKey(option.key, `Filter option in ${dimension.key}`)
            if (optionKeys.has(option.key)) {
                throw new Error(`Duplicate filter option: ${dimension.key}.${option.key}`)
            }
            optionKeys.add(option.key)
            if (typeof option.matches !== 'function') {
                throw new TypeError(`Filter matcher ${dimension.key}.${option.key} must be a function`)
            }
        }
    }
}

function assertKey(value: string, name: string): void {
    if (value.length === 0 || value === '__proto__' || value === 'prototype'
        || value === 'constructor') {
        throw new TypeError(`${name} key is not safe for persisted state`)
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
}
