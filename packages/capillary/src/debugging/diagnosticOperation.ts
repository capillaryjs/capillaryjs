import {Diagnostics} from './diagnostics.js'
import type {DiagnosticOutcome} from './diagnostics.js'
import type {EventBubble} from './eventBubble.js'

/** @internal Request-local causal state; never a retained operation registry. */
export class DiagnosticOperation {
    private attemptNumber = 0
    private attempt: EventBubble<unknown> | null = null
    private closed = false
    private lastEvent: EventBubble<unknown> | null

    constructor(private readonly subject: object, private readonly root: EventBubble<unknown> | null) {
        this.lastEvent = root
    }

    get event(): EventBubble<unknown> | null { return this.attempt ?? this.lastEvent ?? this.root }

    invoke<T>(value: unknown, action: (event: EventBubble<unknown> | null) => T): T {
        // Arguments are sampled at actual invocation, which can follow scheduling.
        const invocation = Diagnostics.event(this.subject, 'operation', {parent: this.event,
            cause: this.closed ? 'handler invoked after operation closed' : 'handler invoked', value})
        return Diagnostics.withEvent(invocation ?? this.event, () => action(invocation ?? this.event))
    }

    ignored(value?: unknown, error?: unknown): void {
        Diagnostics.event(this.subject, 'operation', {parent: this.event,
            cause: 'stale settlement ignored', value, error, outcome: 'superseded'})
    }

    begin(value: unknown): void {
        if (this.closed) return
        const attemptId = `${this.root?.id ?? 'operation'}:attempt-${++this.attemptNumber}`
        this.attempt = Diagnostics.event(this.subject, 'attempt', {
            parent: this.lastEvent ?? this.root, cause: 'attempt started', value, attemptId, outcome: 'started',
        })
    }

    settle(outcome: DiagnosticOutcome, value?: unknown, error?: unknown): EventBubble<unknown> | null {
        if (this.closed || !this.attempt) return this.event
        this.lastEvent = Diagnostics.event(this.subject, 'attempt', {parent: this.attempt,
            cause: `attempt ${outcome}`, outcome, value, error,
            ...(this.attempt.diagnostic?.attemptId ? {attemptId: this.attempt.diagnostic.attemptId} : {})})
        this.attempt = null
        return this.lastEvent
    }

    close(outcome: DiagnosticOutcome): void {
        if (this.closed) return
        this.settle(outcome)
        Diagnostics.event(this.subject, 'operation', {
            parent: this.lastEvent ?? this.root, cause: `operation ${outcome}`, outcome,
        })
        this.closed = true
    }
}
