import {EventBubble} from '../debugging/eventBubble.js'
import {Diagnostics} from '../debugging/diagnostics.js'
import type {DiagnosticNodeKind, DiagnosticScope} from '../debugging/diagnostics.js'
import {DiagnosticOperation} from '../debugging/diagnosticOperation.js'
import {BaseEmitter} from '../emitters/baseEmitter.js'
import type {ReadableEmitter} from '../emitters/baseEmitter.js'
import {Emitter} from '../emitters/emitter.js'
import {OccurrenceEmitter} from '../emitters/occurrence.js'
import type {CommandSuccess, OccurrenceSource} from '../emitters/occurrence.js'
import {FetchState} from '../enums/fetchState.js'
import type {AbortSignalLike} from '../queryhandling/queryHandler.js'
import {computeRetryDelay, isAbortError, resolveRetryPolicy} from '../retryPolicy.js'
import type {ResolvedRetryPolicy, RetryPolicy} from '../retryPolicy.js'

export type AsyncCommandConcurrency = 'ignore' | 'replace' | 'reject'

export interface AsyncCommandContext {
    readonly signal: AbortSignalLike
    readonly event: EventBubble<unknown> | null
    /** Optional application-provided request key, stable across retry attempts. */
    readonly idempotencyKey: string | undefined
}

export type AsyncCommandExecutor<TArguments, TResult> = (
    arguments_: TArguments,
    context: AsyncCommandContext,
) => TResult | PromiseLike<TResult>

export interface AsyncCommandOptions<TArguments, TResult, TError = unknown> {
    execute: AsyncCommandExecutor<TArguments, TResult>
    concurrency?: AsyncCommandConcurrency
    /**
     * Opt-in retry policy for failed attempts. Retrying a non-idempotent
     * executor can apply a mutation more than once; pair with shouldRetry.
     */
    retry?: RetryPolicy | null
    /** Supplies a request key once per logical invocation; transport owns its encoding. */
    idempotencyKey?: (arguments_: TArguments) => string | undefined
    mapError?: (error: unknown) => TError
    /** Observes listener/connection failures without altering command success. */
    onNotificationError?: (error: unknown) => void
    owner?: unknown
    purpose?: string
    trace?: boolean
    diagnosticScope?: DiagnosticScope | undefined
}

interface AbortControllerLike {
    readonly signal: AbortSignalLike
    abort(): void
}

interface AbortControllerConstructor {
    new(): AbortControllerLike
}

export class AsyncCommandConcurrencyError extends Error {
    constructor() {
        super('AsyncCommand is already running')
        this.name = 'AsyncCommandConcurrencyError'
    }
}

