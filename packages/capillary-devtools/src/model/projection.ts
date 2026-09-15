import type {TraceAttempt, TraceEvent, TraceFilter, TraceNode, TraceRecording} from './types.js'

export function traceRoots(recording: TraceRecording): readonly TraceEvent[] {
    const ids = new Set(recording.events.map((event) => event.id))
    return recording.events.filter((event) => event.parentId === null || !ids.has(event.parentId))
}

/** Intersect occurrence ancestry/descendancy; every converging occurrence is retained. */
export function filterTrace(recording: TraceRecording, filter: TraceFilter = {}): readonly TraceEvent[] {
    const all = recording.events
    const byId = new Map(all.map((event) => [event.id, event]))
    const descendants = (seeds: Set<string>): Set<string> => {
        const included = new Set(seeds)
        for (const event of all) if (event.parentId && included.has(event.parentId)) included.add(event.id)
        return included
    }
    const root = filter.rootId ? descendants(new Set([filter.rootId])) : new Set(all.map((event) => event.id))
    const within = all.filter((event) => root.has(event.id))
    const downstream = filter.sourceId
        ? descendants(new Set(within.filter((event) => event.nodeId === filter.sourceId).map((event) => event.id))) : root
    const upstream = filter.targetId ? new Set<string>() : root
    if (filter.targetId) {
        for (const target of within.filter((event) => event.nodeId === filter.targetId)) {
            let event: TraceEvent | undefined = target
            while (event && !upstream.has(event.id)) {
                upstream.add(event.id)
                event = event.parentId ? byId.get(event.parentId) : undefined
            }
        }
    }
    return within.filter((event) => downstream.has(event.id) && upstream.has(event.id))
}

export interface CausalRow {readonly event: TraceEvent; readonly depth: number; readonly missingParent: boolean}

/** Last observed state, not a later lifecycle marker's absent payload. */
export function nodeValueEvent(events: readonly TraceEvent[]): TraceEvent | undefined {
    return events.findLast((event) => ['value', 'state', 'derived', 'recomputed-unchanged', 'subscribed'].includes(event.kind))
        ?? events.findLast((event) => event.value.type !== 'undefined') ?? events.at(-1)
}

export function causalOutline(events: readonly TraceEvent[]): readonly CausalRow[] {
    const children = new Map<string, TraceEvent[]>()
    const ids = new Set(events.map((event) => event.id))
    for (const event of events) {
        const key = event.parentId && ids.has(event.parentId) ? event.parentId : ''
        const list = children.get(key) ?? []
        list.push(event); children.set(key, list)
    }
    const result: CausalRow[] = []
    const stack = [...(children.get('') ?? [])].reverse().map((event) => ({event, depth: 0}))
    while (stack.length) {
        const current = stack.pop()!
        result.push({...current, missingParent: current.event.parentId !== null && !ids.has(current.event.parentId)})
        for (const child of [...(children.get(current.event.id) ?? [])].reverse()) {
            stack.push({event: child, depth: current.depth + 1})
        }
    }
    return result
}

export function traceAttempts(events: readonly TraceEvent[]): readonly TraceAttempt[] {
    const groups = new Map<string, TraceEvent[]>()
    for (const event of events) {
        if (!event.attemptId) continue
        const group = groups.get(event.attemptId) ?? []
        group.push(event); groups.set(event.attemptId, group)
    }
    return [...groups].map(([id, group]) => {
        const start = group.find((event) => event.outcome === 'started') ?? null
        const end = group.findLast((event) => event.outcome !== 'started') ?? null
        return {id, nodeId: group[0]!.nodeId, start, end,
            status: end?.outcome ?? 'unfinished in capture',
            durationMs: start && end ? Math.max(0, end.timestamp - start.timestamp) : null}
    })
}

export interface FlowNode {
    readonly node: TraceNode
    readonly events: readonly TraceEvent[]
    readonly x: number
    readonly y: number
    readonly leaf: string | null
}
export interface FlowEdge {readonly from: string; readonly to: string; readonly observed: boolean}
export interface TraceFlow {readonly nodes: readonly FlowNode[]; readonly edges: readonly FlowEdge[]; readonly width: number; readonly height: number}

