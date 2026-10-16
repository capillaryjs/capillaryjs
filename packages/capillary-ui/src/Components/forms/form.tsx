import {Emitter} from '@capillaryjs/capillary'
import {Component, css} from '../component.js'
import type {CapillaryUiChild, ComponentProps, LivePropContract, Ref} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {CommandInvocationPresentation, commandSource, validateCommandInteractionOptions} from '../commandSupport.js'
import type {CommandAction, CommandInteractionOptions} from '../commandSupport.js'
import {formatErrorMessage} from '../status/statusPresentation.js'
import {registerFormFeedback, removeFormFeedback} from './formFeedback.js'

export interface FormSubmission {
    readonly form: HTMLFormElement
    readonly submitter: HTMLElement | null
    readonly event: SubmitEvent
}
interface FormCommonProps<TArguments> extends ComponentProps, CommandInteractionOptions, LivePropContract<'disabled'> {
    id?: string
    label?: string
    name?: string
    submitCommand: CommandAction<TArguments>
    onSubmit?: never
    disabled?: boolean
    /** Guards repeat submission; it does not disable editable values or Cancel. */
    disableWhileRunning?: boolean
    noValidate?: boolean
    formRef?: Ref<HTMLFormElement>
}
export type FormProps<TArguments = void> = FormCommonProps<TArguments> & (
    [TArguments] extends [void]
        ? {submitArguments?: (submission: FormSubmission) => TArguments}
        : {submitArguments: (submission: FormSubmission) => TArguments}
)

/** Native validation and one explicit submit command, regardless of input method. */
export class Form<TArguments = void> extends Component<FormProps<TArguments>> {
    static override hostName = 'form'
    static override liveProps = ['disabled'] as const
    readonly errorId: string
    private readonly submitter = new Emitter<HTMLElement | null>(null)
    private readonly invocationError = new Emitter<unknown>(null)
    private readonly invocation = new CommandInvocationPresentation(() => this.syncInvocation())
    private readonly settings = new Emitter({source: commandSource(this.props.submitCommand)!,
        disabled: this.props.disabled ?? false, guardRunning: this.props.disableWhileRunning !== false,
        errorsInline: this.props.commandErrors !== 'external'}, {
        equals: (left, right) => left.source === right.source && left.disabled === right.disabled
            && left.guardRunning === right.guardRunning && left.errorsInline === right.errorsInline,
    })

    constructor(props: FormProps<TArguments>) {
        super(props)
        if (props.onSubmit != null) throw new TypeError('Form uses submitCommand, not a second onSubmit handler')
        if (commandSource(props.submitCommand) == null) throw new TypeError('Form requires submitCommand')
        if (props.submitArguments != null && typeof props.submitArguments !== 'function') throw new TypeError('Form submitArguments must be a function')
        validateCommandInteractionOptions(props)
        this.errorId = `${controlId('form', props.id)}-error`
        registerFormFeedback(this, {
            settings: this.settings, submitter: this.submitter, invocationError: this.invocationError,
            errorId: this.errorId,
        })
    }
    initialize(): void { this.watch(this.invocationError) }
    override setProps(props: FormProps<TArguments>): this {
        const changed = this.props.submitCommand !== props.submitCommand
        super.setProps(props)
        if (changed) { this.invocationError.set(null); this.submitter.set(null) }
        return this
    }
    render(): CapillaryUiChild {
        const source = commandSource(this.props.submitCommand)!
        this.settings.set({source, disabled: this.props.disabled ?? false,
            guardRunning: this.props.disableWhileRunning !== false, errorsInline: this.props.commandErrors !== 'external'})
        this.invocation.reconcile(this.props.submitCommand)
        const error = this.props.commandErrors === 'external' ? null : this.invocationError.get() ?? this.snapshot(source).error
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <form id={this.props.id} name={this.props.name} aria-label={this.props.label}
                noValidate={this.props.noValidate ?? false} ref={this.props.formRef}
                onSubmit={(event: SubmitEvent) => this.submit(event)}>{this.props.children}
                {error == null ? null : <p id={this.errorId} className="cap-form-error" role="alert">{formatErrorMessage(error, '')}</p>}
            </form>
        </Host>
    }
    private submit(event: SubmitEvent): void {
        event.preventDefault()
        const source = commandSource(this.props.submitCommand)!
        if (this.props.disabled || source.isRunning.get() && this.props.disableWhileRunning !== false) return
        const form = event.currentTarget as HTMLFormElement
        const submitter = event.submitter as HTMLElement | null
        // requestSubmit and native Enter already validate before dispatch. This
        // also refuses synthetic invalid submissions without bypassing a native
        // submitter's explicit formNoValidate policy.
        const skipValidation = form.noValidate || !!submitter && Reflect.get(submitter, 'formNoValidate') === true
        if (!skipValidation && !form.reportValidity()) return
        this.submitter.set(submitter ?? form.querySelector<HTMLElement>('button[type="submit"]:not(:disabled),input[type="submit"]:not(:disabled)'))
        this.invocationError.set(null)
        let arguments_: TArguments
        try {
            arguments_ = this.props.submitArguments?.({form, submitter, event}) as TArguments
        } catch (error) { this.reportInvocation(error); return }
        this.invocation.invoke(this.props.submitCommand, arguments_, event, {
            commandErrors: this.props.commandErrors ?? 'inline',
            onCommandInvocationError: error => this.reportInvocation(error),
        })
    }
    private syncInvocation(): void {
        this.invocationError.set(this.invocation.error(this.props.commandErrors ?? 'inline'))
        this.update()
    }
    private reportInvocation(error: unknown): void {
        if (this.props.commandErrors !== 'external') this.invocationError.set(error)
        this.props.onCommandInvocationError?.(error)
    }
    override onDestroy(): void {
        removeFormFeedback(this); this.submitter.dispose(); this.invocationError.dispose(); this.settings.dispose()
    }
    static override css = css`
        & { display: block; min-inline-size: 0; }
        & > form { margin: 0; min-inline-size: 0; }
        & .cap-form-error { color: var(--error-color); margin-block: .5rem; white-space: pre-wrap; }
    `
}
