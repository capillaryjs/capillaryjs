import {TemporalInput} from './TemporalInput.js'
import type {TemporalInputProps} from './TemporalInput.js'
import type {LocalDateTime} from './localDateTime.js'
import {isLocalDateTime} from './localDateTime.js'

/**
 * Props for `DateTimePicker`. Values, `min`, and `max` are `LocalDateTime`
 * strings in `YYYY-MM-DDTHH:mm` form (with optional seconds); `step` is a
 * second count, or `'any'` to disable stepping.
 * @experimental This interface is experimental and may change in any release.
 */
export interface DateTimePickerProps extends TemporalInputProps<LocalDateTime> {}

/**
 * Wall-clock date-and-time input backed by the native
 * `<input type="datetime-local">` element. The emitted value is a
 * `LocalDateTime` string, or `null` while the field is empty or holds an
 * incomplete entry.
 * @experimental This component is experimental and may change in any release.
 */
export class DateTimePicker extends TemporalInput<LocalDateTime, DateTimePickerProps> {
    protected override readonly inputType = 'datetime-local' as const

    protected override isValidValue(raw: string): boolean {
        return isLocalDateTime(raw)
    }

    static override hostName = 'datetimepicker'
}
