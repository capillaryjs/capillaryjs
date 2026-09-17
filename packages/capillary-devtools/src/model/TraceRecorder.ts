import {Diagnostics, Emitter} from '@capillaryjs/capillary'
import type {DiagnosticFact, DiagnosticNode, DiagnosticObserverOptions} from '@capillaryjs/capillary'
import {devtoolsDiagnosticScope} from './scope.js'
import type {TraceEdge, TraceEvent, TraceNode, TraceRecording, ValuePreview} from './types.js'
import {captureValueSnapshot} from './valueSnapshot.js'

export type TraceCaptureMode = 'none' | 'scalar' | 'preview' | 'snapshot' | 'raw' | 'formatter'
export interface TraceCaptureContext {readonly nodeId: string; readonly field: string}
export interface TraceRecorderOptions extends DiagnosticObserverOptions {
    maxEvents?: number
    maxBytes?: number
    maxNodes?: number
    maxEdges?: number
    maxPreviewLength?: number
    maxSnapshotDepth?: number
    maxSnapshotEntries?: number
    capture?: TraceCaptureMode
    formatter?: (value: unknown, context: TraceCaptureContext) => string
    clock?: () => number
}

/** A bounded, caller-owned sink. Payload references never enter default recordings. */
export class TraceRecorder {
    readonly revision = new Emitter(0, {diagnosticScope: devtoolsDiagnosticScope})
    private readonly options: Required<Omit<TraceRecorderOptions, 'formatter'>> & Pick<TraceRecorderOptions, 'formatter'>
    private events: TraceEvent[] = []
    private nodes = new Map<string, TraceNode>()
    private edges: TraceEdge[] = []
    private sequence = 0
    private unsubscribe: (() => void) | null = null
    private startedAt: number | null = null
    private stoppedAt: number | null = null
    private lateStart = true
    private gaps = 0
    private evictedEvents = 0
    private droppedTopology = 0
    private bytes = 0
    private notifying = false
    private disposed = false
    private cached: TraceRecording | null = null
    private readonly recordBytes = new WeakMap<object, number>()

    constructor(options: TraceRecorderOptions = {}) {
        this.options = {maxEvents: 2000, maxBytes: 2_000_000, maxNodes: 2000, maxEdges: 8000,
            maxPreviewLength: 180, maxSnapshotDepth: 3, maxSnapshotEntries: 100, capture: 'scalar', clock: Date.now,
            topology: true, verbose: false, ui: true, ...options}
        for (const key of ['maxEvents', 'maxBytes', 'maxNodes', 'maxEdges', 'maxPreviewLength', 'maxSnapshotDepth', 'maxSnapshotEntries'] as const) {
            if (!Number.isSafeInteger(this.options[key]) || this.options[key] < 1) {
                throw new TypeError(`${key} must be a positive safe integer`)
            }
        }
        if (this.options.maxSnapshotDepth > 20) throw new TypeError('maxSnapshotDepth must not exceed 20')
        if (!['none', 'scalar', 'preview', 'snapshot', 'raw', 'formatter'].includes(this.options.capture)) {
            throw new TypeError('Unknown trace capture mode')
        }
        if (this.options.capture === 'formatter' && typeof options.formatter !== 'function') {
            throw new TypeError('Formatter capture requires a formatter')
        }
    }

    start(options: {roots?: readonly object[]; fromStart?: boolean} = {}): this {
        if (this.disposed) throw new Error('Cannot start a disposed recorder')
        if (this.unsubscribe) return this
        if (this.startedAt !== null) this.gaps += 1
        else { this.startedAt = this.options.clock(); this.lateStart = !options.fromStart }
        this.stoppedAt = null
        this.unsubscribe = Diagnostics.subscribe((fact) => this.accept(fact), this.options)
        for (const root of options.roots ?? []) Diagnostics.inspect(root)
        this.changed()
        return this
    }

    stop(): this {
        if (!this.unsubscribe) return this
        this.unsubscribe()
        this.unsubscribe = null
        this.stoppedAt = this.options.clock()
        this.changed()
        return this
    }

    reset(): this {
        const active = this.unsubscribe !== null
        this.stop()
        this.events = []; this.nodes.clear(); this.edges = []; this.sequence = 0
        this.startedAt = null; this.stoppedAt = null; this.lateStart = true
        this.gaps = 0; this.evictedEvents = 0; this.droppedTopology = 0; this.bytes = 0
        if (active) this.start()
        this.changed()
        return this
    }

