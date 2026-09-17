import {EventBubble} from './eventBubble.js'
import type {EventOptions} from './eventBubble.js'
import {EventBus} from './eventBus.js'

let nextScope = 1
let nextNode = 1
let epoch = 0

/** Non-semantic ownership tag. Exclusion is stronger than the legacy trace hint. */
export class DiagnosticScope {
    readonly id = `scope-${nextScope++}`
    constructor(readonly label: string, readonly capture: boolean = true) { Object.freeze(this) }
}

export const defaultDiagnosticScope = new DiagnosticScope('application')
export const diagnosticInfo: unique symbol = Symbol('capillary.diagnosticInfo')

export type DiagnosticNodeKind = 'emitter' | 'derived' | 'query' | 'command'
    | 'subscriber' | 'component' | 'binding' | 'interaction' | 'external'
export type DiagnosticEventKind = 'value' | 'state' | 'derived' | 'subscribed'
    | 'recomputed-unchanged' | 'interaction' | 'consumer' | 'operation'
    | 'attempt' | 'retry' | 'disposed'
export type DiagnosticOutcome = 'changed' | 'unchanged' | 'started' | 'succeeded'
    | 'failed' | 'aborted' | 'superseded' | 'scheduled' | 'disposed'

export interface DiagnosticNode {
    readonly id: string
    readonly label: string
    readonly kind: DiagnosticNodeKind
    readonly scopeId: string
}

export interface DiagnosticDescription {
    label: string
    kind: DiagnosticNodeKind
    scope?: DiagnosticScope | undefined
    sources?: readonly object[]
    targets?: readonly object[]
}

export interface DiagnosticSubject {
    [diagnosticInfo](): DiagnosticDescription
}

export interface DiagnosticEventDetails {
    readonly node: DiagnosticNode
    readonly kind: DiagnosticEventKind
    readonly outcome?: DiagnosticOutcome
    readonly before?: unknown
    readonly fetchState?: string
    readonly error?: unknown
    readonly attemptId?: string
    readonly inputs?: readonly {readonly nodeId: string; readonly value: unknown}[]
    readonly delayMs?: number
    /** Renderer facts, not browser layout/paint measurements. */
    readonly consumer?: DiagnosticConsumerDetails
}

export interface DiagnosticConsumerDetails {
    readonly trigger: 'dependency' | 'parent' | 'explicit'
    /** Completed/attempted render() calls, including synchronous reentrant passes. */
    readonly renderPasses?: number
    /** Own renderer DOM writes; excludes nested consumers and application DOM code. */
    readonly domWrites?: number
}

export type DiagnosticFact =
    | {readonly type: 'event'; readonly event: EventBubble<unknown>}
    | {readonly type: 'node'; readonly node: DiagnosticNode}
    | {readonly type: 'edge'; readonly from: string; readonly to: string; readonly connected: boolean}
    | {readonly type: 'disposed'; readonly nodeId: string}

export interface DiagnosticObserverOptions {
    topology?: boolean
    verbose?: boolean
    ui?: boolean
}

const observers = new Map<(fact: DiagnosticFact) => void, DiagnosticObserverOptions>()
const descriptions = new WeakMap<object, DiagnosticDescription>()
const identities = new WeakMap<object, {node: DiagnosticNode; epoch: number}>()
let currentEvent: EventBubble<unknown> | null = null
let creationScope: DiagnosticScope | null = null
let publishing = false

function description(subject: object): DiagnosticDescription {
    const known = descriptions.get(subject)
    if (known) return known
    if (diagnosticInfo in subject) return (subject as DiagnosticSubject)[diagnosticInfo]()
    return {label: typeof subject === 'function' ? subject.name || 'subscriber' : 'external', kind: 'external'}
}

function publish(fact: DiagnosticFact): void {
    // Observers are diagnostic sinks, never additional application work.
    if (publishing) return
    publishing = true
    try {
        for (const [listener, options] of [...observers]) {
            if (fact.type !== 'event' && options.topology === false) continue
            if (fact.type === 'event') {
                const kind = fact.event.diagnostic?.kind
                if (kind === 'recomputed-unchanged' && !options.verbose) continue
                if (options.ui === false && ['component', 'binding', 'interaction'].includes(fact.event.diagnostic?.node.kind ?? '')) continue
            }
            try { listener(fact) } catch { /* Observation cannot break propagation. */ }
        }
    } finally { publishing = false }
}

function node(subject: object): DiagnosticNode | null {
    const info = description(subject)
    const scope = info.scope ?? defaultDiagnosticScope
    if (!scope.capture) return null
    let identity = identities.get(subject)
    if (!identity) {
        identity = {node: Object.freeze({id: `node-${nextNode++}`, label: info.label,
            kind: info.kind, scopeId: scope.id}), epoch: -1}
        identities.set(subject, identity)
    }
    return identity.node
}

