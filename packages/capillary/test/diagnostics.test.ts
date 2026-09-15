import assert from 'node:assert/strict'
import {test} from 'node:test'
import {AsyncCommand, DerivedEmitter, Diagnostics, DiagnosticScope, Emitter, EventBubble, EventBus, LiveQuery} from '../src/index.js'
import type {DiagnosticFact} from '../src/index.js'

test('individual events include async descendants while legacy root observation remains roots only', async () => {
    const facts: DiagnosticFact[] = [], roots: EventBubble<unknown>[] = []
    const stop = Diagnostics.subscribe((fact) => facts.push(fact))
    const stopRoots = EventBus.subscribe((event) => roots.push(event))
    const source = new Emitter('a', {purpose: 'search'})
    const query = new LiveQuery({args: {source}, autoFetch: false, handler: {fetch: async ({source}) => source.toUpperCase()}})
    source.set('b')
    await query._activeRequest
    const events = facts.flatMap((fact) => fact.type === 'event' ? [fact.event] : [])
    assert(events.some((event) => event.diagnostic?.kind === 'attempt' && event.diagnostic.outcome === 'succeeded'))
    assert(roots.every((root) => root.parent === null))
    assert(events.some((event) => event.parent && !roots.includes(event)))
    query.dispose(); source.dispose(); stop(); stopRoots()
})

test('late graph discovery includes dormant leaves, replaced sources and plain callbacks that write downstream', () => {
    const source = new Emitter(0, {purpose: 'source'})
    const replacement = new Emitter(2, {purpose: 'replacement'})
    const unchanged = source.map(() => 1, {purpose: 'unchanged leaf'})
    const terminal = new Emitter(0, {purpose: 'callback output'})
    const detach = source.subscribe(({value}) => terminal.set(value), {emitCurrent: false, diagnosticLabel: 'persist callback'})
    const facts: DiagnosticFact[] = []
    const stop = Diagnostics.subscribe((fact) => facts.push(fact), {verbose: true})
    Diagnostics.inspect(source)
    source.set(1)
    const output = facts.findLast((fact) => fact.type === 'event' && fact.event.purpose === 'callback output')
    assert(output?.type === 'event')
    assert.equal(output.event.parent?.purpose, 'persist callback')
    assert(facts.some((fact) => fact.type === 'event' && fact.event.diagnostic?.kind === 'recomputed-unchanged'))
    unchanged.setSourcesAndCompute([replacement], () => 1)
    assert(facts.some((fact) => fact.type === 'edge' && !fact.connected))
    detach(); stop(); unchanged.dispose(); source.dispose(); replacement.dispose(); terminal.dispose()
})

test('excluded scopes suppress direct, derived, command and query facts even with captured parents', async () => {
    const facts: DiagnosticFact[] = []
    const stop = Diagnostics.subscribe((fact) => facts.push(fact), {verbose: true})
    const parent = new EventBubble({purpose: 'parent'})
    facts.length = 0
    const diagnosticScope = new DiagnosticScope('excluded', false)
    const source = new Emitter(0, {diagnosticScope})
    const derived = new DerivedEmitter([source] as const, ([value]) => value + 1)
    const mapped = source.mapEach as unknown
    assert(mapped)
    const query = new LiveQuery({diagnosticScope, autoFetch: false, args: {source}, handler: {fetch: () => 1}})
    const command = new AsyncCommand({diagnosticScope, execute: () => 1})
    source.set(1, parent)
    await query.refresh(parent)
    await command.run(undefined, parent)
    query.dispose(); command.dispose(); derived.dispose(); source.dispose()
    assert.equal(facts.length, 0)
    stop()
})

test('observers and reentrant sinks cannot break or recursively record application notification', () => {
    const source = new Emitter(0)
    let notifications = 0
    source.subscribe(() => { notifications += 1 }, {emitCurrent: false})
    const stop = Diagnostics.subscribe(() => { throw new Error('bad diagnostics observer') })
    assert.equal(source.set(1), true)
    assert.equal(notifications, 1)
    stop(); source.dispose()
})

