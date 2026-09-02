import {EventBubble} from '../debugging/eventBubble.js'
import {EventBus} from '../debugging/eventBus.js'
import {combineFetchStates, FetchState} from '../enums/fetchState.js'
import type {FetchStateValue} from '../enums/fetchState.js'

export interface EmitterNotification<TValue, TError = unknown> {
    readonly value: TValue
    readonly fetchState: FetchStateValue
    readonly error: TError | null
    readonly event: EventBubble<unknown> | null
}

export interface EmitterOptions<TValue, TError = unknown> {
    fetchState?: FetchStateValue
    error?: TError | null
    owner?: unknown
    purpose?: string
    equals?: (left: TValue, right: TValue) => boolean
    trace?: boolean
}

export interface SubscribeOptions {
    emitCurrent?: boolean
    parentEvent?: EventBubble<unknown> | null
}

export interface SnapshotUpdate<TValue, TError> {
    value?: TValue
    fetchState?: FetchStateValue
    error?: TError | null
    cause?: unknown
    parentEvent?: EventBubble<unknown> | null
}

export interface ReadableEmitter<TValue, TError = unknown> {
    get(): TValue
    getError(): TError | null
    getFetchState(): FetchStateValue
    subscribe(
        listener: (notification: EmitterNotification<TValue, TError>) => void,
        options?: SubscribeOptions,
    ): () => void
}

export interface DerivedErrorEntry {
    readonly sourceIndex: number | null
    readonly error: unknown
}

export type DerivedErrors = ReadonlyArray<Readonly<DerivedErrorEntry>>

export type EmitterValue<TEmitter> = TEmitter extends ReadableEmitter<infer TValue, unknown>
    ? TValue
    : never

export type EmitterValues<TSources extends readonly ReadableEmitter<unknown, unknown>[]> = {
    -readonly [TIndex in keyof TSources]: EmitterValue<TSources[TIndex]>
}

type ArrayItem<TValue> = NonNullable<TValue> extends ReadonlyArray<infer TItem>
    ? NonNullable<TItem>
    : never

type MapEachResult<TValue, TMapped> = TValue extends null | undefined
    ? TValue
    : TValue extends ReadonlyArray<infer TItem>
        ? Array<TItem extends null | undefined ? TItem : TMapped>
        : never

export type MapOptions<TValue> = Pick<
    EmitterOptions<TValue, DerivedErrors>,
    'owner' | 'purpose' | 'equals' | 'trace'
>

