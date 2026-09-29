import type {AsyncCommand} from './commands/asyncCommand.js'
import type {ReadableEmitter, WritableEmitter} from './emitters/baseEmitter.js'
import {BaseEmitter} from './emitters/baseEmitter.js'
import type {EmitterNotification, EmitterOptions} from './emitters/baseEmitter.js'
import {EventBubble} from './debugging/eventBubble.js'
import {OccurrenceEmitter} from './emitters/occurrence.js'
import type {OccurrenceSource} from './emitters/occurrence.js'

/** One future value-snapshot change, for explicit value-trigger wiring. */
export interface ValueChange<TValue, TError = unknown> {
    readonly value: TValue
    readonly fetchState: EmitterNotification<TValue, TError>['fetchState']
    readonly error: TError | null
    readonly event: EventBubble<unknown> | null
}

export interface ValueChangesOptions<TValue> {
    /** Defaults to Object.is; use domain equality when reference identity is too strict. */
    equals?: (previous: TValue, next: TValue) => boolean
}

export interface ConnectOptions<TOccurrence, TValue> {
    on: OccurrenceSource<TOccurrence>
    target?: WritableEmitter<TValue, unknown>
    value?: (occurrence: TOccurrence) => TValue
    when?: (occurrence: TOccurrence) => boolean
    action?: (occurrence: TOccurrence) => void | PromiseLike<unknown>
    onError?: (error: unknown, occurrence: TOccurrence) => void
}

export interface ConnectionError<TOccurrence> {
    readonly error: unknown
    readonly occurrence: TOccurrence
}

/** Idempotent cleanup plus a future-only error source for one connection. */
export type Connection<TOccurrence> = (() => void) & {
    readonly errors: OccurrenceSource<ConnectionError<TOccurrence>>
}

const activeConnections = new Set<object>()

/** Creates a future-only trigger from ordinary value snapshot notifications. */
export function valueChanges<TValue, TError = unknown>(
    source: ReadableEmitter<TValue, TError>,
    options: ValueChangesOptions<TValue> = {},
): OccurrenceSource<ValueChange<TValue, TError>> {
    if (!isReadableEmitter(source)) throw new TypeError('valueChanges source must be an emitter')
    if (options.equals != null && typeof options.equals !== 'function') {
        throw new TypeError('valueChanges equals must be a function')
    }
    return {
        subscribe(listener, subscribeOptions = {}) {
            let previous = source.get()
            return source.subscribe((notification) => {
                const changed = !(options.equals ?? Object.is)(previous, notification.value)
                previous = notification.value
                if (!changed) return
                const occurrence = Object.freeze({
                    value: notification.value,
                    fetchState: notification.fetchState,
                    error: notification.error,
                    event: notification.event,
                })
                try {
                    listener(occurrence)
                } catch (error: unknown) {
                    if (subscribeOptions.onError === undefined) throw error
                    subscribeOptions.onError(error, occurrence)
                }
            }, {emitCurrent: false})
        },
    }
}

/** Connect a future occurrence to one explicit state write or action. */
export function connect<TOccurrence, TValue = never>(
    options: ConnectOptions<TOccurrence, TValue>,
): Connection<TOccurrence> {
    if (options == null || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('connect options must be an object')
    }
    const {on, target, value, when, action, onError} = options
    if (on == null || typeof on.subscribe !== 'function') throw new TypeError('connect on must be an occurrence source')
    if ((target == null) === (action == null)) {
        throw new TypeError('connect requires exactly one target or action')
    }
    if (target != null && (typeof target.set !== 'function' || typeof value !== 'function')) {
        throw new TypeError('connect target requires a writable target and value function')
    }
    if (action != null && typeof action !== 'function') throw new TypeError('connect action must be a function')
    if (when != null && typeof when !== 'function') throw new TypeError('connect when must be a function')
    if (onError != null && typeof onError !== 'function') throw new TypeError('connect onError must be a function')

    const errors = new OccurrenceEmitter<ConnectionError<TOccurrence>>()
    const report = (error: unknown, occurrence: TOccurrence) => {
        try {
            onError?.(error, occurrence)
        } catch {
            // A reporting callback cannot re-enter the source operation.
        } finally {
            errors.emit(Object.freeze({error, occurrence}))
        }
    }
    const unsubscribe = on.subscribe((occurrence) => {
        try {
            if (when != null && !when(occurrence)) return
            if (activeConnections.has(options)) {
                throw new Error('connect detected a synchronous consequence cycle')
            }
            activeConnections.add(options)
            const outcome = target == null
                ? action!(occurrence)
                : target.set(value!(occurrence), occurrenceEvent(occurrence))
            if (isPromiseLike(outcome)) {
                void Promise.resolve(outcome).catch((error: unknown) => report(error, occurrence))
            }
        } catch (error: unknown) {
            report(error, occurrence)
        } finally {
            activeConnections.delete(options)
        }
    }, {onError: report})
    let active = true
    const cleanup = (() => {
        if (!active) return
        active = false
        unsubscribe()
        errors.dispose()
    }) as Connection<TOccurrence>
    Object.defineProperty(cleanup, 'errors', {value: errors, enumerable: true})
    return cleanup
}

