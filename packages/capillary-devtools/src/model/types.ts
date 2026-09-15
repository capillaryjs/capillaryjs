import type {DiagnosticEventKind, DiagnosticNode, DiagnosticOutcome} from '@capillaryjs/capillary'

export interface ValuePreview {
    readonly text: string
    readonly type: string
    readonly truncated: boolean
    readonly historical: boolean
    readonly captureError?: string
    /** Only present for explicitly selected raw capture; never exported to JSON. */
    readonly raw?: unknown
}

export interface TraceEvent {
    readonly id: string
    readonly sequence: number
    readonly timestamp: number
    readonly parentId: string | null
    readonly nodeId: string
    readonly kind: DiagnosticEventKind
    readonly outcome: DiagnosticOutcome | null
    readonly cause: string
    readonly value: ValuePreview
    readonly before: ValuePreview | null
    readonly error: ValuePreview | null
    readonly fetchState: string | null
    readonly attemptId: string | null
    readonly delayMs: number | null
    readonly inputs: readonly {readonly nodeId: string; readonly value: ValuePreview}[]
}

export interface TraceNode extends DiagnosticNode {
    readonly firstSequence: number
    readonly disposedSequence: number | null
}

export interface TraceEdge {
    readonly from: string
    readonly to: string
    readonly fromSequence: number
    readonly toSequence: number | null
}

export interface TraceRecording {
    readonly schemaVersion: 1
    readonly events: readonly TraceEvent[]
    readonly nodes: readonly TraceNode[]
    readonly edges: readonly TraceEdge[]
    readonly capture: {
        readonly active: boolean
        readonly startedAt: number | null
        readonly stoppedAt: number | null
        readonly lateStart: boolean
        readonly gaps: number
        readonly evictedEvents: number
        readonly droppedTopology: number
        readonly bytes: number
        readonly maxBytes: number
        readonly maxEvents: number
        readonly rawReferences: boolean
        readonly topology: boolean
        readonly ui: boolean
        readonly verbose: boolean
    }
}

export interface TraceFilter {
    readonly rootId?: string | null
    readonly sourceId?: string | null
    readonly targetId?: string | null
}

export interface TraceAttempt {
    readonly id: string
    readonly nodeId: string
    readonly start: TraceEvent | null
    readonly end: TraceEvent | null
    readonly status: string
    readonly durationMs: number | null
}