function inspect(subject: object, seen = new Set<object>(), force = false): DiagnosticNode | null {
    if (!observers.size) return null
    const identityNode = node(subject)
    if (!identityNode || seen.has(subject)) return identityNode
    seen.add(subject)
    const identity = identities.get(subject)!
    if (!force && identity.epoch === epoch) return identityNode
    identity.epoch = epoch
    publish({type: 'node', node: identityNode})
    if (![...observers.values()].some((options) => options.topology !== false)) return identityNode
    const info = description(subject)
    for (const source of info.sources ?? []) {
        const sourceNode = inspect(source, seen)
        if (sourceNode) publish({type: 'edge', from: sourceNode.id, to: identityNode.id, connected: true})
    }
    for (const target of info.targets ?? []) {
        const targetNode = inspect(target, seen)
        if (targetNode) publish({type: 'edge', from: identityNode.id, to: targetNode.id, connected: true})
    }
    return identityNode
}

function withEvent<T>(event: EventBubble<unknown> | null, action: () => T): T {
    const previous = currentEvent
    currentEvent = event
    try { return action() } finally { currentEvent = previous }
}

function event(
    subject: object,
    kind: DiagnosticEventKind,
    options: Omit<EventOptions, 'diagnostic'> & Omit<Partial<DiagnosticEventDetails>, 'node' | 'kind'> = {},
): EventBubble<unknown> | null {
    if (!observers.size || publishing) return null
    const subjectNode = inspect(subject)
    if (!subjectNode) return null
    const {before, fetchState, error, attemptId, inputs, delayMs, outcome, consumer, ...eventOptions} = options
    const bubble = new EventBubble({...eventOptions, owner: subject,
        purpose: subjectNode.label, parent: options.parent ?? currentEvent,
        diagnostic: {node: subjectNode, kind,
            ...(outcome === undefined ? {} : {outcome}),
            ...(Object.hasOwn(options, 'before') ? {before} : {}),
            ...(fetchState === undefined ? {} : {fetchState}),
            ...(error === undefined ? {} : {error}),
            ...(attemptId === undefined ? {} : {attemptId}),
            ...(inputs === undefined ? {} : {inputs}),
            ...(delayMs === undefined ? {} : {delayMs}),
            ...(consumer === undefined ? {} : {consumer: Object.freeze({...consumer})})}})
    if (!bubble.parent) EventBus.emit(bubble)
    return bubble
}

/** Version 1 facts. No retained event history and no dependency on a browser. */
export const Diagnostics = Object.freeze({
    protocolVersion: 1 as const,
    subscribe(listener: (fact: DiagnosticFact) => void, options: DiagnosticObserverOptions = {}): () => void {
        if (typeof listener !== 'function') throw new TypeError('Diagnostics.subscribe requires a function')
        observers.set(listener, {...options})
        epoch += 1
        return () => { observers.delete(listener) }
    },
    get active(): boolean { return observers.size > 0 && !publishing },
    get verbose(): boolean { return [...observers.values()].some((options) => options.verbose) },
    get currentEvent(): EventBubble<unknown> | null { return currentEvent },
    get creationScope(): DiagnosticScope | null { return creationScope },
    /** Stamp newly constructed owned values; the scope is not carried across an await. */
    withScope<T>(scope: DiagnosticScope, create: () => T): T {
        const previous = creationScope
        creationScope = scope
        try { return create() } finally { creationScope = previous }
    },
    configure(subject: object, info: DiagnosticDescription): void { descriptions.set(subject, info) },
    node,
    inspect(subject: object): DiagnosticNode | null { return inspect(subject, new Set(), true) },
    discover: inspect,
    disconnect(from: object, to: object): void {
        if (!observers.size) return
        const source = inspect(from)
        const target = inspect(to)
        if (source && target) publish({type: 'edge', from: source.id, to: target.id, connected: false})
    },
    dispose(subject: object): void {
        if (!observers.size) return
        const subjectNode = inspect(subject)
        if (subjectNode) publish({type: 'disposed', nodeId: subjectNode.id})
    },
    /** @internal EventBubble invokes this once, after its fields are initialized. */
    observe(event: EventBubble<unknown>): void {
        if (!observers.size || publishing || event.diagnosticScope?.capture === false) return
        publish({type: 'event', event})
    },
    event,
    withEvent,
    /** Scope/identity comes from the source, synchronous causality from the call. */
    interaction<T>(subject: object, cause: string, action: (event: EventBubble<unknown> | null) => T): T {
        const origin = event(subject, 'interaction', {cause, outcome: 'started'})
        return withEvent(origin, () => action(origin))
    },
})
