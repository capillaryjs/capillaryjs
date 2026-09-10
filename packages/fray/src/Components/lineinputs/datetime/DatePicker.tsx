import {css} from '../../component.js'
import type {FrayChild, LivePropContract, Ref} from '../../component.js'
import {
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import {LabeledInputControl} from '../LabeledInputControl.js'
import {Calendar} from './Calendar.js'
import type {CivilDate} from './civilDate.js'
import {
    compareCivilDates,
    formatCivilDate,
    isCivilDate,
    parseCivilDate,
    todayCivilDate,
} from './civilDate.js'

const datePickerLiveProps = ['disabled', 'required', 'readOnly', 'error'] as const

export interface DatePickerProps extends ValueControlProps<CivilDate | null>,
    LivePropContract<(typeof datePickerLiveProps)[number]> {
    id?: string | number | null
    label?: FrayChild
    ariaLabel?: string
    disabled?: boolean
    required?: boolean
    readOnly?: boolean
    error?: unknown
    min?: CivilDate | undefined
    max?: CivilDate | undefined
    placeholder?: string | undefined
    inputRef?: Ref<HTMLInputElement>
    onInput?: (value: CivilDate | null, event: Event) => void
    onChange?: (value: CivilDate | null, event: Event) => void
}

/** @experimental This component is experimental and may change in any release. */
export class DatePicker extends LabeledInputControl<DatePickerProps> {
    static override liveProps = datePickerLiveProps
    static dependencies = [Calendar]
    readonly inputId: string
    readonly errorId: string
    readonly popupId: string
    readonly valueEmitter: ValueEmitter<CivilDate | null>
    private isOpen: boolean = false
    private opening: boolean = false
    private viewYear: number
    private viewMonth: number
    private focusedDate: CivilDate
    private lastValue: CivilDate | null = null
    private popupRef: {current: HTMLDialogElement | null} = {current: null}
    private inputElement: HTMLInputElement | null = null
    private wasOpen: boolean = false
    private focusCalendarOnOpen: boolean = false

    constructor(props: DatePickerProps = {}) {
        super(props)
        this.inputId = controlId('datepicker', props.id)
        this.errorId = `${this.inputId}-error`
        this.popupId = `${this.inputId}-popup`
        this.valueEmitter = createValueEmitter(this, props, null, 'datepicker value')
        const value = this.valueEmitter.get()
        this.lastValue = value
        const base = value ?? todayCivilDate()
        const parts = parseCivilDate(base)!
        this.viewYear = parts.year
        this.viewMonth = parts.month
        this.focusedDate = base
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    private syncFromValue(): void {
        const value = this.valueEmitter.get()
        if (value !== this.lastValue) {
            this.lastValue = value
            const base = value ?? todayCivilDate()
            const parts = parseCivilDate(base)!
            this.viewYear = parts.year
            this.viewMonth = parts.month
            this.focusedDate = base
        }
    }

    private setValue(value: CivilDate | null, event: Event): void {
        if (this.valueEmitter.get() === value) return
        this.valueEmitter.set(value, 'datepicker selection')
        invoke(this.props.onInput, value, event)
    }

    private handleClickOutside = (event: MouseEvent): void => {
        if (!this.isOpen || this.dom == null) return
        const target = event.target as Node | null
        if (target == null) return
        if (!this.dom.contains(target)) this.close()
    }

    private open(focusCalendar: boolean = false): void {
        if (this.isOpen) return
        this.isOpen = true
        this.opening = true
        this.focusCalendarOnOpen = focusCalendar
        const value = this.valueEmitter.get()
        const base = value ?? todayCivilDate()
        const parts = parseCivilDate(base)!
        this.viewYear = parts.year
        this.viewMonth = parts.month
        this.focusedDate = base
        document.addEventListener('mousedown', this.handleClickOutside)
        this.update()
    }

    private close(): void {
        if (!this.isOpen) return
        this.isOpen = false
        this.opening = false
        document.removeEventListener('mousedown', this.handleClickOutside)
        this.update()
    }

    onDestroy(): void {
        document.removeEventListener('mousedown', this.handleClickOutside)
    }

    private handleInput(event: Event): void {
        if (event.type === 'change') {
            // The value has already been set by input events; report commit.
            invoke(this.props.onChange, this.valueEmitter.get(), event)
            return
        }
        const input = event.currentTarget as HTMLInputElement
        const raw = input.value
        if (raw === '') {
            this.setValue(null, event)
            return
        }
        if (isCivilDate(raw)) {
            this.setValue(raw, event)
            return
        }
        // Invalid typed text: do not overwrite the value, but still call onInput with null
        // so the application can decide how to react.
        invoke(this.props.onInput, null, event)
    }

    private handleSelect(date: CivilDate, _event: Event): void {
        if (this.isDisabledDate(date)) return
        if (this.valueEmitter.get() === date) {
            this.close()
            return
        }
        this.valueEmitter.set(date, 'datepicker selection')
        invoke(this.props.onChange, date, new Event('change', {bubbles: true}))
        this.close()
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.close()
            return
        }
        if (event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault()
            this.open(true)
            return
        }
    }

    private handleCalendarKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Tab' || event.key === 'Escape') {
            if (event.key === 'Escape') {
                this.close()
            }
            return
        }
        // Calendar handles arrow/page/enter internally and calls onFocusedDateChange/onViewChange.
        // We do not stop propagation for those.
    }

    private isDisabledDate(date: CivilDate): boolean {
        const {min, max} = this.props
        if (min != null && compareCivilDates(date, min) < 0) return true
        if (max != null && compareCivilDates(date, max) > 0) return true
        return false
    }

    private ensureFocusable(): void {
        if (this.isDisabledDate(this.focusedDate)) {
            const value = this.valueEmitter.get()
            if (value != null && !this.isDisabledDate(value)) {
                this.focusedDate = value
            } else {
                const today = todayCivilDate()
                if (!this.isDisabledDate(today)) {
                    this.focusedDate = today
                } else {
                    const parts = parseCivilDate(today)!
                    this.focusedDate = formatCivilDate({
                        year: parts.year,
                        month: parts.month,
                        day: 1,
                    })
                }
            }
        }
    }

    afterUpdate(): void {
        if (this.isOpen && this.opening) {
            this.opening = false
            if (this.focusCalendarOnOpen) {
                const activeDay = this.popupRef.current?.querySelector<HTMLElement>('button[data-focused="true"]')
                if (activeDay != null) activeDay.focus()
            }
        } else if (!this.isOpen && this.wasOpen) {
            if (this.inputElement != null) {
                this.inputElement.focus()
            }
        }
        this.wasOpen = this.isOpen
    }

    render(): FrayChild {
        this.syncFromValue()

        const {
            label,
            ariaLabel,
            placeholder,
            disabled = false,
            required = false,
            readOnly = false,
            error = null,
            inputRef,
            onInput,
            onChange,
        } = this.props

        const value = this.valueEmitter.get()
        this.ensureFocusable()

        const Host = this.Host
        const dialogRef = (element: HTMLDialogElement | null) => {
            this.popupRef.current = element
        }
        const inputCallback = (element: HTMLInputElement | null) => {
            this.inputElement = element
            if (typeof inputRef === 'function') {
                inputRef(element)
            } else if (inputRef != null) {
                inputRef.current = element
            }
        }

        return (
            <Host className={componentClass(this.props) || null}>
                {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
                <input
                    id={this.inputId}
                    type="text"
                    value={value ?? ''}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    readOnly={readOnly}
                    aria-label={label == null ? ariaLabel : null}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    aria-haspopup="dialog"
                    aria-expanded={this.isOpen}
                    aria-controls={this.isOpen ? this.popupId : null}
                    onInput={(event: Event) => this.handleInput(event)}
                    onChange={(event: Event) => this.handleInput(event)}
                    onKeyDown={(event: KeyboardEvent) => this.handleKeyDown(event)}
                    ref={inputCallback}
                />
                <button
                    type="button"
                    disabled={disabled || readOnly}
                    tabIndex={-1}
                    aria-label="Open calendar"
                    onClick={() => !readOnly && !disabled && this.open(true)}
                >
                    {'▼'}
                </button>
                {this.isOpen ? (
                    <dialog
                        id={this.popupId}
                        role="dialog"
                        aria-modal="false"
                        aria-label="Choose a date"
                        open
                        ref={dialogRef}
                        onKeyDown={(event: KeyboardEvent) => this.handleCalendarKeyDown(event)}
                    >
                        <Calendar
                            value={value}
                            focusedDate={this.focusedDate}
                            viewYear={this.viewYear}
                            viewMonth={this.viewMonth}
                            min={this.props.min}
                            max={this.props.max}
                            today={todayCivilDate()}
                            onSelect={(date, event) => this.handleSelect(date, event)}
                            onFocusedDateChange={(date) => {
                                this.focusedDate = date
                                this.update()
                            }}
                            onViewChange={(year, month) => {
                                this.viewYear = year
                                this.viewMonth = month
                                this.update()
                            }}
                            onCancel={() => this.close()}
                        />
                    </dialog>
                ) : null}
                {error == null ? null : (
                    <p id={this.errorId} role="alert">
                        {String(error)}
                    </p>
                )}
            </Host>
        )
    }

    static override hostName = 'datepicker'

    static override css = css`
        & {
            display: flex;
            flex-flow: row nowrap;
            align-items: center;
            gap: 0.5em;
            position: relative;
            min-height: var(--control-min-height, 2rem);
        }

        & > input {
            min-height: var(--control-min-height, 2rem);
            width: var(--input-width, 10rem);
            padding: var(--space-xs) var(--space-sm);
            color: var(--input-color);
            background: var(--input-background);
            border: var(--input-border);
            border-radius: var(--radius-md);
            box-shadow: var(--input-shadow);
            box-sizing: border-box;
            font: inherit;
            cursor: text;
        }

        & > input:disabled,
        & > input[readonly] {
            color: var(--input-color-disabled);
            background: var(--input-background-disabled);
            border-color: var(--ui-input-border-disabled);
            cursor: not-allowed;
        }

        & > input:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        & > button {
            min-height: var(--control-min-height, 2rem);
            min-width: 2rem;
            padding: var(--space-xs) var(--space-sm);
            color: var(--button-color);
            background: var(--button-background);
            border: var(--button-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font: inherit;
        }

        & > button:disabled {
            color: var(--input-color-disabled);
            background: var(--input-background-disabled);
            cursor: not-allowed;
        }

        & > dialog {
            position: absolute;
            inset-block-start: 100%;
            inset-inline-start: 0;
            z-index: 1;
            margin: 0.25em 0 0;
            padding: 0.5em;
            min-width: 16rem;
            background: var(--island-background, var(--application-background));
            border: var(--island-border, var(--input-border));
            border-radius: var(--radius-md);
            box-shadow: var(--island-shadow, var(--input-shadow));
            color: var(--ui-color);
        }

        & > dialog::backdrop {
            display: none;
        }

        & > [role="alert"] {
            margin: 0;
        }

        & > dialog .fray-calendar {
            display: inline-block;
            font: inherit;
        }

        & > dialog .fray-calendar .fray-calendar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.5em;
            padding: 0.25em 0.5em;
            font: inherit;
            text-align: center;
        }

        & > dialog .fray-calendar .fray-calendar-header button {
            min-inline-size: 2em;
            min-block-size: 2em;
            padding: 0.25em;
            cursor: pointer;
        }

        & > dialog .fray-calendar table[role="grid"] {
            border-collapse: collapse;
            width: 100%;
            font: inherit;
        }

        & > dialog .fray-calendar table[role="grid"] th,
        & > dialog .fray-calendar table[role="grid"] td {
            padding: 0.125em;
            text-align: center;
        }

        & > dialog .fray-calendar table[role="grid"] th {
            font-weight: 600;
        }

        & > dialog .fray-calendar table[role="grid"] td button {
            inline-size: 2em;
            block-size: 2em;
            padding: 0;
            border: 1px solid transparent;
            border-radius: var(--radius-sm, 0.25rem);
            background: transparent;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        & > dialog .fray-calendar table[role="grid"] td button:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        & > dialog .fray-calendar table[role="grid"] td button[data-today="true"] {
            border-color: var(--palette-primary-500);
        }

        & > dialog .fray-calendar table[role="grid"] td button[data-selected="true"] {
            background: var(--palette-primary-500);
            color: var(--palette-primary-contrast);
        }

        & > dialog .fray-calendar table[role="grid"] td button:disabled,
        & > dialog .fray-calendar table[role="grid"] td button[aria-disabled="true"] {
            color: var(--input-color-disabled);
            cursor: not-allowed;
        }

        @media (forced-colors: active) {
            & > dialog .fray-calendar table[role="grid"] td button[data-selected="true"] {
                outline: 2px solid ButtonText;
            }
        }
    `
}
