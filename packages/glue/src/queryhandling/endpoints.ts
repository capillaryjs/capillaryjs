import {combineFetchStates, FetchState} from '../enums/fetchState.js'
import type {FetchStateValue} from '../enums/fetchState.js'
import {BaseEmitter} from '../emitters/baseEmitter.js'
import type {ReadableEmitter} from '../emitters/baseEmitter.js'
import {LiveQuery} from '../emitters/liveQuery.js'
import type {
    LiveQueryPollingOptions,
    QueryArgumentValues,
} from '../emitters/liveQuery.js'
import type {LiveResult} from '../emitters/liveResult.js'
import type {QueryHandlerLike, QueryValues} from './queryHandler.js'
import {RestQueryHandler} from './restQueryHandler.js'
import type {RestQueryHandlerOptions} from './restQueryHandler.js'

export type EndpointArgumentEmitters<TArguments extends QueryValues> = {
    [TName in keyof TArguments]: ReadableEmitter<TArguments[TName], unknown>
}

export interface EndpointQueryOptions {
    autoFetch?: boolean
    keepPreviousValue?: boolean
    polling?: LiveQueryPollingOptions
    owner?: unknown
    purpose?: string
    trace?: boolean
}

export interface QueryEndpointOptions<
    TArguments extends QueryValues,
    TResult,
> {
    handler: QueryHandlerLike<TArguments, TResult>
    query?: EndpointQueryOptions
}

/** Immutable reusable declaration for a query backed by any QueryHandler. */
export class QueryEndpoint<
    TArguments extends QueryValues = Record<string, never>,
    TResult = unknown,
> {
    readonly handler: QueryHandlerLike<TArguments, TResult>
    readonly queryOptions: Readonly<EndpointQueryOptions>

    constructor(options: QueryEndpointOptions<TArguments, TResult>) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('QueryEndpoint options must be an object')
        }
        if (options.handler == null || typeof options.handler.fetch !== 'function') {
            throw new TypeError('QueryEndpoint handler must implement fetch()')
        }
        const query = options.query ?? {}
        assertEndpointQueryOptions(query)
        this.handler = options.handler
        this.queryOptions = Object.freeze({...query})
        Object.freeze(this)
    }

    open<TEmitters extends EndpointArgumentEmitters<TArguments>>(
        args: TEmitters,
        options: EndpointQueryOptions = {},
    ): LiveQuery<TResult, TEmitters> {
        assertEndpointArguments(args)
        assertEndpointQueryOptions(options)
        return new LiveQuery<TResult, TEmitters>({
            handler: this.handler as QueryHandlerLike<QueryArgumentValues<TEmitters>, TResult>,
            args,
            ...this.queryOptions,
            ...options,
        })
    }
}

export function queryEndpoint<
    TArguments extends QueryValues = Record<string, never>,
    TResult = unknown,
>(options: QueryEndpointOptions<TArguments, TResult>): QueryEndpoint<TArguments, TResult> {
    return new QueryEndpoint(options)
}

export type RestEndpointOptions<TArguments extends QueryValues, TResult> =
    RestQueryHandlerOptions<TArguments, TResult> & {
        query?: EndpointQueryOptions
    }

/** Immutable reusable declaration for one REST-backed query endpoint. */
export class RestEndpoint<
    TArguments extends QueryValues = Record<string, never>,
    TResult = unknown,
> {
    readonly handler: RestQueryHandler<TArguments, TResult>
    readonly queryOptions: Readonly<EndpointQueryOptions>

    constructor(options: RestEndpointOptions<TArguments, TResult>) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('RestEndpoint options must be an object')
        }
        const {query = {}, ...handlerOptions} = options
        assertEndpointQueryOptions(query, 'RestEndpoint query options')
        this.handler = new RestQueryHandler(handlerOptions)
        this.queryOptions = Object.freeze({...query})
        Object.freeze(this)
    }

    open<TEmitters extends EndpointArgumentEmitters<TArguments>>(
        args: TEmitters,
        options: EndpointQueryOptions = {},
    ): LiveQuery<TResult, TEmitters> {
        assertEndpointArguments(args)
        assertEndpointQueryOptions(options)
        return new LiveQuery<TResult, TEmitters>({
            handler: this.handler as QueryHandlerLike<QueryArgumentValues<TEmitters>, TResult>,
            args,
            ...this.queryOptions,
            ...options,
        })
    }
}

export function restEndpoint<
    TArguments extends QueryValues = Record<string, never>,
    TResult = unknown,
>(options: RestEndpointOptions<TArguments, TResult>): RestEndpoint<TArguments, TResult> {
    return new RestEndpoint(options)
}

export interface DerivedEndpointOptions<
    TSource,
    TArguments extends QueryValues,
    TResult,
> {
    apply(source: TSource, args: TArguments): TResult
    purpose?: string
}

export interface OpenDerivedEndpointOptions<
    TSource,
    TArguments extends QueryValues,
    TSourceError,
> {
    source: ReadableEmitter<TSource, TSourceError>
    args: EndpointArgumentEmitters<TArguments>
    owner?: unknown
    purpose?: string
    trace?: boolean
}

/** Immutable declaration for a local live projection over another result. */
export class DerivedEndpoint<
    TSource,
    TArguments extends QueryValues,
    TResult,
