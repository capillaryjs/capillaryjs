import type {EventBubble} from '../debugging/eventBubble.js'

/** A future-only, non-retained notification of something that happened. */
export interface OccurrenceSource<TOccurrence> {
    subscribe(
        listener: (occurrence: TOccurrence) => void,
        options?: OccurrenceSubscribeOptions<TOccurrence>,
    ): () => void
}

export interface OccurrenceSubscribeOptions<TOccurrence> {
    /** Receives listener failures without changing the originating operation. */
    onError?: (error: unknown, occurrence: TOccurrence) => void
}

/** Details of one accepted AsyncCommand completion. */
export interface CommandSuccess<TArguments, TResult> {
    readonly id: number
    readonly arguments: TArguments
    readonly result: TResult
    readonly event: EventBubble<unknown> | null
}

interface Subscriber<TOccurrence> {
    listener: (occurrence: TOccurrence) => void
    onError?: (error: unknown, occurrence: TOccurrence) => void
}

/** Internal reusable implementation for small, future-only framework signals. */
export class OccurrenceEmitter<TOccurrence> implements OccurrenceSource<TOccurrence> {
    private readonly subscribers = new Set<Subscriber<TOccurrence>>()
    private disposed = false
    private readonly reportError: (error: unknown, occurrence: TOccurrence) => void

    constructor(reportError: (error: unknown, occurrence: TOccurrence) => void = () => undefined) {
        this.reportError = reportError
    }

    subscribe(
        listener: (occurrence: TOccurrence) => void,
        options: OccurrenceSubscribeOptions<TOccurrence> = {},
    ): () => void {
        if (typeof listener !== 'function') throw new TypeError('Occurrence listener must be a function')
        if (this.disposed) return () => undefined
        const subscriber: Subscriber<TOccurrence> = options.onError === undefined
            ? {listener}
            : {listener, onError: options.onError}
        this.subscribers.add(subscriber)
        return () => this.subscribers.delete(subscriber)
    }

    emit(occurrence: TOccurrence): void {
        if (this.disposed) return
        for (const subscriber of [...this.subscribers]) {
            try {
                subscriber.listener(occurrence)
            } catch (error: unknown) {
                try {
                    subscriber.onError?.(error, occurrence)
                } catch (reportError: unknown) {
                    this.reportError(reportError, occurrence)
                }
                this.reportError(error, occurrence)
            }
        }
    }

    dispose(): void {
        this.disposed = true
        this.subscribers.clear()
    }
}
