import {Component, css} from '../component.js'
import type {
    ComponentProps,
    FrayChild,
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

export type RadioOption<TValue extends Key = string> = readonly [
    value: TValue,
    label: FrayChild,
]

const radioButtonLiveProps = ['checked', 'disabled', 'required', 'error'] as const
const radioGroupLiveProps = ['disabled', 'required', 'error'] as const

export interface RadioButtonProps extends ComponentProps,
    LivePropContract<(typeof radioButtonLiveProps)[number]> {
    id?: string | number | null
    label?: FrayChild
    name?: string
    value?: Key
    checked?: boolean
    disabled?: boolean
    required?: boolean
    error?: unknown
    onChange?: (checked: boolean, event: Event) => void
}

/** A native radio input with its associated label and visual control shell. */
export class RadioButton extends Component<RadioButtonProps> {
    static override liveProps = radioButtonLiveProps
    readonly inputId: string
    readonly errorId: string

    constructor(props: RadioButtonProps = {}) {
        super(props)
        this.inputId = controlId('radio', props.id)
        this.errorId = `${this.inputId}-error`
    }

    render(): FrayChild {
        const {
            label = this.props.value ?? 'Option',
            checked = false,
            disabled = false,
            required = false,
            error = null,
        } = this.props
        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            data-disabled={disabled ? '' : null}
            data-required={required ? '' : null}
            data-error={error == null ? null : ''}
        >
            <label htmlFor={this.inputId}>
                <input
                    id={this.inputId}
                    type="radio"
                    name={this.props.name}
                    value={this.props.value == null ? undefined : String(this.props.value)}
                    checked={checked}
                    disabled={disabled}
                    required={required}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    onChange={(event: Event) => invoke(this.props.onChange,
                        (event.currentTarget as HTMLInputElement).checked, event)}
                />
                <span className="radioshell" aria-hidden="true" />
                <span>{label}</span>
            </label>
            {error == null ? null : <p id={this.errorId} role="alert">{String(error)}</p>}
        </Host>
    }

    static override hostName = 'radio-button'

    static css = css`
        & {
            display: inline-block;
        }

        & > label {
            display: inline-flex;
            align-items: center;
            gap: 0.35em;
            cursor: pointer;
        }

        &[data-disabled] > label {
            cursor: not-allowed;
        }

        & input[type="radio"] {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
            border: 0;
        }

        & input[type="radio"] + .radioshell {
            position: relative;
            display: inline-grid;
            width: 1em;
            height: 1em;
            flex: 0 0 1em;
            box-sizing: border-box;
            border: var(--radio-box-border, var(--input-border, 1px solid currentColor));
            border-radius: 50%;
            background: var(--radio-background, var(--ui-input-bg, transparent));
            place-items: center;
        }

        & input[type="radio"]:checked + .radioshell {
            background: var(--radio-background-checked,
                var(--selection-background, var(--ui-accent-color, Highlight)));
        }

        & input[type="radio"]:checked + .radioshell::after {
            width: 0.4em;
            height: 0.4em;
            content: "";
            border-radius: 50%;
            background: var(--radio-dot-color, var(--selection-color, Canvas));
        }

        & input[type="radio"]:focus-visible + .radioshell {
            outline: 2px solid var(--focus-color, var(--ui-accent-color, Highlight));
            outline-offset: 1px;
        }

        & input[type="radio"]:disabled + .radioshell {
            opacity: 0.6;
        }
    `
}

export interface RadioGroupProps<TValue extends Key = string>
    extends ValueControlProps<TValue>,
        LivePropContract<(typeof radioGroupLiveProps)[number]> {
    id?: string | number | null
    /** Ordinary option data; an owning render must resolve any reactive source. */
    options?: readonly RadioOption<TValue>[]
    label?: FrayChild
    ariaLabel?: string
    name?: string
    /** Accepts a boolean or `live(booleanEmitter)` in JSX/`h()` templates. */
    disabled?: boolean
    /** Accepts a boolean or `live(booleanEmitter)` in JSX/`h()` templates. */
    required?: boolean
    /** Validation error; accepts an ordinary value or `live(errorEmitter)`. */
    error?: unknown
    onChange?: (value: TValue, event: Event | null) => void
}

/** A native-radio group that owns one selected option value. */
export class RadioGroup<TValue extends Key = string>
    extends Component<RadioGroupProps<TValue>> {
    static dependencies = [RadioButton]
    static override liveProps = radioGroupLiveProps

    readonly valueEmitter: ValueEmitter<TValue>
    readonly groupId: string
    readonly legendId: string
    readonly errorId: string

    constructor(props: RadioGroupProps<TValue> = {}) {
        super(props)
        const options = props.options ?? []
        validateRadioOptions(options)
        const firstValue = options[0]?.[0] ?? null as unknown as TValue
        this.valueEmitter = createValueEmitter(this, props, firstValue, 'radio group value')
        this.groupId = controlId('radio-group', props.id)
        this.legendId = `${this.groupId}-label`
        this.errorId = `${this.groupId}-error`
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    selectOption(value: TValue, event: Event | null = null): void {
        if (this.props.disabled) return
        this.valueEmitter.set(value, 'radio option selected')
        invoke(this.props.onChange, value, event)
    }

    render(): FrayChild {
        const {options = [], label, disabled = false, required = false, error = null} = this.props
        validateRadioOptions(options)
        const selectedValue = this.valueEmitter.get()
        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            data-disabled={disabled ? '' : null}
            data-required={required ? '' : null}
            data-error={error == null ? null : ''}
        >
            <fieldset
                disabled={disabled}
                aria-required={required ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
            >
                {label == null ? null : <legend id={this.legendId}>{label}</legend>}
                <div
                    data-part="options"
                    role="radiogroup"
                    aria-label={label == null ? this.props.ariaLabel : null}
                    aria-labelledby={label == null ? null : this.legendId}
                >
                    {options.map(([value, optionLabel], index) => <RadioButton
                        key={String(value)}
                        id={`${this.groupId}-${index}`}
                        name={this.props.name ?? this.groupId}
                        value={value}
                        label={optionLabel}
                        checked={Object.is(selectedValue, value)}
                        disabled={disabled}
                        required={required}
                        onChange={(checked, event) => {
                            if (checked) this.selectOption(value, event)
                        }}
                    />)}
                </div>
            </fieldset>
            {error == null ? null : <p id={this.errorId} role="alert">{String(error)}</p>}
        </Host>
    }

    static override hostName = 'radio-group'

    static css = css`
        & > fieldset {
            margin: 0;
            padding: 0;
            border: 0;
        }

        & [data-part="options"] {
            display: flex;
            flex-flow: row wrap;
            gap: var(--space-sm, 0.5rem);
        }
    `
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
