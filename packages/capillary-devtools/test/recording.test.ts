import assert from 'node:assert/strict'
import {test} from 'node:test'
import {DerivedEmitter, Diagnostics, Emitter, EventBubble, LiveQuery} from '@capillaryjs/capillary'
import {captureLimitations, filterTrace, nodeValueEvent, projectFlow, traceAttempts, traceRoots, TracePlayback, TraceRecorder, TraceSelection} from '../src/model/index.js'

test('one interaction retains both convergence paths, dormant leaves and immutable history', () => {
    let time = 0
    const recorder = new TraceRecorder({verbose: true, clock: () => time++}).start({fromStart: true})
    const source = new Emitter(1, {purpose: 'source'})
    const left = source.map((v) => v * 2, {purpose: 'left'})
    const right = source.map((v) => v + 10, {purpose: 'right'})
    const result = new DerivedEmitter([left, right] as const, ([a, b]) => a + b, {purpose: 'result'})
    const idle = source.map(() => 0, {purpose: 'unchanged'})
    const action = {}
    Diagnostics.configure(action, {kind: 'interaction', label: 'Increment'})
    Diagnostics.interaction(action, 'click', () => source.set(2))
    const recording = recorder.snapshot()
    const root = traceRoots(recording).find((event) => event.kind === 'interaction')!
    const target = recording.nodes.find((node) => node.label === 'result')!
    const events = filterTrace(recording, {rootId: root.id, targetId: target.id})
    assert.equal(events.filter((event) => event.nodeId === target.id).length, 2)
    assert(events.some((event) => recording.nodes.find((node) => node.id === event.nodeId)?.label === 'left'))
    assert(events.some((event) => recording.nodes.find((node) => node.id === event.nodeId)?.label === 'right'))
    const flow = projectFlow(recording, filterTrace(recording, {rootId: root.id}))
    assert.equal(flow.nodes.filter((node) => node.node.id === target.id).length, 1)
    assert(flow.nodes.some((node) => node.node.label === 'result' && node.leaf))
    assert(recording.events.some((event) => event.kind === 'recomputed-unchanged'))
    const before = recording.events.length
    source.set(3)
    assert.equal(recording.events.length, before)
    assert(Object.isFrozen(recording.events))
    recorder.dispose(); idle.dispose(); result.dispose(); left.dispose(); right.dispose(); source.dispose()
})

test('default capture never touches object properties; raw export never invokes toJSON', () => {
    let accessed = 0
    const value = new Proxy({}, {get() { accessed++; throw new Error('getter') }, ownKeys() { accessed++; throw new Error('keys') }})
    const recorder = new TraceRecorder().start()
    const source = new Emitter<unknown>(null)
    source.set(value)
    assert.equal(accessed, 0)
    assert.equal(recorder.snapshot().events.at(-1)?.value.raw, undefined)
    assert(recorder.export().includes('contents not captured'))
    recorder.dispose()
    const raw = new TraceRecorder({capture: 'raw'}).start()
    source.set({toJSON() { throw new Error('must not serialize') }})
    assert.equal(raw.snapshot().events.at(-1)?.value.historical, false)
    assert.doesNotThrow(() => raw.export())
    raw.dispose(); source.dispose()
})

test('snapshot capture retains bounded immutable nested values without getters or toJSON', () => {
    let calls = 0
    const row = {name: 'Plumbing', progress: 40}
    const value = {rows: [row], total: 1, get secret() { calls++; return 'secret' },
        toJSON() { calls++; throw new Error('must not call') }}
    const recorder = new TraceRecorder({capture: 'snapshot', maxSnapshotDepth: 4}).start()
    const source = new Emitter<unknown>(null)
    source.set(value)
    const snapshot = recorder.snapshot().events.at(-1)!.value.snapshot!
    row.name = 'Later mutation'
    assert.equal(calls, 0)
    assert(Object.isFrozen(snapshot))
    assert(Object.isFrozen(snapshot.entries))
    assert(Object.isFrozen(snapshot.entries![0]!.value))
    const json = recorder.export()
    assert.match(json, /Plumbing/)
    assert(!json.includes('Later mutation'))
    assert.match(json, /Accessor not invoked/)
    assert.equal(calls, 0)
    recorder.dispose(); source.dispose()
})

