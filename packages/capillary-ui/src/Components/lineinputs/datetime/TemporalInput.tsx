import {css} from '../../component.js'
import type {CapillaryUiChild, LivePropContract, Ref} from '../../component.js'
import {
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import {ErrorMessage} from '../../status/statusPresentation.js'
import {LabeledInputControl} from '../LabeledInputControl.js'
import {requiredInputInvalidSelector, requiredPresentationCss} from '../requiredPresentation.js'

const temporalInputLiveProps = ['disabled', 'required', 'readOnly', 'busy', 'error'] as const

/**
 * Shared props for the native temporal line inputs. The concrete component
 * fixes the value domain — `CivilDate`, `TimeString`, or `LocalDateTime` —
 * through `TValue`; an empty input is reported as `null`.
 * @experimental This interface is experimental and may change in any release.
 */
export interface TemporalInputProps<TValue> extends ValueControlProps<TValue | null>,
    LivePropContract<(typeof temporalInputLiveProps)[number]> {
    id?: string | number | null
    label?: CapillaryUiChild
    ariaLabel?: string
    name?: string
    autoComplete?: string
    disabled?: boolean
    required?: boolean
    readOnly?: boolean
    busy?: boolean
    error?: unknown
    /** Earliest accepted value, in the component's value format. */
    min?: TValue | undefined
    /** Latest accepted value, in the component's value format. */
    max?: TValue | undefined
    /**
     * Native `step` granularity. Days for `DatePicker`; seconds for
     * `TimePicker` and `DateTimePicker`, where `'any'` disables stepping.
     */
    step?: number | 'any' | undefined
    inputRef?: Ref<HTMLInputElement>
    onInput?: (value: TValue | null, event: Event) => void
    onChange?: (value: TValue | null, event: Event) => void
}

/**
 * Base class for the temporal line inputs. Subclasses declare the native
 * input `type` and the value-domain validator; this class owns the shared
 * label/input/error rendering, value emission, and event plumbing.
 * @experimental This class is experimental and may change in any release.
 */
export abstract class TemporalInput<
    TValue,
    TProps extends TemporalInputProps<TValue> = TemporalInputProps<TValue>,
> extends LabeledInputControl<TProps> {
    static override liveProps = temporalInputLiveProps
    static override dependencies = [ErrorMessage]
    readonly inputId: string
    readonly errorId: string
    readonly valueEmitter: ValueEmitter<TValue | null>

    /** The native `<input>` type rendered by the concrete component. */
    protected abstract readonly inputType: 'date' | 'time' | 'datetime-local'

    /** Whether a raw input string belongs to this component's value domain. */
    protected abstract isValidValue(raw: string): boolean

    constructor(props: TProps) {
        super(props)
        const hostName = (this.constructor as {hostName?: string | null}).hostName
        this.inputId = controlId(hostName ?? 'temporal', props.id)
        this.errorId = `${this.inputId}-error`
        this.valueEmitter = createValueEmitter(this, props, null, `${hostName ?? 'temporal'} value`)
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    private handleEvent(event: Event): void {
        const input = event.currentTarget as HTMLInputElement
        if (this.props.readOnly) {
            const value = this.valueEmitter.get()
            input.value = value == null ? '' : String(value)
            return
        }
        const raw = input.value
        // An empty or domain-valid entry updates the emitter; an invalid
        // in-progress entry is reported as null without touching the emitter,
        // so the re-render cannot clobber the text the user is still typing.
        const valid = raw === '' || this.isValidValue(raw)
        const value = valid && raw !== '' ? raw as TValue : null
        if (valid && this.valueEmitter.get() !== value) {
            this.valueEmitter.set(value, `${this.inputType} input`)
        }
        const {onInput, onChange} = this.props
        if (event.type === 'input') {
            invoke(onInput, value, event)
        } else if (event.type === 'change') {
            invoke(onChange, value, event)
        }
    }

    render(): CapillaryUiChild {
        const {
            label,
            ariaLabel,
            name,
            autoComplete,
            disabled = false,
            required = false,
            readOnly = false,
            busy = false,
            error = null,
            min,
            max,
            step,
            inputRef,
        } = this.props
        const value = this.valueEmitter.get()

        const Host = this.Host
        return (
            <Host className={componentClass(this.props) || null}>
                {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
                <input
                    id={this.inputId}
                    name={name}
                    type={this.inputType}
                    value={value ?? ''}
                    min={min}
                    max={max}
                    step={step}
                    autoComplete={autoComplete}
                    disabled={disabled}
                    required={required}
                    readOnly={readOnly}
                    ref={inputRef}
                    aria-label={label == null ? ariaLabel : null}
                    aria-busy={busy ? 'true' : null}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    onInput={(event: Event) => this.handleEvent(event)}
                    onChange={(event: Event) => this.handleEvent(event)}
                />
                {error == null ? null : <ErrorMessage id={this.errorId} error={error} />}
            </Host>
        )
    }

    static override css = css`
        & {
            display: grid;
            grid-template-columns: minmax(var(--input-min-width, 6rem), 1fr);
            align-items: center;
            min-width: 0;
        }

        &:has(> label) {
            grid-template-columns: max-content minmax(var(--input-min-width, 6rem), 1fr);
        }

        & > input {
            min-height: var(--control-min-height, 2em);
            width: var(--input-width, max-content);
            max-width: 100%;
            min-width: var(--input-min-width, 6rem);
            margin: 0;
            margin-left: auto;
            padding: var(--ui-control-padding);
            color: var(--input-color);
            background: var(--input-background);
            border: var(--input-border);
            border-radius: var(--ui-border-radius);
            box-shadow: var(--input-shadow);
            box-sizing: border-box;
            font: inherit;
        }

        & > input:disabled {
            color: var(--input-color-disabled);
            background: var(--input-background-disabled);
            border-color: var(--ui-input-border-disabled);
            cursor: not-allowed;
        }

        & > input[readonly]:not(:disabled) {
            color: var(--input-color-readonly);
            background: var(--input-background-readonly);
            border: var(--input-border-readonly);
            box-shadow: var(--input-shadow-readonly);
            cursor: default;
        }

${requiredPresentationCss({
            outlineSelector: `& > input${requiredInputInvalidSelector}`,
            indicatorSelector: `&:has(> input${requiredInputInvalidSelector})`,
            indicatorInsetBlockStart: 'max(calc(var(--control-row-padding-block, .25em) + .15em), .3em)',
            indicatorInsetInlineEnd: '.35em',
        })}
        & > input:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        & > input[aria-busy="true"]:not([aria-invalid="true"]) {
            background: var(--working-background-image), var(--input-background);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
            animation: cap-working-progress .55s linear infinite;
        }

        & > input:disabled[aria-busy="true"]:not([aria-invalid="true"]) {
            background: var(--working-background-image), var(--input-background-disabled);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
        }

        & > input[readonly]:not(:disabled)[aria-busy="true"]:not([aria-invalid="true"]) {
            background: var(--working-background-image), var(--input-background-readonly);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
        }

        & > input[aria-invalid="true"] {
            border-color: var(--error-control-border);
            box-shadow: var(--error-control-shadow);
        }

        @media (prefers-reduced-motion: reduce) {
            & > input[aria-busy="true"] {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > input[aria-invalid="true"] {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `
}
