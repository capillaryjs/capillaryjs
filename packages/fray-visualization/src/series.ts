import type {Category} from './grouping.js'
import {
    addCivilDays,
    civilDateToDay,
    compareCivilDates,
} from './dates.js'
import type {CivilDate} from './dates.js'

export interface HistoryShape {
    readonly key: string
    readonly label: string
    readonly color: string
    readonly colorKey?: string
    readonly values: Readonly<Record<CivilDate, number>>
    /** Carry the latest earlier value into dates with no explicit point. */
    readonly carryForward?: boolean
}

export interface SeriesCategory {
    readonly key: string
    readonly label: string
    readonly color: string
    readonly colorKey?: string
}

/** Collect date/category deltas and build ordinary or cumulative history shapes. */
export class SeriesBuilder {
    private readonly categories: readonly SeriesCategory[]
    private readonly byKey: ReadonlyMap<string, SeriesCategory>
    private readonly deltas = new Map<string, Map<CivilDate, number>>()

    constructor(categories: readonly SeriesCategory[] | readonly Category<unknown>[]) {
        if (!Array.isArray(categories)) throw new TypeError('Series categories must be an array')
        const normalized = categories.map((category) => normalizeSeriesCategory(category))
        const byKey = new Map(normalized.map((category) => [category.key, category]))
        if (byKey.size !== normalized.length) throw new Error('Series category keys must be unique')
        this.categories = Object.freeze(normalized)
        this.byKey = byKey
    }

    addOne(date: CivilDate, categoryKey: string): this {
        return this.add(date, categoryKey, 1)
    }

    removeOne(date: CivilDate, categoryKey: string): this {
        return this.add(date, categoryKey, -1)
    }

    add(date: CivilDate, categoryKey: string, delta: number): this {
        civilDateToDay(date)
        if (!Number.isFinite(delta)) throw new TypeError('Series delta must be finite')
        if (!this.byKey.has(categoryKey)) {
            throw new Error(`Unknown series category "${categoryKey}"`)
        }
        const values = this.deltas.get(categoryKey) ?? new Map<CivilDate, number>()
        values.set(date, (values.get(date) ?? 0) + delta)
        this.deltas.set(categoryKey, values)
        return this
    }

    build(): readonly HistoryShape[] {
        const dates = this.allDates()
        return this.categories
            .map((category) => shapeFrom(category, Object.fromEntries(dates.map((date) => [
                date,
                this.deltas.get(category.key)?.get(date) ?? 0,
            ])), false))
            .filter((shape) => Object.values(shape.values).some((value) => value !== 0))
    }

    buildCumulative(): readonly HistoryShape[] {
        const dates = this.allDates()
        if (dates.length === 0) return Object.freeze([])
        const anchoredDates = [addCivilDays(dates[0]!, -1), ...dates]
        return this.categories.map((category) => {
            let value = 0
            const values: Record<CivilDate, number> = {[anchoredDates[0]!]: 0}
            for (const date of dates) {
                value += this.deltas.get(category.key)?.get(date) ?? 0
                values[date] = value
            }
            return shapeFrom(category, values, true)
        }).filter((shape) => Object.values(shape.values).some((value) => value !== 0))
    }

    private allDates(): CivilDate[] {
        return [...new Set([...this.deltas.values()].flatMap((values) => [...values.keys()]))]
            .sort(compareCivilDates)
    }
}

function normalizeSeriesCategory(
    category: SeriesCategory | Category<unknown>,
): SeriesCategory {
    if (category == null || typeof category !== 'object') {
        throw new TypeError('Series category must be an object')
    }
    if (typeof category.key !== 'string' || category.key.trim() === '') {
        throw new TypeError('Series category key must be a non-empty string')
    }
    if (typeof category.label !== 'string' || category.label.trim() === '') {
        throw new TypeError('Series category label must be a non-empty string')
    }
    const color = 'color' in category ? category.color : category.colors[1]
    if (typeof color !== 'string' || color.trim() === '') {
        throw new TypeError('Series category color must be a non-empty CSS value')
    }
    const normalized: SeriesCategory = category.colorKey === undefined
        ? {key: category.key, label: category.label, color}
        : {key: category.key, label: category.label, color, colorKey: category.colorKey}
    return Object.freeze(normalized)
}

function shapeFrom(
    category: SeriesCategory,
    values: Record<CivilDate, number>,
    carryForward: boolean,
): HistoryShape {
    return Object.freeze({
        ...category,
        values: Object.freeze(values),
        carryForward,
    })
}