test('snapshot bounds disclose cycles, depth/entry/string limits and proxy failures', () => {
    const recorder = new TraceRecorder({capture: 'snapshot', maxSnapshotDepth: 2,
        maxSnapshotEntries: 5, maxPreviewLength: 30}).start()
    const source = new Emitter<unknown>(null)
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    source.set(cycle)
    assert.match(recorder.export(), /Circular reference/)
    source.set({nested: {deep: {secret: 'not retained'}}})
    assert.match(recorder.export(), /depth limit/)
    assert(!recorder.export().includes('not retained'))
    source.set(Array.from({length: 20}, (_, index) => 'value-' + index + '-'.repeat(100)))
    const preview = recorder.snapshot().events.at(-1)!.value.snapshot!
    assert.equal(preview.entries!.length, 5)
    assert.equal(preview.truncated, true)
    assert.equal(preview.entries![0]!.value.truncated, true)
    assert(preview.entries!.every((entry) => entry.value.text.length <= 30))
    source.set(new Proxy({}, {ownKeys() { throw new Error('private error') }}))
    assert.equal(recorder.snapshot().events.at(-1)!.value.snapshot!.text, '[Capture failed]')
    assert(!recorder.export().includes('private error'))
    recorder.dispose(); source.dispose()
    assert.throws(() => new TraceRecorder({maxSnapshotDepth: 21}), /maxSnapshotDepth/)
    assert.throws(() => new TraceRecorder({maxSnapshotEntries: 0}), /maxSnapshotEntries/)
})

test('nested snapshot bytes participate in the recording budget', () => {
    const recorder = new TraceRecorder({capture: 'snapshot', maxBytes: 3000}).start()
    const source = new Emitter<unknown>(null)
    for (let index = 0; index < 10; index++) source.set({rows: Array.from({length: 100}, () => ({name: 'x'.repeat(500)}))})
    assert(recorder.snapshot().capture.bytes <= 3000)
    assert(recorder.snapshot().capture.evictedEvents > 0)
    recorder.dispose(); source.dispose()
})

test('formatter failures, truncation, reentry and privacy redaction are isolated', () => {
    const source = new Emitter<unknown>('start')
    let mode = 'redact'
    const recorder = new TraceRecorder({capture: 'formatter', maxPreviewLength: 16, formatter: () => {
        if (mode === 'throw') throw new Error('secret formatter details')
        if (mode === 'reenter') source.set('formatter write')
        return 'redacted-value-that-is-long'
    }}).start()
    source.set({secret: 'do not retain'})
    assert.equal(recorder.snapshot().events.at(-1)?.value.truncated, true)
    assert(!recorder.export().includes('do not retain'))
    mode = 'throw'; source.set('next')
    assert.equal(recorder.snapshot().events.at(-1)?.value.captureError, 'Preview capture failed')
    mode = 'reenter'; source.set('last')
    assert(recorder.snapshot().events.length < 10)
    recorder.dispose(); source.dispose()
})

test('event, node, edge and byte budgets disclose eviction and late capture', () => {
    const source = new Emitter(0)
    const recorder = new TraceRecorder({maxEvents: 4, maxNodes: 3, maxEdges: 3, maxBytes: 4000}).start({roots: [source]})
    for (let i = 1; i < 30; i++) {
        source.set(i)
        const leaf = source.map((v) => v)
        leaf.dispose()
    }
    const recording = recorder.snapshot()
    assert(recording.events.length <= 4)
    assert(recording.nodes.length <= 3)
    assert(recording.edges.length <= 3)
    assert(recording.capture.bytes <= 4000)
    assert(recording.capture.evictedEvents > 0)
    assert(recording.capture.droppedTopology > 0)
    assert(captureLimitations(recording).some((message) => message.includes('earlier activity')))
    recorder.stop().start()
    assert.equal(recorder.snapshot().capture.gaps, 1)
    recorder.dispose(); source.dispose()
})