> {
    readonly apply: (source: TSource, args: TArguments) => TResult
    readonly purpose: string

    constructor(options: DerivedEndpointOptions<TSource, TArguments, TResult>) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('DerivedEndpoint options must be an object')
        }
        if (typeof options.apply !== 'function') {
            throw new TypeError('DerivedEndpoint apply must be a function')
        }
        this.apply = options.apply
        this.purpose = options.purpose ?? 'derived endpoint'
        Object.freeze(this)
    }

    open<TSourceError = unknown>(
        options: OpenDerivedEndpointOptions<TSource, TArguments, TSourceError>,
    ): DerivedLiveResult<TSource, TArguments, TResult, TSourceError> {
        return new DerivedLiveResult({
            ...options,
            apply: this.apply,
            purpose: options.purpose ?? this.purpose,
        })
    }
}

export function derivedEndpoint<
    TSource,
    TArguments extends QueryValues,
    TResult,
>(options: DerivedEndpointOptions<TSource, TArguments, TResult>):
DerivedEndpoint<TSource, TArguments, TResult> {
    return new DerivedEndpoint(options)
}

interface DerivedLiveResultOptions<
    TSource,
    TArguments extends QueryValues,
    TResult,
    TSourceError,
> extends OpenDerivedEndpointOptions<TSource, TArguments, TSourceError> {
    apply(source: TSource, args: TArguments): TResult
}

/** Caller-owned local result produced by a DerivedEndpoint declaration. */
export class DerivedLiveResult<
    TSource,
    TArguments extends QueryValues,
    TResult,
    TSourceError = unknown,
> extends BaseEmitter<TResult, unknown>
implements LiveResult<TResult, unknown> {
    readonly source: ReadableEmitter<TSource, TSourceError>
    readonly args: EndpointArgumentEmitters<TArguments>
    private readonly apply: (source: TSource, args: TArguments) => TResult
    private unsubscribers: Array<() => void> = []
    private lastSuccessfulValue: TResult

    constructor(options: DerivedLiveResultOptions<TSource, TArguments, TResult, TSourceError>) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('DerivedLiveResult options must be an object')
        }
        assertEndpointArguments(options.args)
        if (!isReadableEmitter(options.source)) {
            throw new TypeError('DerivedLiveResult source must be an emitter')
        }
        if (typeof options.apply !== 'function') {
            throw new TypeError('DerivedLiveResult apply must be a function')
        }
        super(undefined as TResult, {
            fetchState: FetchState.Initial,
            error: null,
            owner: options.owner,
            ...(options.purpose === undefined ? {} : {purpose: options.purpose}),
            ...(options.trace === undefined ? {} : {trace: options.trace}),
        })
        this.source = options.source
        this.args = {...options.args}
        this.apply = options.apply
        this.lastSuccessfulValue = undefined as TResult
        const sources: Array<ReadableEmitter<unknown, unknown>> = [
            this.source,
            ...Object.values(this.args),
        ]
        this.unsubscribers = sources.map((source) => source.subscribe(({event}) => {
            this.recompute(event)
        }, {emitCurrent: false}))
        this.recompute(null, false)
    }

    override dispose(): void {
        if (this.isDisposed) return
        for (const unsubscribe of this.unsubscribers) unsubscribe()
        this.unsubscribers = []
        super.dispose()
    }

    private recompute(parentEvent: import('../debugging/eventBubble.js').EventBubble<unknown> | null,
        notify = true): void {
        const sources: ReadonlyArray<ReadableEmitter<unknown, unknown>> = [
            this.source,
            ...Object.values(this.args),
        ]
        const sourceError = sources.find((source) => source.getError() != null)?.getError() ?? null
        let fetchState: FetchStateValue = combineFetchStates(
            sources.map((source) => source.getFetchState()),
        )
        const sourceValue = this.source.get()
        let value = this.lastSuccessfulValue
        let error: unknown = sourceError

        try {
            const argumentValues = Object.fromEntries(
                Object.entries(this.args).map(([name, argument]) => [name, argument.get()]),
            ) as TArguments
            value = this.apply(sourceValue, argumentValues)
            this.lastSuccessfulValue = value
        } catch (caught) {
            error = caught
            fetchState = FetchState.Error
        }
        if (sourceError != null) {
            error = sourceError
            fetchState = FetchState.Error
        }

        if (!notify) {
            this.value = value
            this.fetchState = fetchState
            this.error = error
            return
        }
        this.setSnapshot({
            value,
            fetchState,
            error,
            cause: 'derived endpoint source changed',
            parentEvent,
        })
    }
}

function assertEndpointQueryOptions(
    value: unknown,
    label = 'Endpoint query options',
): asserts value is EndpointQueryOptions {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${label} must be an object`)
    }
}

function assertEndpointArguments(value: unknown): asserts value is Record<
string,
ReadableEmitter<unknown, unknown>
> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('Endpoint args must be a named record of emitters')
    }
    for (const [name, argument] of Object.entries(value)) {
        if (!isReadableEmitter(argument)) {
            throw new TypeError(`Endpoint argument ${name} must be an emitter`)
        }
    }
}

function isReadableEmitter(value: unknown): value is ReadableEmitter<unknown, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'getFetchState') === 'function'
        && typeof Reflect.get(value, 'getError') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}
