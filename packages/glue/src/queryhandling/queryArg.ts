import {Emitter} from '../emitters/emitter.js'
import type {EmitterOptions, ReadableEmitter} from '../emitters/baseEmitter.js'

/** A named reactive value used by LiveQuery. */
export class QueryArg<TValue, TError = unknown> extends Emitter<TValue, TError> {
    readonly name: string
    private sourceUnsubscribe: (() => void) | null

    constructor(
        name: string,
        source: ReadableEmitter<TValue, TError>,
        options: EmitterOptions<TValue, TError> = {},
    ) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new TypeError('QueryArg name must be a non-empty string')
        }
        if (source == null
            || typeof source.get !== 'function'
            || typeof source.subscribe !== 'function') {
            throw new TypeError('QueryArg source must be an emitter')
        }

        super(source.get(), {
            ...options,
            fetchState: source.getFetchState(),
            error: source.getError(),
            purpose: options.purpose ?? `query argument: ${name}`,
        })
        this.name = name
        this.sourceUnsubscribe = source.subscribe((notification) => {
            this.setWithState(
                notification.value,
                notification.fetchState,
                notification.error,
                notification.event,
            )
        }, {emitCurrent: false})
    }

    override dispose(): void {
        if (this.isDisposed) return
        this.sourceUnsubscribe?.()
        this.sourceUnsubscribe = null
        super.dispose()
    }
}
