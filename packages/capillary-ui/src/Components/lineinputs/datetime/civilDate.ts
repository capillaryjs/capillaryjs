const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const DAY_MILLISECONDS = 86_400_000

/**
 * A wall-clock date in ISO-8601 `YYYY-MM-DD` form.
 * @experimental This type is experimental and may change in any release.
 */
export type CivilDate = string

/** @experimental This interface is experimental and may change in any release. */
export interface CivilDateParts {
    readonly year: number
    readonly month: number
    readonly day: number
}

/** @experimental This function is experimental and may change in any release. */
export function isCivilDate(value: unknown): value is CivilDate {
    if (typeof value !== 'string') return false
    return CIVIL_DATE_PATTERN.test(value) && parseCivilDate(value) != null
}

/** @experimental This function is experimental and may change in any release. */
export function parseCivilDate(value: CivilDate | string | null | undefined): CivilDateParts | null {
    if (value == null) return null
    const match = CIVIL_DATE_PATTERN.exec(value)
    if (match == null) return null
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const milliseconds = Date.UTC(year, month - 1, day)
    const parsed = new Date(milliseconds)
    if (
        Number.isNaN(milliseconds)
        || parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) {
        return null
    }
    return {year, month, day}
}

/** @experimental This function is experimental and may change in any release. */
export function formatCivilDate(parts: CivilDateParts): CivilDate {
    const year = String(parts.year).padStart(4, '0')
    const month = String(parts.month).padStart(2, '0')
    const day = String(parts.day).padStart(2, '0')
    const candidate = `${year}-${month}-${day}` as CivilDate
    if (parseCivilDate(candidate) == null) {
        throw new TypeError(`Invalid civil date: ${candidate}`)
    }
    return candidate
}

/** @experimental This function is experimental and may change in any release. */
export function civilDateToDay(value: CivilDate): number {
    const parts = parseCivilDate(value)
    if (parts == null) throw new TypeError(`Invalid civil date: ${value}`)
    return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MILLISECONDS)
}

/** @experimental This function is experimental and may change in any release. */
export function dayToCivilDate(day: number): CivilDate {
    if (!Number.isInteger(day)) throw new TypeError('Civil day must be an integer')
    return new Date(day * DAY_MILLISECONDS).toISOString().slice(0, 10) as CivilDate
}

/** @experimental This function is experimental and may change in any release. */
export function addCivilDays(value: CivilDate, days: number): CivilDate {
    if (!Number.isInteger(days)) throw new TypeError('Civil date offset must be an integer')
    return dayToCivilDate(civilDateToDay(value) + days)
}

/** @experimental This function is experimental and may change in any release. */
export function todayCivilDate(now: Date = new Date()): CivilDate {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
        throw new TypeError('todayCivilDate requires a valid Date')
    }
    return `${String(now.getFullYear()).padStart(4, '0')}-${String(
        now.getMonth() + 1,
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` as CivilDate
}

/** @experimental This function is experimental and may change in any release. */
export function compareCivilDates(left: CivilDate, right: CivilDate): number {
    return civilDateToDay(left) - civilDateToDay(right)
}

/** @experimental This function is experimental and may change in any release. */
export function daysInMonth(year: number, month: number): number {
    const next = month === 12 ? {year: year + 1, month: 1} : {year, month: month + 1}
    const first = Date.UTC(next.year, next.month - 1, 1)
    const previous = new Date(first - DAY_MILLISECONDS)
    return previous.getUTCDate()
}

/** @experimental This function is experimental and may change in any release. */
export function startOfMonthDay(year: number, month: number): number {
    return new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
}

/** @experimental This function is experimental and may change in any release. */
export function addMonths(year: number, month: number, delta: number): {year: number; month: number} {
    const total = (year * 12 + (month - 1)) + delta
    const nextYear = Math.floor(total / 12)
    const nextMonth = ((total % 12) + 12) % 12 + 1
    return {year: nextYear, month: nextMonth}
}
