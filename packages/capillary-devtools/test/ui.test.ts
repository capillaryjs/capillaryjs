import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {Diagnostics, Emitter, FetchState, LiveQuery} from '@capillaryjs/capillary'
import {Component, createCapillaryUiRuntime, DataTable, h, live, Textbox} from '@capillaryjs/capillary-ui'
import type {ComponentProps, LivePropContract} from '@capillaryjs/capillary-ui'
import {filterTrace, nodeActivity, projectFlow, TraceDetailsView, TraceInspector, TraceRecorder, TraceSelection, TracePlayback, devtoolsDiagnosticScope} from '../src/index.js'

let window: Window
before(() => {
    window = new Window()
    Object.assign(globalThis, {window, document: window.document, Node: window.Node,
        HTMLElement: window.HTMLElement, Element: window.Element, Event: window.Event})
})
after(() => window.close())

test('renderer reports own writes, no-op renders and parent/dependency triggers', () => {
    const recorder = new TraceRecorder().start({fromStart: true})
    const value = new Emitter('first')
    class Child extends Component<{text: string}> {
        render() { return h('span', {style: {color: 'red'}, dataset: {kind: 'stable'}}, this.props.text) }
    }
    class Parent extends Component {
        render() { return h('div', null, h(Child, {text: this.read(value)})) }
    }
    const app = new Parent().mount(document.body)
    let start = recorder.snapshot().events.length
    app.update()
    let events = recorder.snapshot().events.slice(start)
    assert(events.filter(event => event.outcome === 'succeeded').every(event => event.consumer?.domWrites === 0))
    start = recorder.snapshot().events.length
    value.set('second')
    events = recorder.snapshot().events.slice(start)
    const nodes = new Map(recorder.snapshot().nodes.map(node => [node.id, node]))
    const parent = events.find(event => nodes.get(event.nodeId)?.label === 'Parent' && event.outcome === 'succeeded')!
    const child = events.find(event => nodes.get(event.nodeId)?.label === 'Child' && event.outcome === 'succeeded')!
    assert.deepEqual(parent.consumer, {trigger: 'dependency', domWrites: 0, renderPasses: 1})
    assert.deepEqual(child.consumer, {trigger: 'parent', domWrites: 1, renderPasses: 1})
    assert.equal(nodeActivity(nodes.get(child.nodeId)!, events.filter(event => event.nodeId === child.nodeId)), '1 render · 2 events')
    assert.equal((app.dom as HTMLElement).textContent, 'second')
    app.destroy(); value.dispose(); recorder.dispose()
})

test('table data updates patch the named body without rendering unchanged headers', () => {
    const recorder = new TraceRecorder().start({fromStart: true})
    const data = new Emitter([{id: 'a', name: 'Original', status: 'open'}])
    const table = new DataTable({data, rowKey: 'id', columns: [
        {field: 'name', label: 'Name', sortable: true}, {field: 'status', label: 'Status', filterable: true},
    ]}).mount(document.body)
    const header = (table.dom as HTMLElement).querySelector('thead')!
    const start = recorder.snapshot().events.length
    data.set([{id: 'a', name: 'Changed', status: 'closed'}])
    const recording = recorder.snapshot()
    const events = recording.events.slice(start)
    const nodes = new Map(recording.nodes.map(node => [node.id, node]))
    assert(recording.nodes.some(node => node.label === 'Table header'))
    assert(recording.nodes.some(node => node.label === 'Table header cell: Name'))
    assert(recording.nodes.some(node => node.label === 'Table header cell: Status'))
    assert(!events.some(event => nodes.get(event.nodeId)?.label.startsWith('Table header')))
    const body = events.find(event => nodes.get(event.nodeId)?.label === 'Table body' && event.outcome === 'succeeded')!
    assert.equal(body.consumer?.domWrites, 2)
    assert.equal((table.dom as HTMLElement).querySelector('tbody')?.textContent, 'Changedclosed')
    assert.equal((table.dom as HTMLElement).querySelector('thead'), header)
    assert(projectFlow(recording, events).nodes.some(node => node.node.label === 'Table body' && node.leaf === 'UI endpoint'))
    ;(header.querySelector('button.sort') as HTMLElement).click()
    assert.equal(header.querySelector('th')?.getAttribute('aria-sort'), 'ascending')
    ;(header.querySelector('button.filter') as HTMLElement).click()
    assert.match(header.textContent!, /closed/)
    table.destroy(); data.dispose(); recorder.dispose()
})

