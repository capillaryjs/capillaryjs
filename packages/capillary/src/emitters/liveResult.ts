import type {EventBubble} from '../debugging/eventBubble.js'
import type {ReadableEmitter} from './baseEmitter.js'

/** Controls whether a new request may continue displaying its prior result. */
export type LiveQueryRetention = 'retain' | 'replace'

/** Per-request presentation policy for a refresh or retry. */
export interface LiveQueryRefreshOptions {
    /**
     * `retain` is the default: a successful prior value remains available while
     * the next request is loading. `replace` clears that value immediately.
     */
    retention?: LiveQueryRetention
}

/** Common caller-facing contract for remote and locally derived live results. */
export interface LiveResult<TValue, TError = unknown>
    extends ReadableEmitter<TValue, TError> {
    readonly disposed: boolean
    dispose(): void
}

/** Capabilities available only when a result can re-execute its source. */
export interface RefreshableLiveResult<TValue, TError = unknown>
    extends LiveResult<TValue, TError> {
    refresh(
        eventOrCause?: EventBubble<unknown> | unknown,
        options?: LiveQueryRefreshOptions,
    ): Promise<TValue>
    retry(
        eventOrCause?: EventBubble<unknown> | unknown,
        options?: LiveQueryRefreshOptions,
    ): Promise<TValue>
    abort(eventOrCause?: EventBubble<unknown> | unknown): void
}
