import type {CivilDate} from './civilDate.js'
import {isCivilDate} from './civilDate.js'
import {TemporalInput} from './TemporalInput.js'
import type {TemporalInputProps} from './TemporalInput.js'

/**
 * Props for `DatePicker`. Values, `min`, and `max` are `CivilDate` strings in
 * `YYYY-MM-DD` form; `step` is a day count.
 * @experimental This interface is experimental and may change in any release.
 */
export interface DatePickerProps extends TemporalInputProps<CivilDate> {
    /** Day granularity of the native date input. */
    step?: number | undefined
}

/**
 * Wall-clock date input backed by the native `<input type="date">` element.
 * The emitted value is a `CivilDate` string, or `null` while the field is
 * empty or holds an incomplete entry.
 * @experimental This component is experimental and may change in any release.
 */
export class DatePicker extends TemporalInput<CivilDate, DatePickerProps> {
    protected override readonly inputType = 'date' as const

    protected override isValidValue(raw: string): boolean {
        return isCivilDate(raw)
    }

    static override hostName = 'datepicker'
}
