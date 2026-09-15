import {AsyncCommand, DerivedEmitter, Diagnostics, Emitter, LiveQuery} from '@capillaryjs/capillary'
import type {RetryScheduler} from '@capillaryjs/capillary'
import {createQueryTableDataSource} from '@capillaryjs/capillary-ui'

export interface ResultRow extends Record<string, unknown> {id: number; title: string}

/** App-owned deterministic clock and microtask scheduler; no network or timing races. */
export class ScenarioClock implements RetryScheduler {
    time = 0
    now = () => this.time++
    schedule(callback: () => void, delayMs: number): unknown {
        const handle = {cancelled: false}
        queueMicrotask(() => { if (!handle.cancelled) { this.time += delayMs; callback() } })
        return handle
    }
    cancel(handle: unknown): void { (handle as {cancelled: boolean}).cancelled = true }
}

export class FlowScenario {
    readonly search = new Emitter('', {purpose: 'searchText'})
    readonly normalized = this.search.map((value) => value.trim().toLowerCase(), {purpose: 'normalizedSearch'})
    readonly length = this.normalized.map((value) => value.length, {purpose: 'searchLength'})
    readonly vowels = this.normalized.map((value) => (value.match(/[aeiou]/g) ?? []).length, {purpose: 'vowelCount'})
    readonly score = new DerivedEmitter([this.length, this.vowels] as const, ([length, vowels]) => length + vowels,
        {purpose: 'combinedScore (unsubscribed)'})
    readonly unchanged = this.search.map(() => 'constant', {purpose: 'unchanged leaf'})
    readonly saved = new Emitter('', {purpose: 'savedSearch (unsubscribed)'})
    readonly query: LiveQuery<readonly ResultRow[], {search: FlowScenario['normalized']}>
    readonly table
    readonly count
    readonly summary
    readonly command: AsyncCommand<string, string>
    readonly commandText
    requests = 0
    writes = 0
    executions = 0
    private serial = 0
    private failures = 0
    private hold = false
    private pending: Array<() => void> = []
    private pendingCommand: (() => void) | null = null
    private readonly unsubscribers: Array<() => void>

    constructor(readonly clock = new ScenarioClock()) {
        this.query = new LiveQuery({args: {search: this.normalized}, autoFetch: false, purpose: 'searchResults',
            retry: {maxAttempts: 2, delayMs: 40, jitter: false, scheduler: clock},
            handler: {fetch: ({search}) => {
                this.requests += 1
                clock.time += 12
                if (this.failures-- > 0) throw new Error('Deterministic request failure')
                const rows = [{id: 1, title: `${search} · first`}, {id: 2, title: `${search} · second`}]
                if (this.hold) return new Promise((resolve) => this.pending.push(() => resolve(rows)))
                return Promise.resolve(rows)
            }}})
        this.count = this.query.map((rows) => rows?.length ?? 0, {purpose: 'resultCount'})
        this.summary = this.count.map((value) => `${value} results`, {purpose: 'resultSummary'})
        this.table = createQueryTableDataSource({query: this.query})
        this.command = new AsyncCommand({purpose: 'saveCommand', concurrency: 'replace', execute: (value) => {
            this.executions += 1
            return new Promise((resolve) => { this.pendingCommand = () => resolve(`Saved ${value}`) })
        }})
        this.commandText = this.command.map((value) => value ?? 'Nothing saved', {purpose: 'saveStatus'})
        this.unsubscribers = [
            this.search.subscribe(() => { this.writes += 1 }, {emitCurrent: false, diagnosticLabel: 'source write counter'}),
            this.normalized.subscribe(({value}) => this.saved.set(value), {emitCurrent: false, diagnosticLabel: 'persist search callback'}),
        ]
    }

    direct(): void { this.search.set(`Search ${++this.serial}`) }
    retry(): void { this.hold = false; this.failures = 1; this.search.set(`retry ${++this.serial}`) }
    startPending(): void { this.hold = true; this.search.set(`pending ${++this.serial}`) }
    supersede(): void {
        this.hold = false; this.search.set(`newer ${++this.serial}`)
        for (const resolve of this.pending.splice(0)) resolve()
    }
    abort(): void {
        this.query.abort()
        for (const resolve of this.pending.splice(0)) resolve()
    }
    runCommand(): void { void this.command.run(this.normalized.get()) }
    completeCommand(): void { this.pendingCommand?.(); this.pendingCommand = null }
    unchangedWrite(): void { this.search.set(`${this.search.get()} `) }
    diagnosticEntryPoints(): readonly object[] { return [this.search, this.query, this.command] }
    metrics() { return {requests: this.requests, writes: this.writes, executions: this.executions, value: this.search.get()} }
    dispose(): void {
        for (const unsubscribe of this.unsubscribers) unsubscribe()
        this.table.dispose(); this.commandText.dispose(); this.command.dispose()
        this.summary.dispose(); this.count.dispose(); this.query.dispose()
        this.score.dispose(); this.vowels.dispose(); this.length.dispose(); this.unchanged.dispose()
        this.normalized.dispose(); this.search.dispose(); this.saved.dispose()
        for (const resolve of this.pending.splice(0)) resolve()
        this.pendingCommand?.()
    }
}