/** Shared read, subscription, mapping, tracing, and disposal behavior. */
export class BaseEmitter<TValue, TError = unknown>
implements ReadableEmitter<TValue, TError> {
    protected readonly subscribers = new Set<
        (notification: EmitterNotification<TValue, TError>) => void
    >()
    protected value: TValue
    protected fetchState: FetchStateValue
    protected error: TError | null
    protected readonly equals: (left: TValue, right: TValue) => boolean
    protected isDisposed = false
    readonly owner: unknown
    readonly purpose: string
    readonly trace: boolean

    constructor(initialValue: TValue, options: EmitterOptions<TValue, TError> = {}) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('Emitter options must be an object')
        }

        this.value = initialValue
        this.fetchState = options.fetchState ?? FetchState.Ready
        this.error = options.error ?? null
        this.equals = options.equals ?? Object.is
        this.owner = options.owner
        this.purpose = options.purpose ?? this.constructor.name
        this.trace = options.trace ?? false

        if (typeof this.equals !== 'function') {
            throw new TypeError('Emitter equals option must be a function')
        }
        assertFetchState(this.fetchState)
    }

    subscribe(
        listener: (notification: EmitterNotification<TValue, TError>) => void,
        options: SubscribeOptions = {},
    ): () => void {
        if (this.isDisposed) throw new Error('Cannot subscribe to a disposed emitter')
        if (typeof listener !== 'function') {
            throw new TypeError('subscribe requires a function')
        }
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('subscribe options must be an object')
        }

        const {emitCurrent = true, parentEvent = null} = options
        this.subscribers.add(listener)
        if (emitCurrent) {
            const event = this.createEvent('subscribed', parentEvent, this.value)
            listener(this.notification(event))
        }

        let active = true
        return () => {
            if (!active) return
            active = false
            this.subscribers.delete(listener)
        }
    }

    subscribeFutureValues(
        listener: (notification: EmitterNotification<TValue, TError>) => void,
    ): () => void {
        return this.subscribe(listener, {emitCurrent: false})
    }

    get(): TValue {
        return this.value
    }

    getError(): TError | null {
        return this.error
    }

    getFetchState(): FetchStateValue {
        return this.fetchState
    }

    get disposed(): boolean {
        return this.isDisposed
    }

    get subscriberCount(): number {
        return this.subscribers.size
    }

    map<TMapped>(
        mapFn: (value: TValue) => TMapped,
        options: MapOptions<TMapped> = {},
    ): DerivedEmitter<TMapped, readonly [BaseEmitter<TValue, TError>]> {
        if (typeof mapFn !== 'function') throw new TypeError('map requires a function')
        return new DerivedEmitter<TMapped, readonly [BaseEmitter<TValue, TError>]>(
            [this] as readonly [BaseEmitter<TValue, TError>],
            ([value]) => mapFn(value),
            {
                ...options,
                owner: options.owner ?? this.owner,
                purpose: options.purpose ?? `${this.purpose}:map`,
                trace: options.trace ?? this.trace,
            },
        )
    }

    mapEach<TMapped>(
        this: TValue extends ReadonlyArray<unknown> | null | undefined
            ? BaseEmitter<TValue, TError>
            : never,
        mapFn: (value: ArrayItem<TValue>, index: number) => TMapped,
        options: MapOptions<MapEachResult<TValue, TMapped>> = {},
    ): DerivedEmitter<MapEachResult<TValue, TMapped>, readonly [BaseEmitter<TValue, TError>]> {
        if (typeof mapFn !== 'function') throw new TypeError('mapEach requires a function')
        return new DerivedEmitter<
            MapEachResult<TValue, TMapped>,
            readonly [BaseEmitter<TValue, TError>]
        >([this] as readonly [BaseEmitter<TValue, TError>], ([current]) => {
            if (current == null) return current as MapEachResult<TValue, TMapped>
            if (!Array.isArray(current)) {
                throw new TypeError('mapEach source value must be an array')
            }
            const items = current as ReadonlyArray<ArrayItem<TValue> | null | undefined>
            return items.map((item, index) => item == null ? item : mapFn(item, index)) as
                MapEachResult<TValue, TMapped>
        }, {
            ...options,
            purpose: options.purpose ?? `${this.purpose}:mapEach`,
        })
    }

    dispose(): void {
        if (this.isDisposed) return
        this.isDisposed = true
        this.subscribers.clear()
    }

    protected notification(
        event: EventBubble<unknown> | null = null,
    ): Readonly<EmitterNotification<TValue, TError>> {
        return Object.freeze({
            value: this.value,
            fetchState: this.fetchState,
            error: this.error,
            event,
        })
    }

    protected notify(event: EventBubble<unknown> | null = null): void {
        if (this.isDisposed) return
        const notification = this.notification(event)
        for (const listener of [...this.subscribers]) listener(notification)
    }

    protected setSnapshot(next: SnapshotUpdate<TValue, TError> = {}): boolean {
        if (this.isDisposed) return false
        const value = Object.hasOwn(next, 'value') ? next.value as TValue : this.value
        const fetchState = next.fetchState ?? this.fetchState
        const error = Object.hasOwn(next, 'error') ? next.error as TError | null : this.error
        const cause = next.cause ?? 'state changed'
        const parentEvent = next.parentEvent ?? null
        assertFetchState(fetchState)

        const changed = !this.equals(this.value, value)
            || this.fetchState !== fetchState
            || !Object.is(this.error, error)
        if (!changed) return false

        this.value = value
        this.fetchState = fetchState
        this.error = error
        const event = this.createEvent(cause, parentEvent, value)
        this.notify(event)
        return true
    }

    protected createEvent<TEventValue = TValue>(
        cause: unknown,
        parentEvent: EventBubble<unknown> | null = null,
        value: TEventValue = this.value as unknown as TEventValue,
    ): EventBubble<TEventValue> | null {
        if (!this.trace && !parentEvent && !EventBus.hasSubscribers) return null

        const event = new EventBubble({
            owner: this.owner ?? this,
            purpose: this.purpose,
            value,
            cause,
            parent: parentEvent,
        })
        if (!parentEvent) EventBus.emit(event)
        return event
    }
}

export type DerivedEmitterOptions<TValue> = MapOptions<TValue> & {
    computeFetchState?: (states: FetchStateValue[]) => FetchStateValue
}

