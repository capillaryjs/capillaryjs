import {FetchState} from '@capillaryjs/capillary'
import {css} from '../component.js'
import type {CapillaryUiChild, LivePropContract, Ref} from '../component.js'
import {componentClass, controlId, createValueEmitter, invoke} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {LabeledInputControl} from './LabeledInputControl.js'
import {inputDescription} from './inputDescription.js'
import type {InputDescriptionProps} from './inputDescription.js'
import {requiredInputInvalidSelector, requiredPresentationCss} from './requiredPresentation.js'
import {CommandInvocationPresentation, commandSource, validateCommandInteractionOptions} from '../commandSupport.js'
import type {CommandAction, CommandInteractionOptions} from '../commandSupport.js'

const textareaLiveProps = ['disabled', 'required', 'readOnly', 'busy', 'error'] as const
interface TextAreaCommonProps extends ValueControlProps<string>, InputDescriptionProps,
    LivePropContract<(typeof textareaLiveProps)[number]>, CommandInteractionOptions {
    id?: string | number | null
    label?: CapillaryUiChild
    name?: string
    placeholder?: string
    rows?: number
    cols?: number
    wrap?: 'soft' | 'hard' | 'off'
    disabled?: boolean
    required?: boolean
    readOnly?: boolean
    busy?: boolean
    error?: unknown
    autoComplete?: string
    spellCheck?: boolean
    minLength?: number
    maxLength?: number
    ariaLabel?: string
    inputRef?: Ref<HTMLTextAreaElement>
    disableWhileRunning?: boolean
    onInput?: (value: string, event: Event) => void
    onFocus?: (event: FocusEvent) => void
    onBlur?: (event: FocusEvent) => void
}
export type TextAreaProps = TextAreaCommonProps & (
    | {changeCommand: CommandAction<string>; onChange?: never}
    | {changeCommand?: never; onChange?: (value: string, event: Event) => void}
)

