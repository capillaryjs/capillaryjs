import type {EventBubble} from '../debugging/eventBubble.js'

export type QueryValues = Record<string, unknown>

/** Minimal web-platform shape so Glue core does not require DOM declarations. */
export interface AbortSignalLike {
    readonly aborted: boolean
}

export interface QueryRequestOptions {
    signal?: AbortSignalLike
    event?: EventBubble<unknown> | null
}

export interface QueryHandlerLike<
    TArguments extends QueryValues,
    TResult,
> {
    fetch(
        args: TArguments,
        options?: QueryRequestOptions,
    ): TResult | PromiseLike<TResult>
}

/** Interface/base class for asynchronous query adapters. */
export class QueryHandler<
    TArguments extends QueryValues = QueryValues,
    TResult = unknown,
> implements QueryHandlerLike<TArguments, TResult> {
    fetch(_args: TArguments, _options: QueryRequestOptions = {}): TResult | PromiseLike<TResult> {
        throw new Error('fetch() must be implemented')
    }
}
