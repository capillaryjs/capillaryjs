import {css} from '../component.js'
import type {CapillaryUiChild, LivePropContract, Ref} from '../component.js'
import {
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {LabeledInputControl} from './LabeledInputControl.js'

const textboxLiveProps = ['disabled', 'required', 'readOnly', 'busy', 'error'] as const

export interface TextboxProps extends ValueControlProps<string>,
    LivePropContract<(typeof textboxLiveProps)[number]> {
    id?: string | number | null
    label?: CapillaryUiChild
    placeholder?: string
    type?: string
    name?: string
    disabled?: boolean
    required?: boolean
    readOnly?: boolean
    busy?: boolean
    error?: unknown
    autoComplete?: string
    inputMode?: string
    minLength?: number
    maxLength?: number
    pattern?: string
    ariaLabel?: string
    inputRef?: Ref<HTMLInputElement>
    onInput?: (value: string, event: Event) => void
    onChange?: (value: string, event: Event) => void
}

export class Textbox extends LabeledInputControl<TextboxProps> {
    static override liveProps = textboxLiveProps
    static override dependencies = [ErrorMessage]
    readonly inputId: string
    readonly errorId: string
    readonly valueEmitter: ValueEmitter<string>

    constructor(props: TextboxProps = {}) {
        super(props)
        this.inputId = controlId('textbox', props.id)
        this.errorId = `${this.inputId}-error`
        this.valueEmitter = createValueEmitter(this, props, '', 'textbox value')
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    render(): CapillaryUiChild {
        const {
            label,
            placeholder,
            type = 'text',
            name,
            disabled = false,
            required = false,
            readOnly = false,
            busy = false,
            error = null,
            autoComplete,
            inputMode,
            minLength,
            maxLength,
            pattern,
            ariaLabel,
            inputRef,
            onInput,
            onChange,
        } = this.props
        const value = this.valueEmitter.get() ?? ''

        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
            <input
                id={this.inputId}
                name={name}
                type={type}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                readOnly={readOnly}
                autoComplete={autoComplete}
                inputMode={inputMode}
                minLength={minLength}
                maxLength={maxLength}
                pattern={pattern}
                ref={inputRef}
                aria-label={label == null ? ariaLabel : null}
                aria-busy={busy ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
                onInput={(event: Event) => {
                    const nextValue = eventValue(event, 'textbox input')
                    this.valueEmitter.set(nextValue, 'textbox input')
                    invoke(onInput, nextValue, event)
                }}
                onChange={(event: Event) => invoke(
                    onChange,
                    eventValue(event, 'textbox change'),
                    event,
                )}
            />
            {error == null ? null : <ErrorMessage id={this.errorId} error={error} />}
        </Host>
    }

    static override hostName = 'textbox'

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
            width: var(--input-width, 15rem);
            max-width: 100%;
            min-width: var(--input-min-width, 6rem);
            margin: 0;
            padding: var(--ui-control-padding);
            color: var(--input-color);
            background: var(--input-background);
            border: var(--input-border);
            border-radius: var(--ui-border-radius);
            box-shadow: var(--input-shadow);
            box-sizing: border-box;
            font: inherit;
            appearance: none;
            pointer-events: all;
            user-select: text;
            white-space: nowrap;
            cursor: text;
            margin-left: auto;
        }

        & > input:disabled {
            color: var(--input-color-disabled);
            background: var(--input-background-disabled);
            border-color: var(--ui-input-border-disabled);
            cursor: not-allowed;
        }

        & > input:required:invalid:not(:disabled):not([readonly]):not([aria-invalid="true"]) {
            outline: 1px dashed var(--required-color);
            outline-offset: 3px;
        }

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

        & > input[aria-invalid="true"] {
            border-color: var(--error-color);
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

function eventValue(event: Event, purpose: string): string {
    const target = event.currentTarget
    if (target == null || typeof Reflect.get(target, 'value') !== 'string') {
        throw new TypeError(`${purpose} requires a value-bearing event target`)
    }
    return Reflect.get(target, 'value') as string
}