/** Stable geometry depends on the complete selected trace, never the replay cursor. */
export function projectFlow(recording: TraceRecording, events: readonly TraceEvent[], options: {includeConnected?: boolean} = {}): TraceFlow {
    const nodes = new Map(recording.nodes.map((node) => [node.id, node]))
    const included = new Set(events.map((event) => event.nodeId))
    const byEventId = new Map(recording.events.map((event) => [event.id, event]))
    const edges = new Map<string, FlowEdge>()
    for (const event of events) {
        const parent = event.parentId ? byEventId.get(event.parentId) : null
        if (parent && included.has(parent.nodeId) && parent.nodeId !== event.nodeId) {
            edges.set(`${parent.nodeId}:${event.nodeId}`, {from: parent.nodeId, to: event.nodeId, observed: true})
        }
    }
    const first = events[0]?.sequence ?? 0
    const last = events.at(-1)?.sequence ?? first
    const possible = recording.edges.filter((edge) => edge.fromSequence <= last
        && (edge.toSequence === null || edge.toSequence > first))
    // Downstream discovery includes subscribers and emitters that produced no event.
    const queue = options.includeConnected === false ? [] : [...included]
    while (queue.length) {
        const id = queue.shift()!
        for (const edge of possible.filter((candidate) => candidate.from === id)) {
            if (!included.has(edge.to)) { included.add(edge.to); queue.push(edge.to) }
            const key = `${edge.from}:${edge.to}`
            if (!edges.has(key)) edges.set(key, {...edge, observed: false})
        }
    }
    // Full-input provenance is context, not evidence of propagation.
    for (const event of events) for (const input of event.inputs) {
        included.add(input.nodeId)
        const key = `${input.nodeId}:${event.nodeId}`
        if (!edges.has(key) && input.nodeId !== event.nodeId) {
            edges.set(key, {from: input.nodeId, to: event.nodeId, observed: false})
        }
    }
    const ids = [...included]
    const links = [...edges.values()]
    // Strongly connected components keep feedback finite, then rank the condensed DAG.
    const components = stronglyConnected(ids, links)
    const groupOf = new Map(components.flatMap((group, index) => group.map((id) => [id, index] as const)))
    const rank = components.map(() => 0)
    for (let pass = 0; pass < components.length; pass++) {
        let changed = false
        for (const edge of links) {
            const from = groupOf.get(edge.from)!, to = groupOf.get(edge.to)!
            if (from !== to && rank[to]! < rank[from]! + 1) { rank[to] = rank[from]! + 1; changed = true }
        }
        if (!changed) break
    }
    const rows = new Map<number, number>()
    const positioned = ids.map((id): FlowNode => {
        const column = rank[groupOf.get(id)!] ?? 0
        const row = rows.get(column) ?? 0
        rows.set(column, row + 1)
        const occurrences = events.filter((event) => event.nodeId === id)
        const node = nodes.get(id) ?? {id, label: 'Node metadata evicted', kind: 'external', scopeId: 'unknown', firstSequence: first, disposedSequence: null}
        const outgoing = links.some((edge) => edge.from === id)
        const leaf = outgoing ? null
            : node.kind === 'component' || node.kind === 'binding' ? 'UI endpoint'
                : node.kind === 'subscriber' ? 'subscription leaf'
                    : node.kind === 'emitter' || node.kind === 'derived' ? 'emitter without known subscribers'
                        : 'downstream leaf'
        return {node, events: occurrences, x: 20 + column * 260, y: 20 + row * 132, leaf}
    })
    return {nodes: positioned, edges: links,
        width: Math.max(300, ...positioned.map((node) => node.x + 240)),
        height: Math.max(150, ...positioned.map((node) => node.y + 120))}
}

function stronglyConnected(ids: string[], edges: FlowEdge[]): string[][] {
    const visited = new Set<string>(), order: string[] = []
    // Iterative DFS avoids call-stack limits for large retained traces.
    const forward = new Map(ids.map((id) => [id, edges.filter((edge) => edge.from === id).map((edge) => edge.to)]))
    const reverse = new Map(ids.map((id) => [id, edges.filter((edge) => edge.to === id).map((edge) => edge.from)]))
    for (const seed of ids) {
        const stack: Array<[string, boolean]> = [[seed, false]]
        while (stack.length) {
            const [id, finish] = stack.pop()!
            if (finish) { order.push(id); continue }
            if (visited.has(id)) continue
            visited.add(id); stack.push([id, true])
            for (const next of forward.get(id) ?? []) if (!visited.has(next)) stack.push([next, false])
        }
    }
    visited.clear()
    const groups: string[][] = []
    for (const seed of order.reverse()) {
        if (visited.has(seed)) continue
        const group: string[] = [], stack = [seed]
        while (stack.length) {
            const id = stack.pop()!
            if (visited.has(id)) continue
            visited.add(id); group.push(id)
            stack.push(...(reverse.get(id) ?? []))
        }
        groups.push(group)
    }
    return groups
}

export function captureLimitations(recording: TraceRecording): readonly string[] {
    const {capture} = recording
    return [
        ...(!capture.topology ? ['Topology capture was disabled; unobserved downstream connections and leaves are unknown.'] : []),
        ...(!capture.ui ? ['UI occurrence capture was disabled; component and interaction execution is unknown.'] : []),
        ...(!capture.verbose ? ['Unchanged recomputations and full input snapshots were not captured.'] : []),
        ...(capture.lateStart ? ['Capture began after the graph may have been created; earlier activity is unknown.'] : []),
        ...(capture.gaps ? [`Recording was paused ${capture.gaps} time(s); activity during those gaps is unknown.`] : []),
        ...(capture.evictedEvents ? [`${capture.evictedEvents} events evicted by the recording budget.`] : []),
        ...(capture.droppedTopology ? [`${capture.droppedTopology} topology records evicted; connected leaves may be missing.`] : []),
        ...(recording.events.some((event) => event.parentId && !recording.events.some((parent) => parent.id === event.parentId))
            ? ['Some causal parents are outside this capture.'] : []),
        ...(traceAttempts(recording.events).some((attempt) => !attempt.end)
            ? ['Some attempts are unfinished in this capture; they are not necessarily still running.'] : []),
        ...(capture.rawReferences ? ['Raw references are mutable, are omitted from JSON export, and their object heaps are outside the byte budget.'] : []),
    ]
}
