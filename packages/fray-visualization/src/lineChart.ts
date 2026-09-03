import {
    civilDateToDay,
    dayToCivilDate,
    todayCivilDate,
} from './dates.js'
import type {CivilDate} from './dates.js'
import type {HistoryShape} from './series.js'

export interface LineGraphRange {
    readonly minX?: CivilDate
    readonly maxX?: CivilDate
    readonly minY?: number
}

export interface ChartPoint {
    readonly date: CivilDate
    readonly day: number
    readonly value: number
    readonly baseValue: number
    readonly displayValue: number
    readonly x: number
    readonly y: number
    readonly baseY: number
}

export interface ChartSeries {
    readonly key: string
    readonly label: string
    readonly color: string
    readonly colorKey?: string
    readonly shape: HistoryShape
    readonly points: readonly ChartPoint[]
}

export interface DateMark {
    readonly date: CivilDate
    readonly day: number
    readonly x: number
}

export interface ValueTick {
    readonly value: number
    readonly y: number
}

export interface LineChartModel {
    readonly minDate: CivilDate
    readonly maxDate: CivilDate
    readonly minDay: number
    readonly maxDay: number
    readonly minY: number
    readonly maxY: number
    readonly width: number
    readonly height: number
    readonly plotLeft: number
    readonly plotTop: number
    readonly plotWidth: number
    readonly plotHeight: number
    readonly stacked: boolean
    readonly series: readonly ChartSeries[]
    readonly dateMarks: readonly DateMark[]
    readonly valueTicks: readonly ValueTick[]
}

export interface LineChartOptions {
    readonly stacked?: boolean
    readonly range?: LineGraphRange
    readonly width?: number
    readonly height?: number
    readonly maxDateMarks?: number
    readonly today?: CivilDate
}

/** Calculate normalized, optionally stacked chart coordinates without a DOM. */
export function buildLineChartModel(
    shapes: readonly HistoryShape[],
    options: LineChartOptions = {},
): LineChartModel {
    validateShapes(shapes)
    const width = finiteDimension(options.width ?? 960, 'Chart width')
    const height = finiteDimension(options.height ?? 420, 'Chart height')
    const plotLeft = Math.min(72, width * 0.18)
    const plotTop = 24
    const plotWidth = Math.max(1, width - plotLeft - 24)
    const plotHeight = Math.max(1, height - plotTop - 58)
    const allDates = shapes.flatMap((shape) => Object.keys(shape.values))
    const today = options.today ?? todayCivilDate()
    const minDate = options.range?.minX ?? earliestDate(allDates) ?? today
    const maxDate = options.range?.maxX ?? today
    const minDay = civilDateToDay(minDate)
    const maxDay = civilDateToDay(maxDate)
    if (minDay > maxDay) throw new RangeError('Line graph minX must not be after maxX')
    const sampleDays = collectSampleDays(shapes, minDay, maxDay)
    const stacked = options.stacked ?? false
    const rawSeries = shapes.map((shape) => ({
        shape,
        values: sampleDays.map((day) => valueAtDay(shape, day)),
    }))
    let minimum = options.range?.minY ?? 0
    let maximum = minimum
    const accumulated = Array.from({length: sampleDays.length}, () => 0)
    const positioned = rawSeries.map(({shape, values}) => {
        const entries = values.map((value, index) => {
            const baseValue = stacked ? accumulated[index]! : 0
            const displayValue = baseValue + value
            if (stacked) accumulated[index] = displayValue
            minimum = Math.min(minimum, baseValue, displayValue)
            maximum = Math.max(maximum, baseValue, displayValue)
            return {value, baseValue, displayValue}
        })
        return {shape, entries}
    })
    const span = Math.max(1, maximum - minimum)
    const maxY = maximum + span * 0.05
    const minY = options.range?.minY ?? minimum
    const ySpan = Math.max(1, maxY - minY)
    const daySpan = Math.max(1, maxDay - minDay)
    const series: ChartSeries[] = positioned.map(({shape, entries}) => ({
        key: shape.key,
        label: shape.label,
        color: shape.color,
        ...(shape.colorKey === undefined ? {} : {colorKey: shape.colorKey}),
        shape,
        points: Object.freeze(entries.map((entry, index) => {
            const day = sampleDays[index]!
            return Object.freeze({
                date: dayToCivilDate(day),
                day,
                ...entry,
                x: plotLeft + (day - minDay) / daySpan * plotWidth,
                y: plotTop + (maxY - entry.displayValue) / ySpan * plotHeight,
                baseY: plotTop + (maxY - entry.baseValue) / ySpan * plotHeight,
            })
        })),
    }))
    return Object.freeze({
        minDate,
        maxDate,
        minDay,
        maxDay,
        minY,
        maxY,
        width,
        height,
        plotLeft,
        plotTop,
        plotWidth,
        plotHeight,
        stacked,
        series: Object.freeze(series),
        dateMarks: Object.freeze(buildDateMarks(minDay, maxDay, options.maxDateMarks ?? 8)
            .map((day) => ({
                date: dayToCivilDate(day),
                day,
                x: plotLeft + (day - minDay) / daySpan * plotWidth,
            }))),
        valueTicks: Object.freeze(buildIntegerTicks(minY, maxY).map((value) => ({
            value,
            y: plotTop + (maxY - value) / ySpan * plotHeight,
        }))),
    })
}

