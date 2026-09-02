import {EventBubble} from '../debugging/eventBubble.js'
import {EventBus} from '../debugging/eventBus.js'
import {QueryHandler} from './queryHandler.js'
import type {AbortSignalLike, QueryRequestOptions, QueryValues} from './queryHandler.js'

export interface SearchParamsLike {
    append(name: string, value: string): void
    set(name: string, value: string): void
}

export interface UrlLike {
    readonly searchParams: SearchParamsLike
    toString(): string
}

export interface JsonResponseLike<TResult> {
    readonly ok: boolean
    readonly status?: number
    json(): TResult | PromiseLike<TResult>
}

export type FetchLike<TResult> = {
    bivarianceHack(
        url: string,
        options?: {signal?: AbortSignalLike | null},
    ): JsonResponseLike<TResult>
        | JsonResponseLike<unknown>
        | PromiseLike<JsonResponseLike<TResult> | JsonResponseLike<unknown>>
}['bivarianceHack']

export type QuerySerializer<TArguments extends QueryValues> = (
    url: UrlLike,
    args: TArguments,
) => void | UrlLike

export interface RestQueryHandlerOptions<
    TArguments extends QueryValues,
    TResult,
> {
    url: string
    baseUrl?: string
    fetch?: FetchLike<TResult>
    serialize?: QuerySerializer<TArguments>
    trace?: boolean
}

interface UrlConstructor {
    new(url: string, base?: string): UrlLike
}

class HttpError extends Error {
    readonly status: number | undefined

    constructor(status: number | undefined) {
        super(`HTTP ${status ?? 'unknown'}`)
        this.name = 'HttpError'
        this.status = status
    }
}

/** Fetch-based JSON query adapter with injectable environment capabilities. */
export class RestQueryHandler<
    TArguments extends QueryValues = QueryValues,
    TResult = unknown,
> extends QueryHandler<TArguments, TResult> {
    readonly url: string
    readonly baseUrl: string | undefined
    readonly fetchImplementation: FetchLike<TResult>
    readonly serialize: QuerySerializer<TArguments>
    readonly trace: boolean

    constructor(options: string | RestQueryHandlerOptions<TArguments, TResult>) {
        super()
        const normalized = typeof options === 'string' ? {url: options} : options
        if (normalized == null || typeof normalized !== 'object') {
            throw new TypeError('RestQueryHandler requires a URL or options object')
        }
        if (typeof normalized.url !== 'string' || normalized.url.length === 0) {
            throw new TypeError('RestQueryHandler url must be a non-empty string')
        }

        this.url = normalized.url
        this.baseUrl = normalized.baseUrl ?? getLocationHref()
        this.fetchImplementation = normalized.fetch ?? getGlobalFetch<TResult>()
        this.serialize = normalized.serialize ?? serializeQuery
        this.trace = normalized.trace ?? false

        if (typeof this.fetchImplementation !== 'function') {
            throw new TypeError('RestQueryHandler requires an injected fetch implementation')
        }
        if (typeof this.serialize !== 'function') {
            throw new TypeError('RestQueryHandler serialize must be a function')
        }
    }

    override async fetch(args: TArguments, options: QueryRequestOptions = {}): Promise<TResult> {
        if (args == null || typeof args !== 'object' || Array.isArray(args)) {
            throw new TypeError('REST query args must be a named record')
        }

        const url = resolveUrl(this.url, this.baseUrl)
        const serialized = this.serialize(url, args) ?? url
        const Url = getUrlConstructor()
        if (!(serialized instanceof Url)) {
            throw new TypeError('REST serializer must mutate or return a URL')
        }

        const parent = options.event ?? null
        if (this.trace || parent || EventBus.hasSubscribers) {
            const event = new EventBubble({
                owner: this,
                purpose: 'REST fetch',
                value: serialized.toString(),
                cause: 'fetch called',
                parent,
            })
            if (!parent) EventBus.emit(event)
        }

        const fetchOptions = options.signal === undefined ? {} : {signal: options.signal}
        const response = await this.fetchImplementation(serialized.toString(), fetchOptions)
        if (!response?.ok) throw new HttpError(response?.status)
        return await response.json() as TResult
    }
}

function serializeQuery<TArguments extends QueryValues>(
    url: UrlLike,
    args: TArguments,
): UrlLike {
    for (const [key, value] of Object.entries(args)) {
        appendValue(url.searchParams, key, value)
    }
    return url
}

function appendValue(params: SearchParamsLike, key: string, value: unknown): void {
    if (value === undefined) return
    if (value === null) {
        params.append(key, '')
        return
    }
    if (Array.isArray(value)) {
        for (const item of value) appendValue(params, key, item)
        return
    }
    if (typeof value === 'object') {
        params.append(key, JSON.stringify(value))
        return
    }
    params.append(key, String(value))
}

function resolveUrl(url: string, baseUrl: string | undefined): UrlLike {
    const Url = getUrlConstructor()
    try {
        return new Url(url)
    } catch (error) {
        if (baseUrl == null) {
            throw new TypeError(`Relative REST URL requires baseUrl: ${url}`, {cause: error})
        }
        return new Url(url, baseUrl)
    }
}

function getUrlConstructor(): UrlConstructor {
    const constructor = Reflect.get(globalThis, 'URL')
    if (typeof constructor !== 'function') {
        throw new Error('RestQueryHandler requires URL in this runtime')
    }
    return constructor as UrlConstructor
}

function getLocationHref(): string | undefined {
    const location = Reflect.get(globalThis, 'location')
    if (location == null || (typeof location !== 'object' && typeof location !== 'function')) {
        return undefined
    }
    const href = Reflect.get(location, 'href')
    return typeof href === 'string' ? href : undefined
}

function getGlobalFetch<TResult>(): FetchLike<TResult> {
    const implementation = Reflect.get(globalThis, 'fetch')
    return implementation as unknown as FetchLike<TResult>
}