    snapshot(): TraceRecording {
        this.cached ??= Object.freeze({schemaVersion: 1, events: Object.freeze([...this.events]),
            nodes: Object.freeze([...this.nodes.values()]), edges: Object.freeze([...this.edges]),
            capture: Object.freeze({active: this.unsubscribe !== null, startedAt: this.startedAt,
                stoppedAt: this.stoppedAt, lateStart: this.lateStart, gaps: this.gaps,
                evictedEvents: this.evictedEvents, droppedTopology: this.droppedTopology, bytes: this.bytes,
                maxBytes: this.options.maxBytes, maxEvents: this.options.maxEvents,
                rawReferences: this.options.capture === 'raw', topology: this.options.topology,
                ui: this.options.ui, verbose: this.options.verbose, mode: this.options.capture})})
        return this.cached
    }

    /** Safe JSON export strips raw references before serialization (including toJSON hooks). */
    export(): string { return JSON.stringify(exportable(this.snapshot()), null, 2) }

    dispose(): void { this.stop(); this.disposed = true; this.revision.dispose() }

    private accept(fact: DiagnosticFact): void {
        if (fact.type === 'node') this.addNode(fact.node)
        else if (fact.type === 'disposed') {
            const node = this.nodes.get(fact.nodeId)
            if (node) this.nodes.set(node.id, Object.freeze({...node, disposedSequence: this.sequence}))
            this.edges = this.edges.map((edge) => edge.toSequence === null
                && (edge.from === fact.nodeId || edge.to === fact.nodeId)
                ? Object.freeze({...edge, toSequence: this.sequence}) : edge)
        } else if (fact.type === 'edge') {
            const index = this.edges.findIndex((edge) => edge.from === fact.from && edge.to === fact.to && edge.toSequence === null)
            if (fact.connected && index < 0) this.edges.push(Object.freeze({from: fact.from, to: fact.to,
                fromSequence: this.sequence, toSequence: null}))
            else if (!fact.connected && index >= 0) this.edges[index] = Object.freeze({...this.edges[index]!, toSequence: this.sequence})
        } else {
            const event = fact.event
            if (event.diagnosticScope?.capture === false) return
            const details = event.diagnostic
            const owner = event.owner
            const identity = details?.node ?? Diagnostics.node(
                owner !== null && (typeof owner === 'object' || typeof owner === 'function') ? owner : event)
            if (!identity) return
            const node = details?.node ?? {...identity, label: event.purpose}
            this.addNode(node)
            const preview = (value: unknown, field: string) => this.preview(value, {nodeId: node.id, field})
            this.events.push(Object.freeze({id: event.id, sequence: this.sequence++, timestamp: this.options.clock(),
                parentId: event.parent?.id ?? null, nodeId: node.id, kind: details?.kind ?? 'operation',
                outcome: details?.outcome ?? null, cause: (typeof event.cause === 'string' ? event.cause : scalarText(event.cause)).slice(0, 512),
                value: preview(event.value, 'value'), before: details && Object.hasOwn(details, 'before')
                    ? preview(details.before, 'before') : null,
                error: details?.error == null ? null : preview(details.error, 'error'),
                fetchState: details?.fetchState ?? null, attemptId: details?.attemptId ?? null,
                delayMs: details?.delayMs ?? null,
                ...(details?.consumer ? {consumer: Object.freeze({...details.consumer})} : {}),
                inputs: Object.freeze((details?.inputs ?? []).map((input) => Object.freeze({nodeId: input.nodeId,
                    value: preview(input.value, 'input')})))}))
        }
        this.enforceBounds()
        this.changed()
    }

    private addNode(node: DiagnosticNode): void {
        if (this.nodes.has(node.id)) return
        this.nodes.set(node.id, Object.freeze({...node, label: node.label.slice(0, 240),
            firstSequence: this.sequence, disposedSequence: null}))
    }