test('reentrant renders and failures preserve accurate counts and restore renderer scope', () => {
    const recorder = new TraceRecorder().start()
    class Reentrant extends Component {
        passes = 0
        render() {
            if (++this.passes === 1) this.update()
            return h('p', null, this.passes)
        }
    }
    const app = new Reentrant().mount(document.body)
    const recording = recorder.snapshot()
    const node = recording.nodes.find(node => node.label === 'Reentrant')!
    assert.equal(nodeActivity(node, recording.events.filter(event => event.nodeId === node.id)), '2 renders · 2 events')
    class Failure extends Component {
        render(): never { throw new Error('render failed') }
    }
    const failure = new Failure()
    assert.throws(() => failure.mount(document.body), /render failed/)
    app.update()
    assert.equal(recorder.snapshot().events.at(-1)!.consumer?.domWrites, 1)
    failure.destroy(); app.destroy(); recorder.dispose()
})

test('table and body identities survive loading/error siblings and caption changes', () => {
    const recorder = new TraceRecorder().start()
    const data = new Emitter<Array<{id: string; name: string}>>([])
    data.setWithState([], FetchState.Initial)
    const props = {data, rowKey: 'id' as const, columns: [{field: 'name' as const, label: 'Name'}]}
    const table = new DataTable(props).mount(document.body)
    const element = (table.dom as HTMLElement).querySelector('table')!
    const body = element.querySelector('tbody')!
    const header = element.querySelector('thead')!
    const initial = recorder.snapshot().nodes.filter(node => /^Table (body|header)$/.test(node.label))
    const rows = [{id: 'a', name: 'Ready'}]
    data.setWithState(rows, FetchState.Ready)
    data.setWithState(rows, FetchState.Error, new Error('Unavailable'))
    table.setProps({...props, caption: 'Added caption'})
    data.setWithState(rows, FetchState.Ready)
    assert.equal((table.dom as HTMLElement).querySelector('table'), element)
    assert.equal(element.querySelector('thead'), header)
    assert.equal(element.querySelector('tbody'), body)
    assert.deepEqual(recorder.snapshot().nodes.filter(node => /^Table (body|header)$/.test(node.label)), initial)
    table.destroy(); data.dispose(); recorder.dispose()
})

test('details expand capture-time snapshots and explain scalar capture', () => {
    for (const capture of ['snapshot', 'scalar'] as const) {
        const recorder = new TraceRecorder({capture, maxSnapshotDepth: 4}).start()
        const source = new Emitter<unknown>(null, {purpose: 'rows'})
        source.set([{name: 'Plumbing'}])
        const selection = new TraceSelection()
        const event = recorder.snapshot().events.at(-1)!
        selection.selectRoot(event.id)
        selection.selectNode(event.nodeId)
        const view = new TraceDetailsView({recording: recorder.snapshot(), selection}).mount(document.body)
        const text = (view.dom as HTMLElement).textContent!
        if (capture === 'snapshot') {
            assert.match(text, /Plumbing/)
            assert((view.dom as HTMLElement).querySelector('dl details'))
            assert.equal((view.dom as HTMLElement).querySelector('.trace-values'), null)
        } else assert.match(text, /capture: 'snapshot'/)
        view.destroy(); selection.dispose(); source.dispose(); recorder.dispose()
    }
})

