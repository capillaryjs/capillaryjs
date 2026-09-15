import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {Diagnostics, Emitter, LiveQuery} from '@capillaryjs/capillary'
import {Component, createCapillaryUiRuntime, h, live, Textbox} from '@capillaryjs/capillary-ui'
import type {ComponentProps, LivePropContract} from '@capillaryjs/capillary-ui'
import {filterTrace, TraceInspector, TraceRecorder, TraceSelection, TracePlayback, devtoolsDiagnosticScope} from '../src/index.js'

let window: Window
before(() => {
    window = new Window()
    Object.assign(globalThis, {window, document: window.document, Node: window.Node,
        HTMLElement: window.HTMLElement, Element: window.Element, Event: window.Event})
})
after(() => window.close())

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