/** Native multiline text, with no token/newline codec or application draft store. */
export class TextArea extends LabeledInputControl<TextAreaProps> {
    static override hostName = 'textarea'
    static override liveProps = textareaLiveProps
    static override dependencies = [ErrorMessage]
    readonly inputId: string
    readonly errorId: string
    readonly valueEmitter: ValueEmitter<string>
    private lastCommittedValue: string
    private readonly commandPresentation = new CommandInvocationPresentation(() => this.update())
    constructor(props: TextAreaProps = {}) {
        super(props)
        if (props.changeCommand != null && props.onChange != null) throw new TypeError('TextArea changeCommand and onChange are mutually exclusive')
        validateCommandInteractionOptions(props)
        this.inputId = controlId('textarea', props.id); this.errorId = `${this.inputId}-error`
        this.valueEmitter = createValueEmitter(this, props, '', 'textarea value')
        this.lastCommittedValue = this.valueEmitter.get() ?? ''
    }
    initialize(): void { this.watch(this.valueEmitter) }
    render(): CapillaryUiChild {
        const {label, name, placeholder, rows = 3, cols, wrap = 'soft', disabled = false, required = false,
            readOnly = false, busy = false, error = null, autoComplete, spellCheck, minLength, maxLength,
            ariaLabel, inputRef, changeCommand, disableWhileRunning = true, commandErrors = 'inline', onCommandInvocationError, onInput, onChange, onFocus, onBlur} = this.props
        if (!Number.isInteger(rows) || rows < 1 || cols != null && (!Number.isInteger(cols) || cols < 1)) throw new TypeError('TextArea rows/cols must be positive integers')
        this.commandPresentation.reconcile(changeCommand)
        const command = commandSource(changeCommand), value = this.valueEmitter.get() ?? ''
        const running = command == null ? false : this.read(command.isRunning)
        const valueFetchState = this.valueEmitter.getFetchState()
        const valueLoading = valueFetchState === FetchState.Initial || valueFetchState === FetchState.Loading
        const displayedError = error ?? this.commandPresentation.error(commandErrors)
            ?? (command == null || commandErrors === 'external' ? null : this.snapshot(command).error)
        const working = busy || valueLoading || running, unavailable = disabled || running && disableWhileRunning
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
            <textarea id={this.inputId} name={name} value={value} placeholder={placeholder} rows={rows} cols={cols}
                wrap={wrap} disabled={unavailable} required={required} readOnly={readOnly} autoComplete={autoComplete}
                spellcheck={spellCheck} minLength={minLength} maxLength={maxLength} ref={inputRef}
                aria-label={label == null ? ariaLabel : null} aria-busy={working ? 'true' : null}
                data-cap-busy-visible={this.presentBusy(working && displayedError == null) ? '' : null}
                {...inputDescription(this.props, displayedError, this.errorId)}
                onFocus={onFocus == null ? undefined : (event: FocusEvent) => invoke(onFocus, event)}
                onBlur={onBlur == null ? undefined : (event: FocusEvent) => invoke(onBlur, event)}
                onInput={(event: Event) => {
                    const target = event.currentTarget as HTMLTextAreaElement
                    if (readOnly || unavailable) { target.value = value; return }
                    this.valueEmitter.set(target.value, 'textarea input'); invoke(onInput, target.value, event)
                }}
                onChange={(event: Event) => {
                    if (readOnly || unavailable) return
                    const nextValue = (event.currentTarget as HTMLTextAreaElement).value
                    invoke(onChange, nextValue, event)
                    if (changeCommand != null && nextValue !== this.lastCommittedValue) {
                        this.lastCommittedValue = nextValue
                        this.commandPresentation.invoke(changeCommand, nextValue, event, {commandErrors, onCommandInvocationError})
                    }
                }}/>
            {displayedError == null ? null : <ErrorMessage id={this.errorId} error={displayedError}/>}
        </Host>
    }
    static override css = css`
        & { display: grid; grid-template-columns: minmax(var(--input-min-width, 6rem), 1fr); min-inline-size: 0; }
        &:has(> label) { grid-template-columns: max-content minmax(var(--input-min-width, 6rem), 1fr); }
        & > label { align-self: start; }
        & > textarea {
            inline-size: var(--input-width, 20rem); max-inline-size: 100%; min-inline-size: 0;
            box-sizing: border-box; margin: 0; padding: var(--ui-control-padding); resize: vertical;
            color: var(--input-color); background: var(--input-background); border: var(--input-border);
            border-radius: var(--ui-border-radius); box-shadow: var(--input-shadow); font: inherit;
            user-select: text; line-height: 1.4;
        }
        & > textarea:focus-visible { outline: 2px solid transparent; outline-offset: 1px; box-shadow: var(--focus-ring); }
        & > textarea:disabled { color: var(--input-color-disabled); background: var(--input-background-disabled); cursor: not-allowed; }
        & > textarea[readonly]:not(:disabled) { color: var(--input-color-readonly); background: var(--input-background-readonly); border: var(--input-border-readonly); }
${requiredPresentationCss({
            outlineSelector: `& > textarea${requiredInputInvalidSelector}`,
            indicatorSelector: `&:has(> textarea${requiredInputInvalidSelector})`,
            indicatorInsetBlockStart: '.35em',
            indicatorInsetInlineEnd: '.35em',
        })}
        & > textarea[data-cap-busy-visible]:not([aria-invalid="true"]) {
            background-image: var(--working-background-image); background-size: 2rem 2rem; animation: cap-working-progress .55s linear infinite;
        }
        & > textarea[aria-invalid="true"] { border-color: var(--error-control-border); box-shadow: var(--error-control-shadow); }
        @media (prefers-reduced-motion: reduce) { & > textarea[data-cap-busy-visible] { animation: none; } }
        @media (forced-colors: active) { & > textarea[aria-invalid="true"] { outline: 2px solid Mark; } }
    `
}
