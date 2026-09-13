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

const radioButtonLiveProps = ['checked', 'disabled', 'required', 'busy', 'error'] as const
const radioGroupLiveProps = ['disabled', 'required', 'busy', 'error'] as const

export interface RadioButtonProps extends ComponentProps,
    LivePropContract<(typeof radioButtonLiveProps)[number]> {
    id?: string | number | null
    label?: CapillaryUiChild
    name?: string
    value?: Key
    checked?: boolean
    disabled?: boolean
    required?: boolean
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
                    aria-busy={busy ? 'true' : null}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    onChange={(event: Event) => invoke(this.props.onChange,
                        (event.currentTarget as HTMLInputElement).checked, event)}
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
        }

        & > label > input[type="radio"]:checked + cap-checkshell::after {
            width: .4em;
            height: .4em;
            content: "";
            border-radius: 50%;
            background: var(--checkbox-symbol-color);
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
        this.valueEmitter.set(value, 'radio option selected')
        invoke(this.props.onChange, value, event)
    }

    render(): CapillaryUiChild {
        const {
            options = [],
            label,
            disabled = false,
            required = false,
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
                aria-label={label == null ? this.props.ariaLabel : null}
                aria-required={required ? 'true' : null}
                aria-busy={busy ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
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
            gap: 0;
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
            border-color: var(--error-color);
        }

        & > fieldset[aria-invalid="true"] cap-radiobutton > label {
            color: var(--error-color);
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
