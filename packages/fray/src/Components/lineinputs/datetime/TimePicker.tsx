import {css} from '../../component.js'
import type {FrayChild, LivePropContract} from '../../component.js'
import {
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import {SelectControl} from '../SelectControl.js'
import type {TimeString} from './timeString.js'
import {formatTime, isTimeString, parseTime, timeStepOptions} from './timeString.js'

const timePickerLiveProps = ['disabled', 'required', 'error'] as const

export interface TimePickerProps extends ValueControlProps<TimeString | null>,
    LivePropContract<(typeof timePickerLiveProps)[number]> {
    id?: string | number | null
    label?: FrayChild
    ariaLabel?: string
    disabled?: boolean
    required?: boolean
    error?: unknown
    min?: TimeString | undefined
    max?: TimeString | undefined
    step?: number | undefined
    placeholder?: string | undefined
    onInput?: (value: TimeString | null, event: Event) => void
    onChange?: (value: TimeString | null, event: Event) => void
}

/** @experimental This component is experimental and may change in any release. */
export class TimePicker extends SelectControl<TimePickerProps> {
    static override liveProps = timePickerLiveProps
    readonly inputId: string
    readonly errorId: string
    readonly valueEmitter: ValueEmitter<TimeString | null>
    private options: {value: TimeString; label: string}[] = []
    private selectElement: HTMLSelectElement | null = null

    constructor(props: TimePickerProps = {}) {
        super(props)
        this.inputId = controlId('timepicker', props.id)
        this.errorId = `${this.inputId}-error`
        this.valueEmitter = createValueEmitter(this, props, null, 'timepicker value')
        this.maybeClampToRequired()
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    private getCurrentOptions(): {value: TimeString; label: string}[] {
        const {min, max, step = 30} = this.props
        return timeStepOptions(min, max, step)
    }

    private maybeClampToRequired(): void {
        const {required} = this.props
        if (!required) return
        const options = this.getCurrentOptions()
        if (this.valueEmitter.get() == null && options.length > 0) {
            const first = options[0]
            if (first != null) this.valueEmitter.set(first.value)
        }
    }

    private handleChange(event: Event): void {
        const target = event.currentTarget as HTMLSelectElement
        const raw = target.value
        let value: TimeString | null
        if (raw === '') {
            value = null
        } else if (isTimeString(raw)) {
            value = raw
        } else {
            value = null
        }
        this.applyValue(value, event)
    }

    private applyValue(value: TimeString | null, event: Event): void {
        if (this.valueEmitter.get() !== value) {
            this.valueEmitter.set(value, 'timepicker selection')
        }
        const {onInput, onChange} = this.props
        if (event.type === 'input') {
            invoke(onInput, value, event)
        } else if (event.type === 'change') {
            invoke(onChange, value, event)
        }
    }

    private resolveDisplayValue(): TimeString | '' {
        const value = this.valueEmitter.get()
        if (value == null) return ''
        if (this.options.some((option) => option.value === value)) return value
        const parts = parseTime(value)
        if (parts == null) return ''
        return formatTime(parts)
    }

    private applySelection(): void {
        if (this.selectElement == null) return
        const currentValue = this.resolveDisplayValue()
        const index = [...this.selectElement.options].findIndex(
            (option) => option.value === currentValue,
        )
        if (index !== -1 && this.selectElement.selectedIndex !== index) {
            this.selectElement.selectedIndex = index
        }
    }

    afterMount(): void {
        this.applySelection()
    }

    afterUpdate(): void {
        this.maybeClampToRequired()
        this.applySelection()
    }

    render(): FrayChild {
        const {
            label,
            ariaLabel,
            placeholder = 'Select time…',
            disabled = false,
            required = false,
            error = null,
        } = this.props

        this.options = this.getCurrentOptions()
        const currentValue = this.resolveDisplayValue()

        const Host = this.Host
        return (
            <Host className={componentClass(this.props) || null}>
                {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
                <fray-selectshell>
                    <select
                        id={this.inputId}
                        value={currentValue}
                        ref={(element: HTMLSelectElement | null) => { this.selectElement = element }}
                        disabled={disabled}
                        required={required}
                        aria-label={label == null ? ariaLabel : null}
                        aria-invalid={error == null ? null : 'true'}
                        aria-describedby={error == null ? null : this.errorId}
                        onInput={(event: Event) => this.handleChange(event)}
                        onChange={(event: Event) => this.handleChange(event)}
                    >
                        {currentValue === '' ? (
                            <option value="" selected={true} disabled={required}>
                                {placeholder}
                            </option>
                        ) : null}
                        {currentValue !== '' && !this.options.some((option) => option.value === currentValue) ? (
                            <option value={currentValue} selected={true}>
                                {currentValue}
                            </option>
                        ) : null}
                        {this.options.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                                selected={currentValue === option.value}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                </fray-selectshell>
                {error == null ? null : (
                    <p id={this.errorId} role="alert">
                        {String(error)}
                    </p>
                )}
            </Host>
        )
    }

    static override hostName = 'timepicker'

    static override css = css`
        & > fray-selectshell > select {
            min-width: 7rem;
        }
    `
}