test('unsubscribe during an in-flight delivery preserves identity without inventing callback roots', () => {
    const facts: DiagnosticFact[] = []
    const source = new Emitter(0, {diagnosticScope: new DiagnosticScope('tool', false)})
    const target = {}
    Diagnostics.configure(target, {kind: 'component', label: 'tool view', scope: source.diagnosticScope})
    let detach: () => void = () => {}
    source.subscribe(() => detach(), {emitCurrent: false, diagnosticTarget: target})
    let calls = 0
    detach = source.subscribe(() => { calls++ }, {emitCurrent: false, diagnosticTarget: target})
    const stop = Diagnostics.subscribe((fact) => facts.push(fact))
    source.set(1)
    assert.equal(calls, 1, 'Legacy subscription delivery order is preserved')
    assert.equal(facts.length, 0)
    stop(); source.dispose()
})

test('supersession, retry failure/success and disposal have distinct terminal attempt identities', async () => {
    const events: EventBubble<unknown>[] = []
    const stop = Diagnostics.subscribe((fact) => { if (fact.type === 'event') events.push(fact.event) })
    let resolveOld: (value: number) => void = () => {}
    let calls = 0
    const query = new LiveQuery({autoFetch: false, retry: {maxAttempts: 2, delayMs: 0}, handler: {fetch: () => {
        calls += 1
        if (calls === 1) return new Promise<number>((resolve) => { resolveOld = resolve })
        if (calls === 2) throw new Error('try again')
        return 9
    }}})
    const old = query.refresh()
    await Promise.resolve()
    await query.refresh()
    resolveOld(1); await old
    const attempts = events.filter((event) => event.diagnostic?.kind === 'attempt')
    assert.deepEqual(attempts.filter((event) => event.diagnostic?.outcome !== 'started').map((event) => event.diagnostic?.outcome),
        ['superseded', 'failed', 'succeeded'])
    assert.equal(new Set(attempts.map((event) => event.diagnostic?.attemptId)).size, 3)
    assert.equal(query.get(), 9)
    query.dispose(); stop()
})

test('query and command handler writes inherit their root and throwing subscribers report failure', async () => {
    const events: EventBubble<unknown>[] = []
    const stop = Diagnostics.subscribe((fact) => { if (fact.type === 'event') events.push(fact.event) })
    const output = new Emitter(0, {purpose: 'handler output'})
    const query = new LiveQuery({autoFetch: false, handler: {fetch: () => { output.set(1); return 1 }}})
    const command = new AsyncCommand({execute: () => { output.set(2); return 2 }})
    await Diagnostics.interaction({}, 'load', () => query.refresh())
    await Diagnostics.interaction({}, 'save', () => command.run(undefined))
    const writes = events.filter((event) => event.purpose === 'handler output')
    assert.equal(writes.length, 2)
    for (const write of writes) {
        assert.equal(write.parent?.cause, 'handler invoked')
        let root = write
        while (root.parent) root = root.parent
        assert.equal(root.diagnostic?.kind, 'interaction')
    }
    output.subscribe(() => { throw new Error('subscriber failure') }, {emitCurrent: false, diagnosticLabel: 'throwing callback'})
    assert.throws(() => output.set(3), /subscriber failure/)
    assert(events.some((event) => event.purpose === 'throwing callback' && event.diagnostic?.outcome === 'failed'))
    query.dispose(); command.dispose(); output.dispose(); stop()
})

test('reusing a callback across ownership scopes cannot suppress its application subscription', () => {
    const events: EventBubble<unknown>[] = []
    const stop = Diagnostics.subscribe((fact) => { if (fact.type === 'event') events.push(fact.event) })
    const application = new Emitter(0), tool = new Emitter(0, {diagnosticScope: new DiagnosticScope('tool', false)})
    const callback = () => {}
    application.subscribe(callback, {emitCurrent: false, diagnosticLabel: 'application subscription'})
    tool.subscribe(callback, {emitCurrent: false, diagnosticLabel: 'tool subscription'})
    application.set(1); tool.set(1)
    assert(events.some((event) => event.purpose === 'application subscription'))
    assert(!events.some((event) => event.purpose === 'tool subscription'))
    application.dispose(); tool.dispose(); stop()
})
