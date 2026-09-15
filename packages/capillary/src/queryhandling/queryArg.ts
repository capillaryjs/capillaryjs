import {Emitter} from '../emitters/emitter.js'
import type {BaseEmitter, EmitterOptions, ReadableEmitter} from '../emitters/baseEmitter.js'

/** A named reactive value used by LiveQuery. */
export class QueryArg<TValue, TError = unknown> extends Emitter<TValue, TError> {
    readonly name: string
    private sourceUnsubscribe: (() => void) | null
    private readonly source: ReadableEmitter<TValue, TError>

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
            diagnosticScope: options.diagnosticScope ?? (source as BaseEmitter<TValue, TError>).diagnosticScope,
            fetchState: source.getFetchState(),
            error: source.getError(),
            purpose: options.purpose ?? `query argument: ${name}`,
        })
        this.name = name
        this.source = source
        this.sourceUnsubscribe = source.subscribe((notification) => {
            this.setWithState(
                notification.value,
                notification.fetchState,
                notification.error,
                notification.event,
            )
        }, {emitCurrent: false, diagnosticTarget: this})
    }

    override dispose(): void {
        if (this.isDisposed) return
        this.sourceUnsubscribe?.()
        this.sourceUnsubscribe = null
        super.dispose()
    }

    protected override diagnosticSources(): readonly object[] { return this.source ? [this.source] : [] }
}
