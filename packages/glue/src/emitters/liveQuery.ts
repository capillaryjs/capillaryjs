import {EventBubble} from '../debugging/eventBubble.js'
import {FetchState} from '../enums/fetchState.js'
import type {QueryHandlerLike, QueryRequestOptions, QueryValues} from '../queryhandling/queryHandler.js'
import {BaseEmitter} from './baseEmitter.js'
import type {EmitterValue, ReadableEmitter} from './baseEmitter.js'

export type QueryArgumentEmitters = Record<string, ReadableEmitter<unknown, unknown>>

export type QueryArgumentValues<TArguments extends QueryArgumentEmitters> = {
    [TName in keyof TArguments]: EmitterValue<TArguments[TName]>
}

export interface LiveQueryOptions<
    TResult,
    TArguments extends QueryArgumentEmitters,
> {
    handler: QueryHandlerLike<QueryArgumentValues<TArguments>, TResult>
    args?: TArguments
    autoFetch?: boolean
    keepPreviousValue?: boolean
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
> extends BaseEmitter<TResult | undefined, unknown> {
    readonly handler: QueryHandlerLike<QueryArgumentValues<TArguments>, TResult>
    readonly args: TArguments
    readonly keepPreviousValue: boolean
    private lastSuccessfulValue: TResult | undefined
    private argumentUnsubscribers: Array<() => void>
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
            owner,
            purpose = 'live query',
            trace,
        } = options
        if (handler == null || typeof handler.fetch !== 'function') {
            throw new TypeError('LiveQuery handler must implement fetch()')
        }
        assertNamedArgs(args)

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
        this.lastSuccessfulValue = undefined
        this.argumentUnsubscribers = Object.values(this.args).map((argument) =>
            argument.subscribe(({event}) => {
                void this.refresh(event)
            }, {emitCurrent: false}),
        )

        if (autoFetch) this._activeRequest = this.refresh('initial fetch')
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

    override dispose(): void {
        if (this.isDisposed) return
        this.requestId += 1
        this.abortController?.abort()
        this.abortController = null
        this._activeRequest = null
        for (const unsubscribe of this.argumentUnsubscribers) unsubscribe()
        this.argumentUnsubscribers = []
        super.dispose()
    }

    private isCurrentRequest(requestId: number, controller: AbortControllerLike): boolean {
        return !this.isDisposed
            && requestId === this.requestId
            && controller === this.abortController
            && !controller.signal.aborted
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
