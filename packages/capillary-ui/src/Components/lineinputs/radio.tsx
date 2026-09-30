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
import {
    CommandInvocationPresentation,
    commandSource,
    validateCommandInteractionOptions,
} from '../commandSupport.js'
import type {CommandAction, CommandInteractionOptions} from '../commandSupport.js'

export type RadioOption<TValue extends Key = string> = readonly [
    value: TValue,
    label: CapillaryUiChild,
]

const radioButtonLiveProps = ['checked', 'disabled', 'required', 'readOnly', 'busy', 'error'] as const
const radioGroupLiveProps = ['disabled', 'required', 'readOnly', 'busy', 'error'] as const

interface RadioButtonCommonProps extends ComponentProps,
    LivePropContract<(typeof radioButtonLiveProps)[number]>, CommandInteractionOptions {
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
    disableWhileRunning?: boolean
}

export type RadioButtonProps = RadioButtonCommonProps & (
    | {changeCommand: CommandAction<boolean>; onChange?: never}
    | {changeCommand?: never; onChange?: (checked: boolean, event: Event) => void}
)

/** A native radio input with its associated label and visual control shell. */
export class RadioButton extends CheckableControl<RadioButtonProps> {
    static override liveProps = radioButtonLiveProps
    static override dependencies = [ErrorMessage]
    readonly inputId: string
    readonly errorId: string
    private readonly commandPresentation = new CommandInvocationPresentation(() => this.update())

    constructor(props: RadioButtonProps = {}) {
        super(props)
        if (props.changeCommand != null && props.onChange != null) {
            throw new TypeError('RadioButton changeCommand and onChange are mutually exclusive')
        }
        validateCommandInteractionOptions(props)
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
            changeCommand,
            disableWhileRunning = true,
            commandErrors = 'inline',
            onCommandInvocationError,
        } = this.props
        this.commandPresentation.reconcile(changeCommand)
        const command = commandSource(changeCommand)
        const commandRunning = command == null ? false : this.read(command.isRunning)
        const commandError = commandErrors === 'external' || command == null
            ? null : this.snapshot(command).error
        const invocationError = this.commandPresentation.error(commandErrors)
        const isBusy = busy || commandRunning
        const displayedError = error ?? invocationError ?? commandError
        const isDisabled = disabled || (commandRunning && disableWhileRunning)
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <label htmlFor={this.inputId}>
                <input
                    id={this.inputId}
                    type="radio"
                    name={this.props.name}
                    value={this.props.value == null ? undefined : String(this.props.value)}
                    checked={checked}
                    disabled={isDisabled}
                    required={required}
                    aria-readonly={readOnly ? 'true' : null}
                    aria-busy={isBusy ? 'true' : null}
                    aria-invalid={displayedError == null ? null : 'true'}
                    aria-describedby={displayedError == null ? null : this.errorId}
                    onClick={(event: MouseEvent) => {
                        if (readOnly) event.preventDefault()
                    }}
                    onChange={(event: Event) => {
                        const input = event.currentTarget as HTMLInputElement
                        if (readOnly || isDisabled) {
                            input.checked = checked
                            return
                        }
                        invoke(this.props.onChange, input.checked, event)
                        if (changeCommand != null && input.checked !== checked) {
                            this.commandPresentation.invoke(changeCommand, input.checked, event, {
                                commandErrors,
                                onCommandInvocationError,
                            })
                        }
                    }}
                />
                <cap-checkshell aria-hidden="true" />
                {label}
            </label>
            {displayedError == null ? null : <ErrorMessage id={this.errorId} error={displayedError} />}
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

interface RadioGroupCommonProps<TValue extends Key = string>
    extends ValueControlProps<TValue>,
        LivePropContract<(typeof radioGroupLiveProps)[number]>, CommandInteractionOptions {
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
    disableWhileRunning?: boolean
}

export type RadioGroupProps<TValue extends Key = string> = RadioGroupCommonProps<TValue> & (
    | {changeCommand: CommandAction<TValue>; onChange?: never}
    | {changeCommand?: never; onChange?: (value: TValue, event: Event | null) => void}
)

/** A native-radio group that owns one selected option value. */
export class RadioGroup<TValue extends Key = string>
    extends Component<RadioGroupProps<TValue>> {
    static dependencies = [RadioButton, ErrorMessage]
    static override liveProps = radioGroupLiveProps

    readonly valueEmitter: ValueEmitter<TValue>
    readonly groupId: string
    readonly errorId: string
    private readonly commandPresentation = new CommandInvocationPresentation(() => this.update())

    constructor(props: RadioGroupProps<TValue> = {}) {
        super(props)
        if (props.changeCommand != null && props.onChange != null) {
            throw new TypeError('RadioGroup changeCommand and onChange are mutually exclusive')
        }
        validateCommandInteractionOptions(props)
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
        const {
            changeCommand: action,
            commandErrors,
            onCommandInvocationError,
            disabled,
            readOnly,
            disableWhileRunning,
        } = this.props
        const command = commandSource(action)
        if (disabled || (command?.isRunning.get() && disableWhileRunning !== false)) return
        if (readOnly) {
            this.restoreNativeSelection()
            return
        }
        const changed = !Object.is(this.valueEmitter.get(), value)
        this.valueEmitter.set(value, 'radio option selected')
        invoke(this.props.onChange, value, event)
        if (changed && event != null && action != null) {
            this.commandPresentation.invoke(action, value, event, {
                commandErrors,
                onCommandInvocationError,
            })
        }
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
            changeCommand,
            disableWhileRunning = true,
            commandErrors = 'inline',
        } = this.props
        this.commandPresentation.reconcile(changeCommand)
        const command = commandSource(changeCommand)
        const commandRunning = command == null ? false : this.read(command.isRunning)
        const commandError = commandErrors === 'external' || command == null
            ? null : this.snapshot(command).error
        const invocationError = this.commandPresentation.error(commandErrors)
        const isBusy = busy || commandRunning
        const displayedError = error ?? invocationError ?? commandError
        const isDisabled = disabled || (commandRunning && disableWhileRunning)
        validateRadioOptions(options)
        const selectedValue = this.valueEmitter.get()
        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
        >
            <fieldset
                id={this.groupId}
                disabled={isDisabled}
                aria-readonly={readOnly ? 'true' : null}
                aria-label={label == null ? this.props.ariaLabel : null}
                aria-required={required ? 'true' : null}
                aria-busy={isBusy ? 'true' : null}
                aria-invalid={displayedError == null ? null : 'true'}
                aria-describedby={displayedError == null ? null : this.errorId}
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
                    disabled={isDisabled}
                    required={required}
                    busy={isBusy && displayedError == null}
                    onChange={(checked, event) => {
                        if (checked) this.selectOption(value, event)
                    }}
                />)}
            </fieldset>
            {displayedError == null ? null : <ErrorMessage id={this.errorId} error={displayedError} />}
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