test('native interaction reaches component reads, reactive children, live props, native bindings and non-UI leaves', async () => {
    const recorder = new TraceRecorder({verbose: true}).start({fromStart: true})
    const search = new Emitter('', {purpose: 'searchText'})
    const normalized = search.map((v) => v.trim(), {purpose: 'normalizedSearch'})
    const query = new LiveQuery({args: {search: normalized}, autoFetch: false, purpose: 'results',
        handler: {fetch: async ({search}) => `Result: ${search}`}})
    const text = query.map((v) => v ?? '', {purpose: 'resultText'})
    const orphan = query.map((v) => v?.length ?? 0, {purpose: 'unsubscribed result count'})
    class ResultReader extends Component { render() { return h('output', null, this.read(text)) } }
    interface TextProps extends ComponentProps, LivePropContract<'text'> {text: string}
    class LiveClass extends Component<TextProps> {
        static override liveProps = ['text']
        render() { return h('b', null, this.props.text) }
    }
    const LiveFunction = Object.assign(({text}: TextProps) => h('i', null, text), {diagnosticLabel: 'Function result'})
    class App extends Component {
        render() { return h('main', null, h(Textbox, {valueEmitter: search, label: 'Search'}),
            h(ResultReader), h('p', null, text), h('span', {title: live(text)}, 'Live title'),
            h('input', {'aria-label': 'Native search', 'bind:value': search}),
            h(LiveClass, {text: live(text)}), h(LiveFunction, {text: live(text)})) }
    }
    const app = new App().mount(document.body)
    const input = document.querySelector<HTMLInputElement>('cap-textbox input')!
    input.value = '  capillary  '
    input.dispatchEvent(new Event('input', {bubbles: true}))
    await query._activeRequest
    const recording = recorder.snapshot()
    const root = recording.events.findLast((event) => event.kind === 'interaction')!
    const chain = filterTrace(recording, {rootId: root.id})
    const names = chain.map((event) => recording.nodes.find((node) => node.id === event.nodeId)?.label)
    for (const label of ['searchText', 'normalizedSearch', 'results', 'resultText', 'ResultReader', 'LiveClass', 'Function result', 'unsubscribed result count']) {
        assert(names.includes(label), `Missing downstream node ${label}`)
    }
    assert(chain.some((event) => recording.nodes.find((node) => node.id === event.nodeId)?.label.includes('reactive child')))
    assert(chain.some((event) => recording.nodes.find((node) => node.id === event.nodeId)?.label.includes('span.title')))
    assert(chain.some((event) => recording.nodes.find((node) => node.id === event.nodeId)?.label.includes('bind:value')))
    assert.equal(document.querySelector('output')?.textContent, 'Result: capillary')
    const selection = new TraceSelection(), playback = new TracePlayback()
    selection.selectRoot(root.id)
    const inspector = new TraceInspector({recording: recorder, selection, playback}).mount(document.body)
    await Promise.resolve()
    const count = recorder.snapshot().events.length
    const roots = recording.events.filter((event) => !event.parentId).length
    for (const button of (inspector.dom as HTMLElement).querySelectorAll('button')) {
        if (button.textContent === 'First step' || button.textContent === 'Next step') button.click()
    }
    await Promise.resolve()
    assert.equal(recorder.snapshot().events.length, count)
    assert.equal(recorder.snapshot().events.filter((event) => !event.parentId).length, roots)
    assert(!recorder.snapshot().nodes.some((node) => node.scopeId === devtoolsDiagnosticScope.id))
    inspector.destroy(); selection.dispose(); playback.dispose(); app.destroy()
    orphan.dispose(); text.dispose(); query.dispose(); normalized.dispose(); search.dispose(); recorder.dispose()
})

test('two live inspectors remain excluded while subscriptions churn during recording notifications', async () => {
    const source = new Emitter(0, {purpose: 'application counter'})
    const recorders = [new TraceRecorder().start(), new TraceRecorder().start()]
    const models = recorders.map((recording) => ({recording, selection: new TraceSelection(), playback: new TracePlayback()}))
    const inspectors = models.map((props) => new TraceInspector(props).mount(document.body))
    await Promise.resolve()
    for (let index = 1; index <= 4; index++) {
        source.set(index)
        models.forEach(({recording, selection}) => selection.selectRoot(recording.snapshot().events.at(-1)!.id))
        await Promise.resolve()
        await Promise.resolve()
    }
    for (const recorder of recorders) {
        assert.equal(recorder.snapshot().events.length, 4)
        assert(recorder.snapshot().events.every((event) => event.nodeId === Diagnostics.node(source)?.id))
    }
    inspectors.forEach((inspector) => inspector.destroy())
    models.forEach(({selection, playback, recording}) => { selection.dispose(); playback.dispose(); recording.dispose() })
    source.dispose()
})

test('excluded runtime propagates construction scope to internal controls without hiding application writes', () => {
    const recorder = new TraceRecorder().start()
    const runtime = createCapillaryUiRuntime({diagnosticScope: devtoolsDiagnosticScope})
    const external = new Emitter('', {purpose: 'application value'})
    class Tool extends Component { render() { return h('div', null, h(Textbox, {label: 'Internal'}),
        h('button', {onClick: () => external.set('written')}, 'Write application')) } }
    const app = runtime.create(Tool)
    runtime.mount(app, document.body)
    const input = (app.dom as HTMLElement).querySelector('input')!
    input.value = 'internal'; input.dispatchEvent(new Event('input'))
    assert.equal(recorder.snapshot().events.length, 0)
    const button = (app.dom as HTMLElement).querySelector('button')!
    button.click()
    assert.equal(external.get(), 'written')
    assert(recorder.snapshot().events.every((event) => event.nodeId === Diagnostics.node(external)?.id))
    app.destroy(); external.dispose(); recorder.dispose()
})
