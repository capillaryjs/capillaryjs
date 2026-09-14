import {TemporalInput} from './TemporalInput.js'
import type {TemporalInputProps} from './TemporalInput.js'
import type {TimeString} from './timeString.js'
import {isTimeString} from './timeString.js'

/**
 * Props for `TimePicker`. Values, `min`, and `max` are `TimeString` strings in
 * `HH:mm` form (with optional seconds); `step` is a second count, or `'any'`
 * to disable stepping.
 * @experimental This interface is experimental and may change in any release.
 */
export interface TimePickerProps extends TemporalInputProps<TimeString> {}

/**
 * Wall-clock time input backed by the native `<input type="time">` element.
 * The emitted value is a `TimeString`, or `null` while the field is empty or
 * holds an incomplete entry.
 * @experimental This component is experimental and may change in any release.
 */
export class TimePicker extends TemporalInput<TimeString, TimePickerProps> {
    protected override readonly inputType = 'time' as const

    protected override isValidValue(raw: string): boolean {
        return isTimeString(raw)
    }

    static override hostName = 'timepicker'
}
