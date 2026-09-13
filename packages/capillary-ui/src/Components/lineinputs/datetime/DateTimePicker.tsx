import {Emitter} from '@capillaryjs/capillary'
import {Component, css} from '../../component.js'
import type {ComponentProps, CapillaryUiChild, LivePropContract} from '../../component.js'
import {componentClass, controlId, createValueEmitter, invoke} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import {ErrorMessage} from '../../status/statusPresentation.js'
import type {CivilDate} from './civilDate.js'
import {DatePicker} from './DatePicker.js'
import {TimePicker} from './TimePicker.js'
import type {TimeString} from './timeString.js'

const dateTimePickerLiveProps = ['disabled', 'required', 'busy', 'error'] as const

export interface DateTimeValue {
    date: CivilDate | null
    time: TimeString | null
}

export interface DateTimePickerProps extends ValueControlProps<DateTimeValue | null>,
    LivePropContract<(typeof dateTimePickerLiveProps)[number]> {
    id?: string | number | null
    label?: CapillaryUiChild
    ariaLabel?: string
    disabled?: boolean
    required?: boolean
    busy?: boolean
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
    static dependencies = [DatePicker, TimePicker, ErrorMessage]
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

    render(): CapillaryUiChild {
        const {
            label,
            ariaLabel,
            disabled = false,
            required = false,
            busy = false,
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
                    aria-busy={busy ? 'true' : null}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    disabled={disabled}
                >
                    {label != null ? <legend>{label}</legend> : null}
                    <DatePicker
                        ariaLabel={this.capillaryUiMessage('dateTimePickerDateLabel')}
                        valueEmitter={this.datePart}
                        disabled={disabled}
                        required={required}
                        busy={busy && error == null}
                        min={minDate}
                        max={maxDate}
                        placeholder={datePlaceholder}
                        onInput={(_value, event) => this.handlePartChange('date', event)}
                        onChange={(_value, event) => this.handlePartChange('date', event)}
                    />
                    <TimePicker
                        ariaLabel={this.capillaryUiMessage('dateTimePickerTimeLabel')}
                        valueEmitter={this.timePart}
                        disabled={disabled}
                        required={required}
                        busy={busy && error == null}
                        min={minTime}
                        max={maxTime}
                        step={timeStep}
                        placeholder={timePlaceholder}
                        onInput={(_value, event) => this.handlePartChange('time', event)}
                        onChange={(_value, event) => this.handlePartChange('time', event)}
                    />
                </fieldset>
                {error == null ? null : <ErrorMessage id={this.errorId} error={error} />}
            </Host>
        )
    }

    static override hostName = 'datetimepicker'

    static override css = css`
        & {
            display: block;
            position: relative;
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
            user-select: none;
        }

        & > fieldset[aria-invalid="true"] cap-datepicker > input,
        & > fieldset[aria-invalid="true"] cap-timepicker > cap-selectshell::before,
        & > fieldset[aria-invalid="true"] cap-timepicker > cap-selectshell::after,
        & > fieldset[aria-invalid="true"] cap-timepicker > cap-selectshell > select {
            border-color: var(--error-color);
        }

        @media (forced-colors: active) {
            & > fieldset[aria-invalid="true"] {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
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
