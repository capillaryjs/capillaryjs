import {EventBubble} from '../debugging/eventBubble.js'
import {BaseEmitter} from '../emitters/baseEmitter.js'
import type {ReadableEmitter} from '../emitters/baseEmitter.js'
import {Emitter} from '../emitters/emitter.js'
import {FetchState} from '../enums/fetchState.js'
import type {AbortSignalLike} from '../queryhandling/queryHandler.js'

export type AsyncCommandConcurrency = 'ignore' | 'replace' | 'reject'

export interface AsyncCommandContext {
    readonly signal: AbortSignalLike
    readonly event: EventBubble<unknown> | null
}

export type AsyncCommandExecutor<TArguments, TResult> = (
    arguments_: TArguments,
    context: AsyncCommandContext,
) => TResult | PromiseLike<TResult>

export interface AsyncCommandOptions<TArguments, TResult, TError = unknown> {
    execute: AsyncCommandExecutor<TArguments, TResult>
    concurrency?: AsyncCommandConcurrency
    mapError?: (error: unknown) => TError
    owner?: unknown
    purpose?: string
    trace?: boolean
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
    private readonly mapError: (error: unknown) => TError
    private readonly runningEmitter: Emitter<boolean, never>
    private requestId = 0
    private abortController: AbortControllerLike | null = null
    private lastSuccessfulValue: TResult | undefined
    private hasSuccessfulValue = false
    /** Exposed for deterministic tests; consumers should use run()/abort(). */
    _activeRequest: Promise<TResult | undefined> | null = null

    constructor(options: AsyncCommandOptions<TArguments, TResult, TError>) {
        assertOptions(options)
        const {
            execute,
            concurrency = 'ignore',
            mapError = (error: unknown) => error as TError,
            owner,
            purpose = 'async command',
            trace,
        } = options
        assertConcurrency(concurrency)
        if (typeof mapError !== 'function') {
            throw new TypeError('AsyncCommand mapError must be a function')
        }
        super(undefined, {
            fetchState: FetchState.Initial,
            error: null,
            owner,
            purpose,
            ...(trace === undefined ? {} : {trace}),
        })
        this.execute = execute
        this.concurrency = concurrency
        this.mapError = mapError
        this.runningEmitter = new Emitter<boolean, never>(false, {
            owner: owner ?? this,
            purpose: `${purpose}:running`,
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
        }

        const requestId = ++this.requestId
        const controller = createAbortController()
        this.abortController = controller
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        const cause = parentEvent ? 'parent command requested' : eventOrCause
        this.setSnapshot({
            value: this.lastSuccessfulValue,
            fetchState: FetchState.Loading,
            error: null,
            cause,
            parentEvent,
        })
        const commandEvent = this.createEvent('command execute', parentEvent, arguments_)
        this.runningEmitter.set(true, commandEvent ?? cause)

        const request = Promise.resolve()
            .then(() => this.execute(arguments_, {
                signal: controller.signal,
                event: commandEvent,
            }))
            .then((result) => {
                if (!this.isCurrentRequest(requestId, controller)) return undefined
                this.lastSuccessfulValue = result
                this.hasSuccessfulValue = true
                this.setSnapshot({
                    value: result,
                    fetchState: FetchState.Ready,
                    error: null,
                    cause: 'command succeeded',
                    parentEvent: commandEvent,
                })
                return result
            })
            .catch((error: unknown) => {
                if (!this.isCurrentRequest(requestId, controller)) return undefined
                this.setSnapshot({
                    value: this.lastSuccessfulValue,
                    fetchState: FetchState.Error,
                    error: this.mapCommandError(error),
                    cause: 'command failed',
                    parentEvent: commandEvent,
                })
                return undefined
            })
            .finally(() => {
                if (!this.isCurrentRequest(requestId, controller)) return
                this.abortController = null
                this._activeRequest = null
                this.runningEmitter.set(false, commandEvent ?? 'command settled')
            })

        this._activeRequest = request
        return request
    }

    abort(eventOrCause: EventBubble<unknown> | unknown = 'command aborted'): boolean {
        if (this.isDisposed || this.abortController == null) return false
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        const cause = parentEvent ? 'parent command aborted' : eventOrCause
        this.requestId += 1
        this.abortController.abort()
        this.abortController = null
        this._activeRequest = null
        this.runningEmitter.set(false, parentEvent ?? cause)
        this.setSnapshot({
            value: this.lastSuccessfulValue,
            fetchState: this.hasSuccessfulValue ? FetchState.Ready : FetchState.Initial,
            error: null,
            cause,
            parentEvent,
        })
        return true
    }

    reset(eventOrCause: EventBubble<unknown> | unknown = 'command reset'): void {
        if (this.isDisposed) return
        this.abort(eventOrCause)
        this.lastSuccessfulValue = undefined
        this.hasSuccessfulValue = false
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        this.setSnapshot({
            value: undefined,
            fetchState: FetchState.Initial,
            error: null,
            cause: parentEvent ? 'parent command reset' : eventOrCause,
            parentEvent,
        })
    }

    override dispose(): void {
        if (this.isDisposed) return
        this.requestId += 1
        this.abortController?.abort()
        this.abortController = null
        this._activeRequest = null
        this.runningEmitter.set(false, 'command disposed')
        this.runningEmitter.dispose()
        super.dispose()
    }

    private isCurrentRequest(requestId: number, controller: AbortControllerLike): boolean {
        return !this.isDisposed
            && requestId === this.requestId
            && controller === this.abortController
            && !controller.signal.aborted
    }

    private mapCommandError(error: unknown): TError {
        try {
            return this.mapError(error)
        } catch (mappingError: unknown) {
            return mappingError as TError
        }
    }
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
