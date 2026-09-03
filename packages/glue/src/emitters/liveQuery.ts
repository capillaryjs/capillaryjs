import {EventBubble} from '../debugging/eventBubble.js'
import {FetchState} from '../enums/fetchState.js'
import type {QueryHandlerLike, QueryRequestOptions, QueryValues} from '../queryhandling/queryHandler.js'
import {BaseEmitter} from './baseEmitter.js'
import type {EmitterValue, ReadableEmitter} from './baseEmitter.js'
import type {RefreshableLiveResult} from './liveResult.js'

export type QueryArgumentEmitters = Record<string, ReadableEmitter<unknown, unknown>>

export type QueryArgumentValues<TArguments extends QueryArgumentEmitters> = {
    [TName in keyof TArguments]: EmitterValue<TArguments[TName]>
}

export interface PollingScheduler {
    schedule(callback: () => void, delayMs: number): unknown
    cancel(handle: unknown): void
}

export interface LiveQueryPollingOptions {
    intervalMs: number | ReadableEmitter<number, unknown>
    enabled?: boolean | ReadableEmitter<boolean, unknown>
    scheduler?: PollingScheduler
}

export interface LiveQueryOptions<
    TResult,
    TArguments extends QueryArgumentEmitters,
> {
    handler: QueryHandlerLike<QueryArgumentValues<TArguments>, TResult>
    args?: TArguments
    autoFetch?: boolean
    keepPreviousValue?: boolean
    polling?: LiveQueryPollingOptions
    owner?: unknown
    purpose?: string
    trace?: boolean
}

interface AbortControllerLike {
    readonly signal: QueryRequestOptions['signal'] & {readonly aborted: boolean}
    abort(): void
}

interface AbortControllerConstructor {
    new(): AbortControllerLike
}

/** Reactive, abortable query driven by a named record of emitter arguments. */
export class LiveQuery<
    TResult,
    TArguments extends QueryArgumentEmitters = Record<string, never>,