export function valueAtDate(shape: HistoryShape, date: CivilDate): number {
    return valueAtDay(shape, civilDateToDay(date))
}

export function linePath(points: readonly ChartPoint[], smooth: boolean): string {
    const first = points[0]
    if (first == null) return ''
    let path = `M ${format(first.x)} ${format(first.y)}`
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1]!
        const current = points[index]!
        if (smooth) {
            const midpoint = (previous.x + current.x) / 2
            path += ` C ${format(midpoint)} ${format(previous.y)}, ${format(midpoint)} `
                + `${format(current.y)}, ${format(current.x)} ${format(current.y)}`
        } else {
            path += ` H ${format(current.x)} V ${format(current.y)}`
        }
    }
    return path
}

export function areaPath(points: readonly ChartPoint[], smooth: boolean): string {
    if (points.length === 0) return ''
    const top = linePath(points, smooth)
    const reversed = [...points].reverse()
    let bottom = ''
    for (let index = 0; index < reversed.length; index += 1) {
        const point = reversed[index]!
        if (index === 0) bottom += ` L ${format(point.x)} ${format(point.baseY)}`
        else if (smooth) {
            const previous = reversed[index - 1]!
            const midpoint = (previous.x + point.x) / 2
            bottom += ` C ${format(midpoint)} ${format(previous.baseY)}, ${format(midpoint)} `
                + `${format(point.baseY)}, ${format(point.x)} ${format(point.baseY)}`
        } else {
            bottom += ` H ${format(point.x)} V ${format(point.baseY)}`
        }
    }
    return `${top}${bottom} Z`
}

export function buildIntegerTicks(minimum: number, maximum: number, target = 6): number[] {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
        throw new RangeError('Tick range must contain finite ascending values')
    }
    if (!Number.isInteger(target) || target < 2) throw new RangeError('Tick target must be at least two')
    const span = Math.max(1, maximum - minimum)
    const rough = span / (target - 1)
    const magnitude = 10 ** Math.floor(Math.log10(rough))
    const normalized = rough / magnitude
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
    const step = Math.max(1, nice * magnitude)
    const first = Math.ceil(minimum / step) * step
    const values: number[] = []
    for (let value = first; value <= maximum + step / 1000; value += step) {
        values.push(Number(value.toFixed(10)))
    }
    if (values.length === 0) values.push(Math.ceil(minimum))
    return values
}

function collectSampleDays(
    shapes: readonly HistoryShape[],
    minDay: number,
    maxDay: number,
): number[] {
    const days = new Set<number>([minDay, maxDay])
    for (const shape of shapes) {
        for (const date of Object.keys(shape.values)) {
            const day = civilDateToDay(date)
            if (day >= minDay && day <= maxDay) days.add(day)
        }
    }
    return [...days].sort((left, right) => left - right)
}

function valueAtDay(shape: HistoryShape, day: number): number {
    const exact = shape.values[dayToCivilDate(day)]
    if (exact !== undefined) return exact
    if (shape.carryForward !== true) return 0
    let bestDay = Number.NEGATIVE_INFINITY
    let bestValue = 0
    for (const [date, value] of Object.entries(shape.values)) {
        const candidate = civilDateToDay(date)
        if (candidate <= day && candidate > bestDay) {
            bestDay = candidate
            bestValue = value
        }
    }
    return bestValue
}

function buildDateMarks(minDay: number, maxDay: number, maximum: number): number[] {
    if (!Number.isInteger(maximum) || maximum < 2) {
        throw new RangeError('Maximum date marks must be at least two')
    }
    const span = Math.max(0, maxDay - minDay)
    const rawStep = span <= 62 ? 7 : span <= 730 ? 30 : 365
    const step = Math.max(rawStep, Math.ceil(Math.max(1, span) / (maximum - 1)))
    const marks = [minDay]
    for (let day = minDay + step; day < maxDay; day += step) marks.push(day)
    if (maxDay !== minDay) marks.push(maxDay)
    return marks
}

function validateShapes(shapes: readonly HistoryShape[]): void {
    if (!Array.isArray(shapes)) throw new TypeError('History shapes must be an array')
    const keys = new Set<string>()
    for (const shape of shapes) {
        if (shape == null || typeof shape !== 'object') throw new TypeError('History shape must be an object')
        if (typeof shape.key !== 'string' || shape.key.trim() === '' || keys.has(shape.key)) {
            throw new Error('History shape keys must be non-empty and unique')
        }
        keys.add(shape.key)
        if (typeof shape.label !== 'string' || shape.label.trim() === '') {
            throw new TypeError('History shape label must be a non-empty string')
        }
        if (typeof shape.color !== 'string' || shape.color.trim() === '') {
            throw new TypeError('History shape color must be a non-empty CSS value')
        }
        for (const [date, value] of Object.entries(shape.values)) {
            civilDateToDay(date)
            if (!Number.isFinite(value)) throw new TypeError('History shape values must be finite')
        }
    }
}

function earliestDate(values: readonly string[]): CivilDate | undefined {
    return values.length === 0
        ? undefined
        : values.reduce((left, right) => civilDateToDay(left) <= civilDateToDay(right)
            ? left
            : right)
}

function finiteDimension(value: number, label: string): number {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive`)
    return value
}

function format(value: number): string {
    return Number(value.toFixed(3)).toString()
}
