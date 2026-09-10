import {Emitter} from '@sylwellsoftware/glue'
import {Component, css} from '../../component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../../component.js'
import {componentClass, controlId, createValueEmitter, invoke} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import type {CivilDate} from './civilDate.js'
import {DatePicker} from './DatePicker.js'
import {TimePicker} from './TimePicker.js'
import type {TimeString} from './timeString.js'

const dateTimePickerLiveProps = ['disabled', 'required', 'error'] as const

export interface DateTimeValue {
    date: CivilDate | null
    time: TimeString | null
}

export interface DateTimePickerProps extends ValueControlProps<DateTimeValue | null>,
    LivePropContract<(typeof dateTimePickerLiveProps)[number]> {
    id?: string | number | null
    label?: FrayChild
    ariaLabel?: string
    disabled?: boolean
    required?: boolean
    error?: unknown
    minDate?: CivilDate | undefined
    maxDate?: CivilDate | undefined
    minTime?: TimeString | undefined
    maxTime?: TimeString | undefined
    timeStep?: number | undefined
    datePlaceholder?: string | undefined
    timePlaceholder?: string | undefined
    onInput?: (value: DateTimeValue | null, event: Event) => void
    onChange?: (value: DateTimeValue | null, event: Event) => void
}

/** @experimental This component is experimental and may change in any release. */
export class DateTimePicker extends Component<DateTimePickerProps> {
    static override liveProps = dateTimePickerLiveProps
    static dependencies = [DatePicker, TimePicker]
    readonly valueEmitter: ValueEmitter<DateTimeValue | null>
    readonly datePart: ValueEmitter<CivilDate | null>
    readonly timePart: ValueEmitter<TimeString | null>
    readonly errorId: string
    private lastParent: DateTimeValue | null = null
    private parentUnsubscribe: (() => void) | null = null

    constructor(props: DateTimePickerProps = {}) {
        super(props)
        this.errorId = controlId('datetimepicker-error', props.id)
        this.valueEmitter = createValueEmitter(this, props, null, 'datetime value')
        const initial = this.valueEmitter.get() ?? {date: null, time: null}
        this.datePart = new Emitter<CivilDate | null>(initial.date, {
            owner: this,
            purpose: 'datetime date part',
        })
        this.timePart = new Emitter<TimeString | null>(initial.time, {
            owner: this,
            purpose: 'datetime time part',
        })
        this.lastParent = this.valueEmitter.get()
    }

    initialize(): void {
        this.parentUnsubscribe = this.valueEmitter.subscribe(({value}) => {
            if (!dateTimeEqual(value, this.lastParent)) {
                this.lastParent = value
                this.syncChildren(value)
            }
        })
    }

    onDestroy(): void {
        this.parentUnsubscribe?.()
    }

    private syncChildren(value: DateTimeValue | null): void {
        const next = value ?? {date: null, time: null}
        if (this.datePart.get() !== next.date) this.datePart.set(next.date)
        if (this.timePart.get() !== next.time) this.timePart.set(next.time)
    }

    private handlePartChange(_part: 'date' | 'time', event: Event): void {
        const nextDate = this.datePart.get()
        const nextTime = this.timePart.get()
        const next = nextDate == null && nextTime == null ? null : {date: nextDate, time: nextTime}
        const changed = !dateTimeEqual(this.valueEmitter.get(), next)
        if (changed) {
            this.valueEmitter.set(next, 'datetime part change')
            this.lastParent = next
        }
        const {onInput, onChange} = this.props
        if (event.type === 'input' && changed) {
            invoke(onInput, next, event)
        } else if (event.type === 'change') {
            invoke(onChange, this.valueEmitter.get(), event)
        }
    }

    render(): FrayChild {
        const {
            label,
            ariaLabel,
            disabled = false,
            required = false,
            error = null,
            minDate,
            maxDate,
            minTime,
            maxTime,
            timeStep = 30,
            datePlaceholder,
            timePlaceholder,
        } = this.props

        const Host = this.Host
        return (
            <Host className={componentClass(this.props) || null}>
                <fieldset
                    aria-label={label == null ? ariaLabel : null}
                    aria-required={required ? 'true' : null}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    disabled={disabled}
                >
                    {label != null ? <legend>{label}</legend> : null}
                    <DatePicker
                        ariaLabel="Date"
                        valueEmitter={this.datePart}
                        disabled={disabled}
                        required={required}
                        min={minDate}
                        max={maxDate}
                        placeholder={datePlaceholder}
                        onInput={(_value, event) => this.handlePartChange('date', event)}
                        onChange={(_value, event) => this.handlePartChange('date', event)}
                    />
                    <TimePicker
                        ariaLabel="Time"
                        valueEmitter={this.timePart}
                        disabled={disabled}
                        required={required}
                        min={minTime}
                        max={maxTime}
                        step={timeStep}
                        placeholder={timePlaceholder}
                        onInput={(_value, event) => this.handlePartChange('time', event)}
                        onChange={(_value, event) => this.handlePartChange('time', event)}
                    />
                </fieldset>
                {error == null ? null : (
                    <p id={this.errorId} role="alert">
                        {String(error)}
                    </p>
                )}
            </Host>
        )
    }

    static override hostName = 'datetimepicker'

    static override css = css`
        & {
            display: block;
            min-width: 0;
        }

        & > fieldset {
            margin: 0;
            padding: 0;
            min-inline-size: 0;
            border: 0;
            display: flex;
            flex-flow: row wrap;
            align-items: flex-start;
            gap: 0.5em;
            width: 100%;
        }

        & > fieldset > legend {
            display: block;
            width: 100%;
            padding: 0;
            margin: 0 0 0.25em;
            font: inherit;
        }

        & > [role="alert"] {
            margin: 0.25em 0 0;
        }
    `
}

function dateTimeEqual(
    left: DateTimeValue | null,
    right: DateTimeValue | null,
): boolean {
    if (left === right) return true
    if (left == null || right == null) return false
    return left.date === right.date && left.time === right.time
}