/** Reactive state computed from zero or more source emitters. */
export class DerivedEmitter<
    TValue,
    TSources extends readonly ReadableEmitter<unknown, unknown>[] = readonly ReadableEmitter<unknown, unknown>[],
> extends BaseEmitter<TValue, DerivedErrors> {
    private sources: TSources
    private sourceUnsubscribers: Array<() => void> = []
    private compute: (values: EmitterValues<TSources>) => TValue
    private readonly computeFetchState: (states: FetchStateValue[]) => FetchStateValue

    constructor(
        sources: TSources,
        compute: (values: EmitterValues<TSources>) => TValue,
        options: DerivedEmitterOptions<TValue> = {},
    ) {
        const {computeFetchState = combineFetchStates, ...emitterOptions} = options
        // The first synchronous recomputation below establishes the real value.
        super(undefined as TValue, {
            ...emitterOptions,
            fetchState: FetchState.Initial,
            error: null,
        })
        this.sources = [] as unknown as TSources
        this.compute = compute
        this.computeFetchState = computeFetchState
        this.setSourcesAndCompute(sources, compute, {notify: false})
    }

    setSourcesAndCompute(
        sources: TSources,
        compute: (values: EmitterValues<TSources>) => TValue = this.compute,
        options: {notify?: boolean; parentEvent?: EventBubble<unknown> | null} = {},
    ): this {
        if (this.isDisposed) throw new Error('Cannot update a disposed derived emitter')
        if (!Array.isArray(sources) || sources.some((source) => !isEmitterLike(source))) {
            throw new TypeError('DerivedEmitter sources must be an array of emitters')
        }
        if (typeof compute !== 'function') {
            throw new TypeError('DerivedEmitter compute must be a function')
        }

        this.releaseSources()
        this.sources = [...sources] as unknown as TSources
        this.compute = compute
        this.sourceUnsubscribers = this.sources.map((source) =>
            source.subscribe(({event}) => this.recompute(event), {emitCurrent: false}),
        )
        this.recompute(options.parentEvent ?? null, options.notify ?? true)
        return this
    }

    override dispose(): void {
        if (this.isDisposed) return
        this.releaseSources()
        super.dispose()
    }

    private releaseSources(): void {
        for (const unsubscribe of this.sourceUnsubscribers) unsubscribe()
        this.sourceUnsubscribers = []
    }

    private recompute(parentEvent: EventBubble<unknown> | null = null, notify = true): void {
        // Array.map cannot retain tuple positions, so the runtime-validated source
        // array is narrowed back to its declared tuple at this single boundary.
        const values = this.sources.map((source) => source.get()) as EmitterValues<TSources>
        const states = this.sources.map((source) => source.getFetchState())
        const sourceErrors: DerivedErrorEntry[] = this.sources
            .map((source, sourceIndex) => ({sourceIndex, error: source.getError()}))
            .filter((entry) => entry.error != null)

        let value: TValue
        let computeError: unknown = null
        try {
            value = this.compute(values)
        } catch (error) {
            computeError = error
            value = undefined as TValue
        }

        const nextErrors: DerivedErrorEntry[] = computeError == null
            ? sourceErrors
            : [...sourceErrors, {sourceIndex: null, error: computeError}]
        const error = stabilizeErrors(this.error, nextErrors)
        let fetchState = this.computeFetchState(states)
        assertFetchState(fetchState)
        if (computeError != null || sourceErrors.length > 0) fetchState = FetchState.Error

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
            cause: 'derived source changed',
            parentEvent,
        })
    }
}

function stabilizeErrors(
    previous: DerivedErrors | null,
    next: DerivedErrorEntry[],
): DerivedErrors | null {
    if (next.length === 0) return null
    if (previous != null
        && previous.length === next.length
        && previous.every((entry, index) =>
            entry.sourceIndex === next[index]?.sourceIndex
            && Object.is(entry.error, next[index]?.error))) {
        return previous
    }
    return Object.freeze(next.map((entry) => Object.freeze(entry)))
}

function isEmitterLike(source: unknown): source is ReadableEmitter<unknown, unknown> {
    if ((typeof source !== 'object' || source === null) && typeof source !== 'function') {
        return false
    }
    return typeof Reflect.get(source, 'get') === 'function'
        && typeof Reflect.get(source, 'getFetchState') === 'function'
        && typeof Reflect.get(source, 'getError') === 'function'
        && typeof Reflect.get(source, 'subscribe') === 'function'
}

function assertFetchState(fetchState: FetchStateValue): void {
    combineFetchStates([fetchState])
}
