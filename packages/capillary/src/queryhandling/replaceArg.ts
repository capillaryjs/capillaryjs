import type {FetchStateValue} from '../enums/fetchState.js'
import type {
    EmitterNotification,
    ReadableEmitter,
    SubscribeOptions,
} from '../emitters/baseEmitter.js'

/**
 * Marks a query argument as a conceptual dataset boundary.
 *
 * A `LiveQuery` retains its last successful value for ordinary argument
 * changes. Wrap an argument with `replaceArg()` when a change must clear that
 * value while its replacement is loading, such as a project or account switch.
 */
class ReplacementQueryArgument<TValue, TError = unknown>
implements ReadableEmitter<TValue, TError> {
    constructor(readonly source: ReadableEmitter<TValue, TError>) {
        Object.freeze(this)
    }

    get(): TValue {
        return this.source.get()
    }

    getFetchState(): FetchStateValue {
        return this.source.getFetchState()
    }

    getError(): TError | null {
        return this.source.getError()
    }

    subscribe(
        listener: (notification: EmitterNotification<TValue, TError>) => void,
        options?: SubscribeOptions,
    ): () => void {
        return this.source.subscribe(listener, options)
    }
}

/** Mark a readable query argument as an explicit result-replacement boundary. */
export function replaceArg<TValue, TError = unknown>(
    source: ReadableEmitter<TValue, TError>,
): ReadableEmitter<TValue, TError> {
    if (isReplacementArgument(source)) return source
    if (source == null
        || typeof source.get !== 'function'
        || typeof source.subscribe !== 'function') {
        throw new TypeError('replaceArg source must be an emitter')
    }
    return new ReplacementQueryArgument(source)
}

/** Returns true when a value was marked by `replaceArg()`. */
export function isReplacementArgument(value: unknown): boolean {
    return value instanceof ReplacementQueryArgument
}
