import type {EventBubble} from '../debugging/eventBubble.js'
import type {ReadableEmitter} from './baseEmitter.js'

/** Common caller-facing contract for remote and locally derived live results. */
export interface LiveResult<TValue, TError = unknown>
    extends ReadableEmitter<TValue, TError> {
    readonly disposed: boolean
    dispose(): void
}

/** Capabilities available only when a result can re-execute its source. */
export interface RefreshableLiveResult<TValue, TError = unknown>
    extends LiveResult<TValue, TError> {
    refresh(eventOrCause?: EventBubble<unknown> | unknown): Promise<TValue>
    retry(eventOrCause?: EventBubble<unknown> | unknown): Promise<TValue>
    abort(eventOrCause?: EventBubble<unknown> | unknown): void
}
