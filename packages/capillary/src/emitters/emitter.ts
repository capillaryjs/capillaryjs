import {EventBubble} from '../debugging/eventBubble.js'
import {FetchState} from '../enums/fetchState.js'
import type {FetchStateValue} from '../enums/fetchState.js'
import {BaseEmitter} from './baseEmitter.js'
import type {EmitterOptions} from './baseEmitter.js'

export class Emitter<TValue, TError = unknown> extends BaseEmitter<TValue, TError> {
    constructor(initialValue: TValue, options: EmitterOptions<TValue, TError> = {}) {
        super(initialValue, options)
    }

    setWithState(
        value: TValue,
        fetchState: FetchStateValue = FetchState.Ready,
        error: TError | null = null,
        eventOrCause: EventBubble<unknown> | unknown = null,
    ): boolean {
        const parentEvent = eventOrCause instanceof EventBubble ? eventOrCause : null
        const cause = parentEvent ? 'set called' : (eventOrCause ?? 'set called')
        return this.setSnapshot({value, fetchState, error, cause, parentEvent})
    }

    set(value: TValue, eventOrCause: EventBubble<unknown> | unknown = null): boolean {
        return this.setWithState(value, FetchState.Ready, null, eventOrCause)
    }
}