type ArgumentSource<TValue> = TValue | ReadableEmitter<TValue, unknown>

export type BoundCommand<TArguments, TResult> = (
    eventOrCause?: EventBubble<unknown> | unknown,
) => Promise<TResult | undefined>

/** Samples emitter argument sources only when the returned action is invoked. */
export function bindCommand<TArguments, TResult, TError>(
    command: AsyncCommand<TArguments, TResult, TError>,
    arguments_: {[TName in keyof TArguments]: ArgumentSource<TArguments[TName]>} | (() => TArguments),
): BoundCommand<TArguments, TResult> {
    if (command == null || typeof command.run !== 'function') throw new TypeError('bindCommand command must be an AsyncCommand')
    if (typeof arguments_ !== 'function' && (arguments_ == null || typeof arguments_ !== 'object')) {
        throw new TypeError('bindCommand arguments must be a record or sampler')
    }
    return (eventOrCause = 'bound command run') => {
        const sampled = typeof arguments_ === 'function'
            ? arguments_()
            : Object.fromEntries(Object.entries(arguments_).map(([name, source]) =>
                [name, isReadableEmitter(source) ? source.get() : source],
            )) as TArguments
        return command.run(sampled, eventOrCause)
    }
}

export interface WritableProjectionOptions<TSource, TValue> extends EmitterOptions<TValue, unknown> {
    read(source: TSource): TValue
    write(source: TSource, value: TValue): TSource
    onError?: (error: unknown) => void
}

/** A writable view over one authoritative writable source. */
export class WritableProjection<TSource, TValue>
extends BaseEmitter<TValue, unknown> implements WritableEmitter<TValue, unknown> {
    private readonly source: WritableEmitter<TSource, unknown>
    private readonly readValue: (source: TSource) => TValue
    private readonly writeValue: (source: TSource, value: TValue) => TSource
    private readonly onError: (error: unknown) => void
    private unsubscribe: (() => void) | null

    constructor(
        source: WritableEmitter<TSource, unknown>,
        options: WritableProjectionOptions<TSource, TValue>,
    ) {
        if (!isWritableEmitter(source)) throw new TypeError('writableProjection source must be writable')
        if (options == null || typeof options.read !== 'function' || typeof options.write !== 'function') {
            throw new TypeError('writableProjection requires read and write functions')
        }
        super(options.read(source.get()), {
            ...options,
            fetchState: source.getFetchState(),
            error: source.getError(),
            owner: options.owner ?? source,
            purpose: options.purpose ?? 'writable projection',
        })
        this.source = source
        this.readValue = options.read
        this.writeValue = options.write
        this.onError = options.onError ?? (() => undefined)
        this.unsubscribe = source.subscribe((notification) => this.update(notification), {
            emitCurrent: false,
            diagnosticTarget: this,
        })
    }

    set(value: TValue, eventOrCause: EventBubble<unknown> | unknown = null): unknown {
        if (this.isDisposed) return false
        try {
            return this.source.set(this.writeValue(this.source.get(), value), eventOrCause)
        } catch (error: unknown) {
            this.reportError(error)
            return false
        }
    }

    override dispose(): void {
        if (this.isDisposed) return
        this.unsubscribe?.()
        this.unsubscribe = null
        super.dispose()
    }

    protected override diagnosticSources(): readonly object[] { return [this.source] }

    private update(notification: EmitterNotification<TSource, unknown>): void {
        try {
            this.setSnapshot({
                value: this.readValue(notification.value),
                fetchState: notification.fetchState,
                error: notification.error,
                cause: 'projection source changed',
                parentEvent: notification.event,
            })
        } catch (error: unknown) {
            this.reportError(error)
        }
    }

    private reportError(error: unknown): void {
        try {
            this.onError(error)
        } catch {
            // Projection error reporting cannot mutate its source or rethrow
            // through an unrelated source notification.
        }
    }
}

export function writableProjection<TSource, TValue>(
    source: WritableEmitter<TSource, unknown>,
    options: WritableProjectionOptions<TSource, TValue>,
): WritableProjection<TSource, TValue> {
    return new WritableProjection(source, options)
}

function occurrenceEvent(value: unknown): EventBubble<unknown> | null {
    if (value != null && typeof value === 'object' && 'event' in value) {
        const event = (value as {event?: unknown}).event
        return event instanceof EventBubble ? event : null
    }
    return null
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return value != null && typeof (value as {then?: unknown}).then === 'function'
}

function isReadableEmitter<TValue>(value: ArgumentSource<TValue>): value is ReadableEmitter<TValue, unknown> {
    return value != null && typeof value === 'object'
        && typeof (value as {get?: unknown}).get === 'function'
        && typeof (value as {subscribe?: unknown}).subscribe === 'function'
}

function isWritableEmitter<TValue>(value: unknown): value is WritableEmitter<TValue, unknown> {
    return isReadableEmitter(value as ArgumentSource<TValue>)
        && typeof (value as {set?: unknown}).set === 'function'
}
