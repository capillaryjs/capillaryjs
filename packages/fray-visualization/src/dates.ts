const DAY_MILLISECONDS = 86_400_000
const civilDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

export type CivilDate = string

export function civilDateToDay(value: CivilDate): number {
    const match = civilDatePattern.exec(value)
    if (match == null) throw new TypeError(`Invalid civil date "${value}"; expected YYYY-MM-DD`)
    const year = Number(match[1])
    const month = Number(match[2])
    const date = Number(match[3])
    const milliseconds = Date.UTC(year, month - 1, date)
    const parsed = new Date(milliseconds)
    if (parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== date) {
        throw new TypeError(`Invalid civil date "${value}"`)
    }
    return Math.floor(milliseconds / DAY_MILLISECONDS)
}

export function dayToCivilDate(day: number): CivilDate {
    if (!Number.isInteger(day)) throw new TypeError('Civil day must be an integer')
    return new Date(day * DAY_MILLISECONDS).toISOString().slice(0, 10)
}

export function addCivilDays(value: CivilDate, days: number): CivilDate {
    if (!Number.isInteger(days)) throw new TypeError('Civil date offset must be an integer')
    return dayToCivilDate(civilDateToDay(value) + days)
}

export function todayCivilDate(now: Date = new Date()): CivilDate {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
        throw new TypeError('todayCivilDate requires a valid Date')
    }
    return `${String(now.getUTCFullYear()).padStart(4, '0')}-${String(
        now.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

export function compareCivilDates(left: CivilDate, right: CivilDate): number {
    return civilDateToDay(left) - civilDateToDay(right)
}