> extends BaseEmitter<TResult | undefined, unknown>
implements RefreshableLiveResult<TResult | undefined, unknown> {
    readonly handler: QueryHandlerLike<QueryArgumentValues<TArguments>, TResult>
    readonly args: TArguments
    readonly keepPreviousValue: boolean
    private lastSuccessfulValue: TResult | undefined
    private hasSuccessfulValue = false
    private argumentUnsubscribers: Array<() => void>
    private pollingUnsubscribers: Array<() => void> = []
    private readonly polling: LiveQueryPollingOptions | undefined
    private readonly pollingScheduler: PollingScheduler
    private pollingHandle: unknown = null
    private requestId = 0
    private abortController: AbortControllerLike | null = null
    /** Exposed for deterministic tests; consumers should use refresh()/retry(). */
    _activeRequest: Promise<TResult | undefined> | null = null

    constructor(options: LiveQueryOptions<TResult, TArguments>) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('LiveQuery options must be an object')
        }
        const {
            handler,
            args = {} as TArguments,
            autoFetch = true,
            keepPreviousValue = true,
            polling,
            owner,
            purpose = 'live query',
            trace,
        } = options
        if (handler == null || typeof handler.fetch !== 'function') {
            throw new TypeError('LiveQuery handler must implement fetch()')
        }
        assertNamedArgs(args)
        if (polling != null) assertPollingOptions(polling)

        super(undefined, {
            fetchState: FetchState.Initial,
            error: null,
            owner,
            purpose,
            ...(trace === undefined ? {} : {trace}),
        })
        this.handler = handler
        this.args = {...args}
        this.keepPreviousValue = keepPreviousValue
        this.polling = polling
        this.pollingScheduler = polling?.scheduler ?? defaultPollingScheduler
        this.lastSuccessfulValue = undefined
        this.argumentUnsubscribers = Object.values(this.args).map((argument) =>
            argument.subscribe(({event}) => {
                void this.refresh(event)
            }, {emitCurrent: false}),
        )

        if (polling != null) this.initializePolling(polling)

        if (autoFetch) this._activeRequest = this.refresh('initial fetch')
        this.scheduleNextPoll()
    }

    get argumentValues(): QueryArgumentValues<TArguments> {
        return Object.fromEntries(
            Object.entries(this.args).map(([name, argument]) => [name, argument.get()]),
        ) as QueryArgumentValues<TArguments>
    }

    refresh(eventOrCause: EventBubble<unknown> | unknown = 'refresh'): Promise<TResult | undefined> {
        if (this.isDisposed) return Promise.resolve(undefined)

        const requestId = ++this.requestId
        this.abortController?.abort()
        const controller = createAbortController()
        this.abortController = controller
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        const cause = parentEvent ? 'query arguments changed' : eventOrCause
        const loadingValue = this.keepPreviousValue
            ? this.lastSuccessfulValue
            : undefined
        this.setSnapshot({
            value: loadingValue,
            fetchState: FetchState.Loading,
            error: null,
            cause,
            parentEvent,
        })
        const queryEvent = this.createEvent('query fetch', parentEvent, this.argumentValues)

        const request = Promise.resolve()
            .then(() => this.handler.fetch(this.argumentValues, {
                signal: controller.signal,
                event: queryEvent,
            }))
            .then((result) => {
                if (!this.isCurrentRequest(requestId, controller)) return undefined
                this.lastSuccessfulValue = result
                this.hasSuccessfulValue = true
                this.setSnapshot({
                    value: result,
                    fetchState: FetchState.Ready,
                    error: null,
                    cause: 'query succeeded',
                    parentEvent: queryEvent,
                })
                return result
            })
            .catch((error: unknown) => {
                if (!this.isCurrentRequest(requestId, controller) || isAbortError(error)) {
                    return undefined
                }
                this.setSnapshot({
                    value: this.keepPreviousValue ? this.lastSuccessfulValue : undefined,
                    fetchState: FetchState.Error,
                    error,
                    cause: 'query failed',
                    parentEvent: queryEvent,
                })
                return undefined
            })
            .finally(() => {
                if (this.isCurrentRequest(requestId, controller)) {
                    this.abortController = null
                    this._activeRequest = null
                }
            })

        this._activeRequest = request
        return request
    }

    retry(eventOrCause: EventBubble<unknown> | unknown = 'retry'): Promise<TResult | undefined> {
        return this.refresh(eventOrCause)
    }

    abort(eventOrCause: EventBubble<unknown> | unknown = 'query aborted'): void {
        if (this.isDisposed || this.abortController == null) return
        this.requestId += 1
        this.abortController.abort()
        this.abortController = null
        this._activeRequest = null
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        this.setSnapshot({
            value: this.hasSuccessfulValue ? this.lastSuccessfulValue : undefined,
            fetchState: this.hasSuccessfulValue ? FetchState.Ready : FetchState.Initial,
            error: null,
            cause: parentEvent == null ? eventOrCause : 'query aborted',
            parentEvent,
        })
    }

    override dispose(): void {
        if (this.isDisposed) return
        this.requestId += 1
        this.abortController?.abort()
        this.abortController = null
        this._activeRequest = null
        this.cancelScheduledPoll()
        for (const unsubscribe of this.argumentUnsubscribers) unsubscribe()
        this.argumentUnsubscribers = []
        for (const unsubscribe of this.pollingUnsubscribers) unsubscribe()
        this.pollingUnsubscribers = []
        super.dispose()
    }

    private initializePolling(polling: LiveQueryPollingOptions): void {
        for (const source of [polling.intervalMs, polling.enabled]) {
            if (!isReadableEmitter(source)) continue
            this.pollingUnsubscribers.push(source.subscribe(() => {
                assertPollingInterval(readPollingValue(polling.intervalMs))
                assertPollingEnabled(readPollingValue(polling.enabled, true))
                this.cancelScheduledPoll()
                this.scheduleNextPoll()
            }, {emitCurrent: false}))
        }
    }

    private scheduleNextPoll(): void {
        if (this.isDisposed || this.polling == null || this.pollingHandle != null) return
        if (!readPollingValue(this.polling.enabled, true)) return
        const intervalMs = readPollingValue(this.polling.intervalMs)
        assertPollingInterval(intervalMs)
        this.pollingHandle = this.pollingScheduler.schedule(() => {
            this.pollingHandle = null
            this.scheduleNextPoll()
            if (this._activeRequest == null) void this.refresh('poll')
        }, intervalMs)
    }

    private cancelScheduledPoll(): void {
        if (this.pollingHandle == null) return
        this.pollingScheduler.cancel(this.pollingHandle)
        this.pollingHandle = null
    }

    private isCurrentRequest(requestId: number, controller: AbortControllerLike): boolean {
        return !this.isDisposed
            && requestId === this.requestId
            && controller === this.abortController
            && !controller.signal.aborted
    }
}

