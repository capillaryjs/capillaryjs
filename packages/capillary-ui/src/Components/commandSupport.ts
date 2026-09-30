import type {ReadableEmitter} from '@capillaryjs/capillary'

/** A direct payload command or a previously argument-bound command. */
export type CommandAction<TPayload> = CommandRunner<TPayload> | CommandBindingAction

/** Where a control presents failures that happen before a command can settle. */
export type CommandErrorPresentation = 'inline' | 'external'

/** Shared optional props for a control that declares a command interaction. */
export interface CommandInteractionOptions {
    /** Show command and invocation failures beside the control (the default). */
    commandErrors?: CommandErrorPresentation | undefined
    /** Receives sampler and rejected-invocation failures outside command state. */
    onCommandInvocationError?: ((error: unknown) => void) | undefined
}

/** Runtime validation for JavaScript consumers of command-aware props. */
export function validateCommandInteractionOptions(options: CommandInteractionOptions): void {
    const mode = options.commandErrors
    if (mode != null && mode !== 'inline' && mode !== 'external') {
        throw new TypeError('commandErrors must be "inline" or "external"')
    }
    if (options.onCommandInvocationError != null
        && typeof options.onCommandInvocationError !== 'function') {
        throw new TypeError('onCommandInvocationError must be a function')
    }
    if (mode === 'external' && options.onCommandInvocationError == null) {
        throw new TypeError('commandErrors="external" requires onCommandInvocationError')
    }
}

/** The minimum command lifecycle surface consumed by a presentation control. */
export interface CommandRunner<TPayload> {
    readonly isRunning: ReadableEmitter<boolean, never>
    run(arguments_: TPayload, eventOrCause?: unknown): PromiseLike<unknown>
}

/** The callable structural shape returned by Capillary's `bindCommand()`. */
export interface CommandBindingAction {
    (eventOrCause?: unknown): PromiseLike<unknown>
    readonly command: unknown
}

/** The lifecycle owner behind either form of command action. */
export type CommandSource = ReadableEmitter<unknown, unknown> & {
    readonly isRunning: ReadableEmitter<boolean, never>
    run(arguments_: unknown, eventOrCause?: unknown): Promise<unknown>
}

export function commandSource(action: unknown): CommandSource | null {
    if (action == null) return null
    if (typeof action === 'function') {
        const command = Reflect.get(action, 'command')
        if (isCommand(command)) return command
    }
    if (isCommand(action)) return action
    throw new TypeError('command must be an AsyncCommand or bindCommand result')
}

/**
 * Per-control transient state for failures outside `AsyncCommand`'s snapshot,
 * such as a throwing argument sampler or a rejected concurrency invocation.
 */
export class CommandInvocationPresentation {
    private action: unknown = null
    private invocation = 0
    private localError: unknown = null

    constructor(private readonly requestUpdate: () => void) {}

    reconcile(action: unknown): void {
        if (this.action === action) return
        this.action = action
        this.localError = null
        this.invocation += 1
    }

    error(mode: CommandErrorPresentation = 'inline'): unknown {
        return mode === 'inline' ? this.localError : null
    }

    invoke<TPayload>(
        action: CommandAction<TPayload>,
        payload: TPayload,
        eventOrCause: unknown,
        options: CommandInteractionOptions = {},
    ): void {
        this.reconcile(action)
        const invocation = ++this.invocation
        this.localError = null
        this.requestUpdate()
        const fail = (error: unknown): void => {
            this.report(error, options.onCommandInvocationError)
            if (options.commandErrors !== 'external'
                && this.action === action && this.invocation === invocation) {
                this.localError = error
                this.requestUpdate()
            }
        }
        try {
            const result = typeof action === 'function'
                ? action(eventOrCause)
                : action.run(payload, eventOrCause)
            void Promise.resolve(result).catch(fail)
        } catch (error) {
            fail(error)
        }
    }

    private report(error: unknown, reporter: ((error: unknown) => void) | undefined): void {
        if (reporter == null) {
            reportInvocationError(error)
            return
        }
        try {
            reporter(error)
        } catch (reporterError) {
            reportInvocationError(reporterError)
        }
    }
}

function isCommand(value: unknown): value is CommandSource {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'run') === 'function'
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'getError') === 'function'
        && Reflect.get(value, 'isRunning') != null
}

function reportInvocationError(error: unknown): void {
    if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
    else console.error(error)
}