test('query retry attempts have terminal dispositions and remain linked to their interaction', async () => {
    const recorder = new TraceRecorder().start({fromStart: true})
    let calls = 0
    const query = new LiveQuery({autoFetch: false, retry: {maxAttempts: 2, delayMs: 0}, handler: {fetch() {
        if (++calls === 1) throw new Error('try again')
        return 42
    }}})
    await Diagnostics.interaction({}, 'Retry query', () => query.refresh())
    const recording = recorder.snapshot()
    assert.deepEqual(traceAttempts(recording.events).map((attempt) => attempt.status), ['failed', 'succeeded'])
    assert.equal(traceRoots(recording).length, 1)
    assert(recording.events.some((event) => event.kind === 'retry'))
    const queryEvents = recording.events.filter((event) => event.nodeId === Diagnostics.node(query)?.id)
    assert.equal(queryEvents.at(-1)?.value.type, 'undefined', 'Terminal lifecycle marker has no result payload')
    assert.equal(nodeValueEvent(queryEvents)?.value.text, '42', 'Node state keeps the actual result')
    query.dispose(); recorder.dispose()
})

test('step, scrub, timed replay and selection only affect excluded inspection state', () => {
    const recorder = new TraceRecorder().start()
    const source = new Emitter(0)
    source.set(1); source.set(2)
    const events = recorder.snapshot().events
    const queue: Array<() => void> = []
    const playback = new TracePlayback({schedule: (callback) => { queue.push(callback); return callback },
        cancel: (handle) => { const index = queue.indexOf(handle as () => void); if (index >= 0) queue.splice(index, 1) }})
    const selection = new TraceSelection()
    selection.selectRoot(events[0]!.id)
    playback.seek(0, events.length)
    playback.step(1, events)
    playback.play(events, {mode: 'elapsed'})
    while (queue.length) queue.shift()!()
    assert.equal(playback.state.get().playing, false)
    assert.equal(source.get(), 2)
    assert.equal(recorder.snapshot().events.length, events.length)
    selection.dispose(); playback.dispose(); recorder.dispose(); source.dispose()
})

test('manual owners keep distinct identities and reduced capture discloses its missing evidence', () => {
    const recorder = new TraceRecorder({topology: false, ui: false}).start({fromStart: true})
    const a = {}, b = {}
    new EventBubble({owner: a, purpose: 'same label'})
    new EventBubble({owner: b, purpose: 'same label'})
    new EventBubble({owner: a, purpose: 'same label'})
    const recording = recorder.snapshot()
    assert.equal(recording.nodes.length, 2)
    assert.equal(recording.events[0]!.nodeId, recording.events[2]!.nodeId)
    assert.notEqual(recording.events[0]!.nodeId, recording.events[1]!.nodeId)
    assert(captureLimitations(recording).some((message) => message.includes('Topology capture was disabled')))
    assert(captureLimitations(recording).some((message) => message.includes('UI occurrence capture was disabled')))
    recorder.dispose()
})

test('feedback topology has finite stable geometry and timed playback cancellation releases its timer', () => {
    const recorder = new TraceRecorder().start()
    const a = new Emitter(0), b = new Emitter(0)
    Diagnostics.configure(a, {kind: 'emitter', label: 'A', sources: [b], targets: [b]})
    Diagnostics.configure(b, {kind: 'emitter', label: 'B', sources: [a], targets: [a]})
    Diagnostics.inspect(a)
    a.set(1); b.set(2)
    const recording = recorder.snapshot()
    const flow = projectFlow(recording, recording.events)
    assert(flow.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)))
    assert.equal(flow.nodes.length, 2)
    let pending = 0, delay = 0
    const playback = new TracePlayback({schedule: (_callback, ms) => { pending++; delay = ms; return 1 },
        cancel: () => { pending-- }})
    playback.play(recording.events.map((event, i) => ({...event, timestamp: i * 10000})), {mode: 'elapsed', maxIdleMs: 80})
    assert.equal(delay, 80)
    playback.dispose()
    assert.equal(pending, 0)
    recorder.dispose(); a.dispose(); b.dispose()
})