const defaultPollingScheduler: PollingScheduler = {
    schedule(callback, delayMs) {
        const schedule = Reflect.get(globalThis, 'setTimeout')
        if (typeof schedule !== 'function') {
            throw new Error('LiveQuery polling requires an injected scheduler in this runtime')
        }
        return Reflect.apply(schedule, globalThis, [callback, delayMs])
    },
    cancel(handle) {
        const cancel = Reflect.get(globalThis, 'clearTimeout')
        if (typeof cancel === 'function') Reflect.apply(cancel, globalThis, [handle])
    },
}

function isReadableEmitter(value: unknown): value is ReadableEmitter<never, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}

function assertPollingSource(value: unknown, name: string): void {
    if (typeof value !== 'number' && typeof value !== 'boolean' && !isReadableEmitter(value)) {
        throw new TypeError(`LiveQuery polling ${name} must be a value or emitter`)
    }
}

function assertPollingOptions(polling: LiveQueryPollingOptions): void {
    if (polling == null || typeof polling !== 'object' || Array.isArray(polling)) {
        throw new TypeError('LiveQuery polling options must be an object')
    }
    assertPollingSource(polling.intervalMs, 'intervalMs')
    if (polling.enabled !== undefined) assertPollingSource(polling.enabled, 'enabled')
    assertPollingInterval(readPollingValue(polling.intervalMs))
    assertPollingEnabled(readPollingValue(polling.enabled, true))
    if (polling.scheduler != null
        && (typeof polling.scheduler.schedule !== 'function'
            || typeof polling.scheduler.cancel !== 'function')) {
        throw new TypeError('LiveQuery polling scheduler must implement schedule() and cancel()')
    }
}

function readPollingValue<TValue>(
    value: TValue | ReadableEmitter<TValue, unknown> | undefined,
    fallback?: TValue,
): TValue {
    if (value === undefined) return fallback as TValue
    if (isReadableEmitter(value)) return value.get() as TValue
    return value as TValue
}

function assertPollingInterval(value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError('LiveQuery polling intervalMs must be a finite positive number')
    }
}

function assertPollingEnabled(value: boolean): void {
    if (typeof value !== 'boolean') {
        throw new TypeError('LiveQuery polling enabled must be a boolean')
    }
}

function assertNamedArgs(args: unknown): asserts args is QueryArgumentEmitters {
    if (args == null || typeof args !== 'object' || Array.isArray(args)) {
        throw new TypeError('LiveQuery args must be a named record of emitters')
    }
    for (const [name, argument] of Object.entries(args)) {
        if (argument == null
            || typeof Reflect.get(argument, 'get') !== 'function'
            || typeof Reflect.get(argument, 'subscribe') !== 'function') {
            throw new TypeError(`LiveQuery argument ${name} must be an emitter`)
        }
    }
}

function createAbortController(): AbortControllerLike {
    const constructor = Reflect.get(globalThis, 'AbortController')
    if (typeof constructor !== 'function') {
        throw new Error('LiveQuery requires AbortController in this runtime')
    }
    return new (constructor as AbortControllerConstructor)()
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
}

// QueryArgumentValues always produces a record, but keeping this assertion near
// the handler boundary makes that relationship explicit in emitted declarations.
type _QueryValuesProof<T extends QueryValues> = T
type _LiveQueryValuesAreRecords<TArgs extends QueryArgumentEmitters> =
    _QueryValuesProof<QueryArgumentValues<TArgs>>