    private preview(value: unknown, context: TraceCaptureContext): ValuePreview {
        const mode = this.options.capture
        const type = value === null ? 'null' : typeof value
        let text: string
        let captureError: string | undefined
        const snapshot = mode === 'snapshot' ? captureValueSnapshot(value, {
            depth: this.options.maxSnapshotDepth, entries: this.options.maxSnapshotEntries,
            text: this.options.maxPreviewLength,
        }) : undefined
        try {
            text = mode === 'none' ? 'not captured'
                : snapshot ? snapshot.text
                : mode === 'formatter' ? this.options.formatter!(value, context)
                : mode === 'preview' ? boundedPreview(value, this.options.maxPreviewLength)
                : scalarText(value)
            if (typeof text !== 'string') throw new TypeError('Formatter must return a string')
        } catch {
            text = '[capture failed]'; captureError = 'Preview capture failed'
        }
        const truncated = text.length > this.options.maxPreviewLength || snapshot?.truncated === true
        return Object.freeze({text: text.slice(0, this.options.maxPreviewLength), type, truncated,
            historical: mode !== 'raw', ...(captureError ? {captureError} : {}),
            ...(snapshot ? {snapshot} : {}),
            ...(mode === 'raw' ? {raw: value} : {})})
    }

    private enforceBounds(): void {
        while (this.events.length > this.options.maxEvents) { this.events.shift(); this.evictedEvents += 1 }
        while (this.nodes.size > this.options.maxNodes) this.evictNode()
        while (this.edges.length > this.options.maxEdges) { this.edges.shift(); this.droppedTopology += 1 }
        this.bytes = this.byteSize()
        while (this.bytes > this.options.maxBytes) {
            if (this.events.length) { this.events.shift(); this.evictedEvents += 1 }
            else if (this.edges.length) { this.edges.shift(); this.droppedTopology += 1 }
            else if (this.nodes.size) this.evictNode()
            else break
            this.bytes = this.byteSize()
        }
    }

    private evictNode(): void {
        const id = this.nodes.keys().next().value!
        this.nodes.delete(id)
        const removed = this.edges.filter((edge) => edge.from === id || edge.to === id).length
        this.edges = this.edges.filter((edge) => edge.from !== id && edge.to !== id)
        this.droppedTopology += 1 + removed
    }

    private byteSize(): number {
        // UTF-16 upper bound for JSON metadata; excludes deliberately retained raw object heaps.
        const size = (record: object, serialize: () => object) => {
            let bytes = this.recordBytes.get(record)
            if (bytes === undefined) {
                bytes = JSON.stringify(serialize()).length * 2
                this.recordBytes.set(record, bytes)
            }
            return bytes
        }
        return this.events.reduce((bytes, record) => bytes + size(record, () => exportEvent(record)), 0)
            + [...this.nodes.values(), ...this.edges].reduce((bytes, record) => bytes + size(record, () => record), 0)
    }

    private changed(): void {
        this.cached = null
        if (this.notifying || this.disposed) return
        this.notifying = true
        queueMicrotask(() => {
            this.notifying = false
            if (!this.disposed) this.revision.set(this.revision.get() + 1)
        })
    }
}

function scalarText(value: unknown): string {
    if (value === null) return 'null'
    if (typeof value === 'string') return JSON.stringify(value)
    if (typeof value === 'object') return '[object; contents not captured]'
    if (typeof value === 'function') return '[function]'
    return String(value)
}

function boundedPreview(value: unknown, budget: number): string {
    if (value === null || typeof value !== 'object') return scalarText(value)
    const parts: string[] = []
    // This explicitly selected mode reads only descriptors; never invoke a getter.
    for (const key of Reflect.ownKeys(value).slice(0, 8)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        parts.push(`${String(key)}: ${descriptor && 'value' in descriptor ? scalarText(descriptor.value).slice(0, budget) : '[accessor]'}`)
        if (parts.join(', ').length >= budget) break
    }
    return `{${parts.join(', ')}}`
}

function exportPreview(value: ValuePreview | null): Omit<ValuePreview, 'raw'> | null {
    if (!value) return null
    const {raw: _raw, ...safe} = value
    return safe
}
function exportEvent(event: TraceEvent): object {
    return {...event, value: exportPreview(event.value), before: exportPreview(event.before),
        error: exportPreview(event.error), inputs: event.inputs.map((input) => ({...input, value: exportPreview(input.value)}))}
}
function exportable(recording: TraceRecording): object {
    return {...recording, events: recording.events.map(exportEvent)}
}
