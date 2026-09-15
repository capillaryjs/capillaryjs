import {Emitter} from '@capillaryjs/capillary'
import {devtoolsDiagnosticScope} from './scope.js'
import type {TraceEvent} from './types.js'

export interface TracePlaybackScheduler {
    schedule(callback: () => void, delayMs: number): unknown
    cancel(handle: unknown): void
}
export interface TracePlaybackState {readonly cursor: number | null; readonly playing: boolean}

/** Cursor-only playback. It never holds a reference to an application emitter or handler. */
export class TracePlayback {
    readonly state = new Emitter<TracePlaybackState>({cursor: null, playing: false}, {diagnosticScope: devtoolsDiagnosticScope})
    private timer: unknown = null
    private disposed = false
    constructor(private readonly scheduler: TracePlaybackScheduler = {
        schedule: (callback, delay) => setTimeout(callback, delay),
        cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    }) {}
    seek(cursor: number | null, count: number): void {
        this.pause()
        if (this.disposed) return
        this.state.set({cursor: cursor === null ? null : Math.max(0, Math.min(count - 1, Math.trunc(cursor))), playing: false})
    }
    step(delta: number, events: readonly TraceEvent[]): void {
        this.seek((this.state.get().cursor ?? events.length - 1) + delta, events.length)
    }
    play(events: readonly TraceEvent[], options: {mode?: 'events' | 'elapsed'; stepMs?: number; maxIdleMs?: number} = {}): void {
        this.pause()
        if (!events.length || this.disposed) return
        const stepMs = options.stepMs ?? 500
        const maxIdleMs = options.maxIdleMs ?? 1000
        if (!Number.isFinite(stepMs) || stepMs < 1 || !Number.isFinite(maxIdleMs) || maxIdleMs < 1) {
            throw new TypeError('Playback delays must be finite positive numbers')
        }
        let cursor = this.state.get().cursor ?? 0
        if (cursor >= events.length - 1) cursor = 0
        this.state.set({cursor, playing: true})
        const advance = () => {
            if (!this.state.get().playing) return
            if (cursor >= events.length - 1) { this.pause(); return }
            const delay = options.mode === 'elapsed'
                ? Math.min(maxIdleMs, Math.max(1, events[cursor + 1]!.timestamp - events[cursor]!.timestamp)) : stepMs
            this.timer = this.scheduler.schedule(() => {
                this.timer = null
                this.state.set({cursor: ++cursor, playing: true})
                advance()
            }, delay)
        }
        advance()
    }
    pause(): void {
        if (this.timer !== null) this.scheduler.cancel(this.timer)
        this.timer = null
        if (this.state.get().playing) this.state.set({...this.state.get(), playing: false})
    }
    dispose(): void { this.pause(); this.disposed = true; this.state.dispose() }
}