/** Abortable mutation state with an explicit concurrency policy. */
export class AsyncCommand<TArguments, TResult, TError = unknown>
    extends BaseEmitter<TResult | undefined, TError> {
    readonly execute: AsyncCommandExecutor<TArguments, TResult>
    readonly concurrency: AsyncCommandConcurrency
    readonly isRunning: ReadableEmitter<boolean, never>
    /** Future-only accepted command completions; never inferred from snapshot equality. */
    readonly succeeded: OccurrenceSource<CommandSuccess<TArguments, TResult>>
    private readonly mapError: (error: unknown) => TError
    private readonly runningEmitter: Emitter<boolean, never>
    private readonly retryPolicy: ResolvedRetryPolicy | null
    private readonly idempotencyKey: ((arguments_: TArguments) => string | undefined) | undefined
    private readonly onNotificationError: (error: unknown) => void
    private readonly succeededEmitter: OccurrenceEmitter<CommandSuccess<TArguments, TResult>>
    private retryWait: {handle: unknown, cancel: () => void} | null = null
    private requestId = 0
    private abortController: AbortControllerLike | null = null
    private diagnosticOperation: DiagnosticOperation | null = null
    private lastSuccessfulValue: TResult | undefined
    private hasSuccessfulValue = false
    /** Exposed for deterministic tests; consumers should use run()/abort(). */
    _activeRequest: Promise<TResult | undefined> | null = null

    constructor(options: AsyncCommandOptions<TArguments, TResult, TError>) {
        assertOptions(options)
        const {
            execute,
            concurrency = 'ignore',
            retry,
            idempotencyKey,
            mapError = (error: unknown) => error as TError,
            onNotificationError = defaultNotificationErrorReporter,
            owner,
            purpose = 'async command',
            trace,
            diagnosticScope,
        } = options
        assertConcurrency(concurrency)
        if (typeof mapError !== 'function') {
            throw new TypeError('AsyncCommand mapError must be a function')
        }
        if (idempotencyKey !== undefined && typeof idempotencyKey !== 'function') {
            throw new TypeError('AsyncCommand idempotencyKey must be a function')
        }
        if (typeof onNotificationError !== 'function') {
            throw new TypeError('AsyncCommand onNotificationError must be a function')
        }
        super(undefined, {
            fetchState: FetchState.Initial,
            error: null,
            owner,
            purpose,
            diagnosticScope,
            ...(trace === undefined ? {} : {trace}),
        })
        this.execute = execute
        this.concurrency = concurrency
        this.retryPolicy = resolveRetryPolicy(retry)
        this.idempotencyKey = idempotencyKey
        this.mapError = mapError
        this.onNotificationError = onNotificationError
        this.succeededEmitter = new OccurrenceEmitter((error) => this.reportNotificationError(error))
        this.succeeded = this.succeededEmitter
        this.runningEmitter = new Emitter<boolean, never>(false, {
            owner: owner ?? this,
            purpose: `${purpose}:running`,
            diagnosticScope: this.diagnosticScope,
            ...(trace === undefined ? {} : {trace}),
        })
        this.isRunning = this.runningEmitter
    }

    run(
        arguments_: TArguments,
        eventOrCause: EventBubble<unknown> | unknown = 'command run',
    ): Promise<TResult | undefined> {
        if (this.isDisposed) return Promise.resolve(undefined)
        if (this._activeRequest != null) {
            if (this.concurrency === 'ignore') return this._activeRequest
            if (this.concurrency === 'reject') {
                return Promise.reject(new AsyncCommandConcurrencyError())
            }
            this.abortController?.abort()
            this.diagnosticOperation?.close('superseded')
        }
        this.cancelRetryWait()

        const requestId = ++this.requestId
        let idempotencyKey: string | undefined
        try {
            idempotencyKey = this.idempotencyKey?.(arguments_)
        } catch (error: unknown) {
            this.reportNotificationError(error)
            return Promise.resolve(undefined)
        }
        if (idempotencyKey !== undefined && typeof idempotencyKey !== 'string') {
            throw new TypeError('AsyncCommand idempotencyKey must return a string or undefined')
        }
        const controller = createAbortController()
        this.abortController = controller
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : Diagnostics.currentEvent
        const cause = parentEvent ? 'parent command requested' : eventOrCause
        let commandEvent = Diagnostics.active ? this.createEvent('command execute', parentEvent, arguments_,
            {kind: 'operation', outcome: 'started'}) : null
        const operation = Diagnostics.active && this.diagnosticScope.capture
            ? new DiagnosticOperation(this, commandEvent) : null
        this.diagnosticOperation = operation
        operation?.begin(arguments_)
        this.publish(() => this.setSnapshot({
            value: this.lastSuccessfulValue,
            fetchState: FetchState.Loading,
            error: null,
            cause,
            parentEvent: operation?.event ?? parentEvent,
        }))
        commandEvent ??= this.createEvent('command execute', parentEvent, arguments_)
        this.publish(() => this.runningEmitter.set(true, commandEvent ?? cause))

        const request = Promise.resolve()
            .then(() => this.runAttempts(arguments_, requestId, controller, commandEvent, operation, idempotencyKey))
            .finally(() => {
                if (!this.isCurrentRequest(requestId, controller)) return
                this.abortController = null
                this._activeRequest = null
                this.diagnosticOperation = null
                this.publish(() => this.runningEmitter.set(false, commandEvent ?? 'command settled'))
            })

        this._activeRequest = request
        return request
    }

    private async runAttempts(
        arguments_: TArguments,
        requestId: number,
        controller: AbortControllerLike,
        commandEvent: EventBubble<unknown> | null,
        operation: DiagnosticOperation | null,
        idempotencyKey: string | undefined,
    ): Promise<TResult | undefined> {
        for (let attempt = 1; ; attempt += 1) {
            try {
                if (attempt > 1) operation?.begin(arguments_)
                try {
                    const invoke = (event: EventBubble<unknown> | null) => this.execute(arguments_, {
                        signal: controller.signal,
                        event,
                        idempotencyKey,
                    })
                    const result = await (operation ? operation.invoke(arguments_, invoke) : invoke(commandEvent))
                    if (!this.isCurrentRequest(requestId, controller)) { operation?.ignored(result); return undefined }
                    this.lastSuccessfulValue = result
                    this.hasSuccessfulValue = true
                    const completion = operation?.settle('succeeded', result)
                    // Publish only after the executor/retry region has settled.
                    // Listener failures are reported but cannot re-run a mutation.
                    this.publish(() => this.setSnapshot({
                        value: result,
                        fetchState: FetchState.Ready,
                        error: null,
                        cause: 'command succeeded',
                        parentEvent: completion ?? commandEvent,
                    }))
                    operation?.close('succeeded')
                    this.releaseCompletedRequest(requestId, controller, commandEvent)
                    this.succeededEmitter.emit(Object.freeze({
                        id: requestId,
                        arguments: arguments_,
                        result,
                        event: completion ?? commandEvent,
                    }))
                    return result
                } catch (error: unknown) {
                    if (!this.isCurrentRequest(requestId, controller)) { operation?.ignored(undefined, error); return undefined }
                    const completion = operation?.settle(isAbortError(error) ? 'aborted' : 'failed', undefined, error)
                    const retry = this.retryPolicy
                    if (isAbortError(error)
                        || retry == null
                        || attempt >= retry.maxAttempts
                        || !retry.shouldRetry(error, attempt)) {
                        this.publish(() => this.setSnapshot({
                            value: this.lastSuccessfulValue,
                            fetchState: FetchState.Error,
                            error: this.mapCommandError(error),
                            cause: 'command failed',
                            parentEvent: completion ?? commandEvent,
                        }))
                        operation?.close(isAbortError(error) ? 'aborted' : 'failed')
                        return undefined
                    }
                    const delayMs = computeRetryDelay(retry, attempt, error)
                    this.createEvent('command retry', completion ?? commandEvent, {attempt, delayMs, error},
                        {kind: 'retry', outcome: 'scheduled', delayMs})
                    if (!await this.waitRetryDelay(retry, delayMs, requestId, controller)) {
                        return undefined
                    }
                }
            } catch (error: unknown) {
                if (!this.isCurrentRequest(requestId, controller)) return undefined
                operation?.close('failed')
                this.publish(() => this.setSnapshot({
                    value: this.lastSuccessfulValue,
                    fetchState: FetchState.Error,
                    error: this.mapCommandError(error),
                    cause: 'command retry infrastructure failed',
                    parentEvent: commandEvent,
                }))
                return undefined
            }
        }
    }

    private waitRetryDelay(
        retry: ResolvedRetryPolicy,
        delayMs: number,
        requestId: number,
        controller: AbortControllerLike,
    ): Promise<boolean> {
        if (delayMs <= 0) {
            return Promise.resolve(this.isCurrentRequest(requestId, controller))
        }
        return new Promise<boolean>((resolve) => {
            const handle = retry.scheduler.schedule(() => {
                this.retryWait = null
                resolve(this.isCurrentRequest(requestId, controller))
            }, delayMs)
            this.retryWait = {
                handle,
                cancel: () => {
                    retry.scheduler.cancel(handle)
                    resolve(false)
                },
            }
        })
    }

    private cancelRetryWait(): void {
        const wait = this.retryWait
        this.retryWait = null
        wait?.cancel()
    }

    abort(eventOrCause: EventBubble<unknown> | unknown = 'command aborted'): boolean {
        if (this.isDisposed || this.abortController == null) return false
        this.diagnosticOperation?.close('aborted')
        this.diagnosticOperation = null
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        const cause = parentEvent ? 'parent command aborted' : eventOrCause
        this.requestId += 1
        this.abortController.abort()
        this.abortController = null
        this._activeRequest = null
        this.cancelRetryWait()
        this.publish(() => this.runningEmitter.set(false, parentEvent ?? cause))
        this.publish(() => this.setSnapshot({
            value: this.lastSuccessfulValue,
            fetchState: this.hasSuccessfulValue ? FetchState.Ready : FetchState.Initial,
            error: null,
            cause,
            parentEvent,
        }))
        return true
    }

    reset(eventOrCause: EventBubble<unknown> | unknown = 'command reset'): void {
        if (this.isDisposed) return
        this.abort(eventOrCause)
        this.lastSuccessfulValue = undefined
        this.hasSuccessfulValue = false
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        this.publish(() => this.setSnapshot({
            value: undefined,
            fetchState: FetchState.Initial,
            error: null,
            cause: parentEvent ? 'parent command reset' : eventOrCause,
            parentEvent,
        }))
    }

    override dispose(): void {
        if (this.isDisposed) return
        this.diagnosticOperation?.close('aborted')
        this.diagnosticOperation = null
        this.requestId += 1
        this.abortController?.abort()
        this.abortController = null
        this._activeRequest = null
        this.cancelRetryWait()
        this.publish(() => this.runningEmitter.set(false, 'command disposed'))
        this.runningEmitter.dispose()
        this.succeededEmitter.dispose()
        super.dispose()
    }

    private isCurrentRequest(requestId: number, controller: AbortControllerLike): boolean {
        return !this.isDisposed
            && requestId === this.requestId
            && controller === this.abortController
            && !controller.signal.aborted
    }

    private releaseCompletedRequest(
        requestId: number,
        controller: AbortControllerLike,
        event: EventBubble<unknown> | null,
    ): void {
        if (!this.isCurrentRequest(requestId, controller)) return
        this.abortController = null
        this._activeRequest = null
        this.diagnosticOperation = null
        this.publish(() => this.runningEmitter.set(false, event ?? 'command settled'))
    }

    private mapCommandError(error: unknown): TError {
        try {
            return this.mapError(error)
        } catch (mappingError: unknown) {
            return mappingError as TError
        }
    }
    private publish(callback: () => unknown): void {
        try {
            callback()
        } catch (error: unknown) {
            this.reportNotificationError(error)
        }
    }
    private reportNotificationError(error: unknown): void {
        try {
            this.onNotificationError(error)
        } catch {
            // Reporting must not change the executor's accepted outcome.
        }
    }
    protected override get diagnosticKind(): DiagnosticNodeKind { return 'command' }
}

function defaultNotificationErrorReporter(error: unknown): void {
    // Applications that need an explicit error channel provide
    // onNotificationError. The core cannot throw here without turning a
    // completed mutation back into a rejected run.
    void error
}

function assertOptions<TArguments, TResult, TError>(
    options: AsyncCommandOptions<TArguments, TResult, TError>,
): void {
    if (options == null || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('AsyncCommand options must be an object')
    }
    if (typeof options.execute !== 'function') {
        throw new TypeError('AsyncCommand execute must be a function')
    }
}

function assertConcurrency(value: string): asserts value is AsyncCommandConcurrency {
    if (value !== 'ignore' && value !== 'replace' && value !== 'reject') {
        throw new TypeError(`Unknown AsyncCommand concurrency policy: ${value}`)
    }
}

function createAbortController(): AbortControllerLike {
    const constructor = Reflect.get(globalThis, 'AbortController')
    if (typeof constructor !== 'function') {
        throw new Error('AsyncCommand requires AbortController in this runtime')
    }
    return new (constructor as AbortControllerConstructor)()
}
