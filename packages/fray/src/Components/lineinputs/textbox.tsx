import {css} from '../component.js'
import type {FrayChild, LivePropContract, Ref} from '../component.js'
import {
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {LabeledInputControl} from './LabeledInputControl.js'

const textboxLiveProps = ['disabled', 'required', 'readOnly', 'error'] as const

export interface TextboxProps extends ValueControlProps<string>,
    LivePropContract<(typeof textboxLiveProps)[number]> {
    id?: string | number | null
    label?: FrayChild
    placeholder?: string
    type?: string
    name?: string
    disabled?: boolean
    required?: boolean
    readOnly?: boolean
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

    render(): FrayChild {
        const {
            label,
            placeholder,
            type = 'text',
            name,
            disabled = false,
            required = false,
            readOnly = false,
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
            {error == null ? null : <p
                id={this.errorId}
                role="alert"
            >{String(error)}</p>}
        </Host>
    }

    static override hostName = 'textbox'

    static override css = css`
        & {
            min-width: 0;
        }

        & > input {
            min-height: var(--control-min-height, 2rem);
            width: var(--input-width, 15rem);
            max-width: 100%;
            min-width: var(--input-min-width, 6rem);
            padding: var(--space-xs) var(--space-sm);
            color: var(--input-color);
            background: var(--input-background);
            border: var(--input-border);
            border-radius: var(--radius-md);
            box-shadow: var(--input-shadow);
            box-sizing: border-box;
            font: inherit;
            pointer-events: all;
            user-select: text;
            white-space: nowrap;
            cursor: text;
        }

        & > input:disabled {
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

        & > [role="alert"] {
            margin: 0;
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
