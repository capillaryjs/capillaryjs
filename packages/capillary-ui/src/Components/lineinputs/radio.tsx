import {Component, css} from '../component.js'
import type {
    ComponentProps,
    CapillaryUiChild,
    Key,
    LivePropContract,
} from '../component.js'
import {
    assertOptions,
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {CheckableControl} from './CheckableControl.js'

export type RadioOption<TValue extends Key = string> = readonly [
    value: TValue,
    label: CapillaryUiChild,
]

const radioButtonLiveProps = ['checked', 'disabled', 'required', 'readOnly', 'busy', 'error'] as const
const radioGroupLiveProps = ['disabled', 'required', 'readOnly', 'busy', 'error'] as const

export interface RadioButtonProps extends ComponentProps,
    LivePropContract<(typeof radioButtonLiveProps)[number]> {
    id?: string | number | null
    label?: CapillaryUiChild
    name?: string
    value?: Key
    checked?: boolean
    disabled?: boolean
    required?: boolean
    /** Keeps the radio focusable while preventing selection changes. */
    readOnly?: boolean
    busy?: boolean
    error?: unknown
    onChange?: (checked: boolean, event: Event) => void
}

/** A native radio input with its associated label and visual control shell. */
export class RadioButton extends CheckableControl<RadioButtonProps> {
    static override liveProps = radioButtonLiveProps
    static override dependencies = [ErrorMessage]
    readonly inputId: string
    readonly errorId: string

    constructor(props: RadioButtonProps = {}) {
        super(props)
        this.inputId = controlId('radio', props.id)
        this.errorId = `${this.inputId}-error`
    }

    render(): CapillaryUiChild {
        const {
            label = this.props.value ?? this.capillaryUiMessage('radioOptionLabel'),
            checked = false,
            disabled = false,
            required = false,
            readOnly = false,
            busy = false,
            error = null,
        } = this.props
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <label htmlFor={this.inputId}>
                <input
                    id={this.inputId}
                    type="radio"
                    name={this.props.name}
                    value={this.props.value == null ? undefined : String(this.props.value)}
                    checked={checked}
                    disabled={disabled}
                    required={required}
                    aria-readonly={readOnly ? 'true' : null}
                    aria-busy={busy ? 'true' : null}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    onClick={(event: MouseEvent) => {
                        if (readOnly) event.preventDefault()
                    }}
                    onChange={(event: Event) => {
                        const input = event.currentTarget as HTMLInputElement
                        if (readOnly) {
                            input.checked = checked
                            return
                        }
                        invoke(this.props.onChange, input.checked, event)
                    }}
                />
                <cap-checkshell aria-hidden="true" />
                {label}
            </label>
            {error == null ? null : <ErrorMessage id={this.errorId} error={error} />}
        </Host>
    }

    static override hostName = 'radio-button'

    static override css = css`
        & > label > input[type="radio"] + cap-checkshell {
            border-radius: 50%;
            height: var(--checkbox-box-size, 1em);
        }

        /* Radios may keep their neutral ring when selected and paint only the
           center dot; the generic checked checkbox treatment is the fallback. */
        & > label > input[type="radio"]:checked + cap-checkshell {
            background: var(--radio-box-background-checked,
                var(--checkbox-box-background-checked));
            border: var(--radio-box-border-checked,
                var(--checkbox-box-border-checked));
            box-shadow: var(--radio-box-shadow-checked,
                var(--checkbox-box-shadow-checked));
        }

        & > label > input[type="radio"]:checked + cap-checkshell::after {
            width: var(--radio-symbol-size, .4em);
            height: var(--radio-symbol-size, .4em);
            content: "";
            border-radius: 50%;
            background: var(--radio-symbol-color, var(--checkbox-symbol-color));
        }
    `
}

export interface RadioGroupProps<TValue extends Key = string>
    extends ValueControlProps<TValue>,
        LivePropContract<(typeof radioGroupLiveProps)[number]> {
    id?: string | number | null
    /** Ordinary option data; an owning render must resolve any reactive source. */
    options?: readonly RadioOption<TValue>[]
    label?: CapillaryUiChild
    ariaLabel?: string
    name?: string
    /** Accepts a boolean or `live(booleanEmitter)` in JSX/`h()` templates. */
    disabled?: boolean
    /** Accepts a boolean or `live(booleanEmitter)` in JSX/`h()` templates. */
    required?: boolean
    /** Keeps the selected value focusable while preventing user changes. */
    readOnly?: boolean
    /** Loading presentation; does not disable the group. */
    busy?: boolean
    /** Validation error; accepts an ordinary value or `live(errorEmitter)`. */
    error?: unknown
    onChange?: (value: TValue, event: Event | null) => void
}

/** A native-radio group that owns one selected option value. */
export class RadioGroup<TValue extends Key = string>
    extends Component<RadioGroupProps<TValue>> {
    static dependencies = [RadioButton, ErrorMessage]
    static override liveProps = radioGroupLiveProps

    readonly valueEmitter: ValueEmitter<TValue>
    readonly groupId: string
    readonly errorId: string

    constructor(props: RadioGroupProps<TValue> = {}) {
        super(props)
        const options = props.options ?? []
        validateRadioOptions(options)
        const firstValue = options[0]?.[0] ?? null as unknown as TValue
        this.valueEmitter = createValueEmitter(this, props, firstValue, 'radio group value')
        this.groupId = controlId('radio-group', props.id)
        this.errorId = `${this.groupId}-error`
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    setProps(nextProps: RadioGroupProps<TValue>): this {
        const options = nextProps.options ?? []
        validateRadioOptions(options)
        super.setProps(nextProps)
        this.selectFirstAvailableOption(options)
        return this
    }

    selectOption(value: TValue, event: Event | null = null): void {
        if (this.props.disabled) return
        if (this.props.readOnly) {
            this.restoreNativeSelection()
            return
        }
        this.valueEmitter.set(value, 'radio option selected')
        invoke(this.props.onChange, value, event)
    }

    render(): CapillaryUiChild {
        const {
            options = [],
            label,
            disabled = false,
            required = false,
            readOnly = false,
            busy = false,
            error = null,
        } = this.props
        validateRadioOptions(options)
        const selectedValue = this.valueEmitter.get()
        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
        >
            <fieldset
                id={this.groupId}
                disabled={disabled}
                aria-readonly={readOnly ? 'true' : null}
                aria-label={label == null ? this.props.ariaLabel : null}
                aria-required={required ? 'true' : null}
                aria-busy={busy ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
                onClick={(event: MouseEvent) => {
                    if (readOnly) event.preventDefault()
                }}
            >
                {label == null ? null : <legend>{label}</legend>}
                {options.map(([value, optionLabel], index) => <RadioButton
                    key={String(value)}
                    id={`${this.groupId}-${index}`}
                    name={this.props.name ?? this.groupId}
                    value={value}
                    label={optionLabel}
                    checked={Object.is(selectedValue, value)}
                    disabled={disabled}
                    required={required}
                    busy={busy && error == null}
                    onChange={(checked, event) => {
                        if (checked) this.selectOption(value, event)
                    }}
                />)}
            </fieldset>
            {error == null ? null : <ErrorMessage id={this.errorId} error={error} />}
        </Host>
    }

    static override hostName = 'radio-group'

    static override css = css`
        & > fieldset {
            display: flex;
            flex-flow: column wrap;
            gap: var(--radio-group-gap, 0px);
            margin: 0;
            padding: 0;
            min-inline-size: 0;
            border: 0;
            user-select: none;
        }

        & {
            position: relative;
        }

        & > fieldset > legend {
            flex: 0 0 100%;
            padding: 0;
            margin-bottom: .5em;
            border-bottom: 1px solid #aaa;
        }

        & > fieldset[aria-invalid="true"] cap-checkshell {
            border-color: var(--error-control-border);
            box-shadow: var(--error-control-shadow);
        }

        /* RadioGroup owns changes for its child buttons, so the readonly
           presentation is applied here rather than to each child input. */
        & > fieldset[aria-readonly="true"] > cap-radiobutton {
            --_cap-checkable-label-color: var(--checkable-label-color-readonly);
            --_cap-checkable-cursor: default;
            --_cap-checkable-box-background: var(--checkbox-box-background-readonly);
            --_cap-checkable-box-border: var(--checkbox-box-border-readonly);
            --_cap-checkable-box-shadow: var(--checkbox-box-shadow-readonly);
            --_cap-checkable-box-filter: saturate(.78);
        }

        @media (forced-colors: active) {
            & > fieldset[aria-invalid="true"] {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `

    private selectFirstAvailableOption(options: readonly RadioOption<TValue>[]): void {
        if (!options.some(([value]) => Object.is(value, this.valueEmitter.get()))) {
            this.valueEmitter.set(options[0]?.[0] ?? null as unknown as TValue,
                'radio group options changed')
        }
    }

    private restoreNativeSelection(): void {
        if (!(this.dom instanceof Element)) return
        const selectedValue = this.valueEmitter.get()
        for (const input of this.dom.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
            input.checked = String(selectedValue) === input.value
        }
    }
}

function validateRadioOptions<TValue extends Key>(
    options: unknown,
): asserts options is readonly RadioOption<TValue>[] {
    assertOptions<unknown>(options, 'Radio group options')
    for (const option of options) {
        if (!Array.isArray(option) || option.length < 2) {
            throw new TypeError('Radio group options must be [value, label] tuples')
        }
    }
}
