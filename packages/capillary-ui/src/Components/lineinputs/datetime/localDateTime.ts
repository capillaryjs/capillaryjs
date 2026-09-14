import type {CivilDate, CivilDateParts} from './civilDate.js'
import {formatCivilDate, parseCivilDate} from './civilDate.js'
import type {TimeParts, TimeString} from './timeString.js'
import {formatTime, parseTime} from './timeString.js'

const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/

/**
 * A wall-clock date and time in `YYYY-MM-DDTHH:mm` form, with optional
 * `:ss` seconds and `.sss` milliseconds — the value format produced by the
 * native `<input type="datetime-local">` element.
 * @experimental This type is experimental and may change in any release.
 */
export type LocalDateTime = string

/** @experimental This interface is experimental and may change in any release. */
export interface LocalDateTimeParts extends CivilDateParts, TimeParts {}

/** @experimental This function is experimental and may change in any release. */
export function isLocalDateTime(value: unknown): value is LocalDateTime {
    return typeof value === 'string' && parseLocalDateTime(value) != null
}

/** @experimental This function is experimental and may change in any release. */
export function parseLocalDateTime(
    value: LocalDateTime | string | null | undefined,
): LocalDateTimeParts | null {
    if (value == null) return null
    const match = LOCAL_DATE_TIME_PATTERN.exec(value)
    if (match == null) return null
    const date = parseCivilDate(match[1])
    const time = parseTime(match[2])
    if (date == null || time == null) return null
    return {...date, ...time}
}

/** @experimental This function is experimental and may change in any release. */
export function formatLocalDateTime(parts: LocalDateTimeParts): LocalDateTime {
    return `${formatCivilDate(parts)}T${formatTime(parts)}` as LocalDateTime
}

/** @experimental This function is experimental and may change in any release. */
export function compareLocalDateTimes(left: LocalDateTime, right: LocalDateTime): number {
    const leftParts = parseLocalDateTime(left)
    const rightParts = parseLocalDateTime(right)
    if (leftParts == null || rightParts == null) {
        throw new TypeError(`Invalid local date-time: ${leftParts == null ? left : right}`)
    }
    return leftParts.year - rightParts.year
        || leftParts.month - rightParts.month
        || leftParts.day - rightParts.day
        || leftParts.hours - rightParts.hours
        || leftParts.minutes - rightParts.minutes
        || (leftParts.seconds ?? 0) - (rightParts.seconds ?? 0)
        || (leftParts.milliseconds ?? 0) - (rightParts.milliseconds ?? 0)
}

/**
 * Split a local date-time into its civil-date and time parts. A missing time
 * part is reported as `null`.
 * @experimental This function is experimental and may change in any release.
 */
export function splitLocalDateTime(
    value: LocalDateTime | string | null | undefined,
): {date: CivilDate; time: TimeString} | null {
    const parts = parseLocalDateTime(value)
    if (parts == null) return null
    return {date: formatCivilDate(parts), time: formatTime(parts)}
}

/**
 * Combine a civil date and a time into a local date-time. A `null` time
 * resolves to midnight.
 * @experimental This function is experimental and may change in any release.
 */
export function combineLocalDateTime(
    date: CivilDate | string | null | undefined,
    time: TimeString | string | null | undefined,
): LocalDateTime | null {
    const dateParts = parseCivilDate(date)
    if (dateParts == null) return null
    const timeParts = time == null ? {hours: 0, minutes: 0} : parseTime(time)
    if (timeParts == null) return null
    return formatLocalDateTime({...dateParts, ...timeParts})
}

/**
 * Interpret a local date-time as a `Date` in the environment's local timezone.
 * @experimental This function is experimental and may change in any release.
 */
export function localDateTimeToDate(value: LocalDateTime): Date {
    const parts = parseLocalDateTime(value)
    if (parts == null) throw new TypeError(`Invalid local date-time: ${value}`)
    return new Date(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hours,
        parts.minutes,
        parts.seconds ?? 0,
        parts.milliseconds ?? 0,
    )
}

/**
 * Read a `Date` as a wall-clock local date-time in the environment's local
 * timezone. Seconds and milliseconds are included only when non-zero.
 * @experimental This function is experimental and may change in any release.
 */
export function dateToLocalDateTime(date: Date): LocalDateTime {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new TypeError('dateToLocalDateTime requires a valid Date')
    }
    return formatLocalDateTime({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds(),
        milliseconds: date.getMilliseconds(),
    })
}

/** @experimental This function is experimental and may change in any release. */
export function nowLocalDateTime(now: Date = new Date()): LocalDateTime {
    return dateToLocalDateTime(now)
}
