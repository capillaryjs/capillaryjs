const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/

/**
 * A wall-clock time in `HH:mm` form, with optional `:ss` seconds and `.sss`
 * milliseconds — the value format produced by the native
 * `<input type="time">` element.
 * @experimental This type is experimental and may change in any release.
 */
export type TimeString = string

/** @experimental This interface is experimental and may change in any release. */
export interface TimeParts {
    readonly hours: number
    readonly minutes: number
    readonly seconds?: number
    readonly milliseconds?: number
}

/** @experimental This function is experimental and may change in any release. */
export function isTimeString(value: unknown): value is TimeString {
    if (typeof value !== 'string') return false
    return TIME_PATTERN.test(value) && parseTime(value) != null
}

/** @experimental This function is experimental and may change in any release. */
export function parseTime(value: TimeString | string | null | undefined): TimeParts | null {
    if (value == null) return null
    const match = TIME_PATTERN.exec(value)
    if (match == null) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    const seconds = match[3] == null ? 0 : Number(match[3])
    const milliseconds = match[4] == null ? 0 : Number(match[4].padEnd(3, '0'))
    if (hours > 23 || minutes > 59 || seconds > 59) return null
    return {hours, minutes, seconds, milliseconds}
}

/** @experimental This function is experimental and may change in any release. */
export function formatTime(parts: TimeParts): TimeString {
    const seconds = parts.seconds ?? 0
    const milliseconds = parts.milliseconds ?? 0
    if (
        !Number.isInteger(parts.hours) || parts.hours < 0 || parts.hours > 23
        || !Number.isInteger(parts.minutes) || parts.minutes < 0 || parts.minutes > 59
        || !Number.isInteger(seconds) || seconds < 0 || seconds > 59
        || !Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > 999
    ) {
        throw new TypeError(`Invalid time parts: ${JSON.stringify(parts)}`)
    }
    const hours = String(parts.hours).padStart(2, '0')
    const minutes = String(parts.minutes).padStart(2, '0')
    let value = `${hours}:${minutes}`
    if (seconds !== 0 || milliseconds !== 0) {
        value += `:${String(seconds).padStart(2, '0')}`
        if (milliseconds !== 0) value += `.${String(milliseconds).padStart(3, '0')}`
    }
    return value as TimeString
}

/** @experimental This function is experimental and may change in any release. */
export function timeToMinutes(value: TimeString): number {
    const parts = parseTime(value)
    if (parts == null) throw new TypeError(`Invalid time: ${value}`)
    return parts.hours * 60 + parts.minutes
}

/** @experimental This function is experimental and may change in any release. */
export function minutesToTime(minutes: number): TimeString {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
        throw new TypeError(`Invalid time minutes: ${minutes}`)
    }
    return formatTime({hours: Math.floor(minutes / 60), minutes: minutes % 60})
}

/** @experimental This function is experimental and may change in any release. */
export function timeStepOptions(
    min: TimeString | null | undefined,
    max: TimeString | null | undefined,
    step: number,
): {value: TimeString; label: string}[] {
    if (!Number.isInteger(step) || step <= 0) throw new TypeError('Time step must be a positive integer')
    const minMinutes = min == null ? 0 : timeToMinutes(min)
    const maxMinutes = max == null ? (24 * 60 - 1) : timeToMinutes(max)
    if (maxMinutes < minMinutes) throw new TypeError('max time must be >= min time')
    const options: {value: TimeString; label: string}[] = []
    for (let minutes = minMinutes; minutes <= maxMinutes; minutes += step) {
        const value = minutesToTime(minutes)
        options.push({value, label: value})
    }
    return options
}
