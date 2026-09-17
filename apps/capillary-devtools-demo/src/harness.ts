import {Component, createCapillaryUiRuntime, DataTable, h, live, Textbox} from '@capillaryjs/capillary-ui'
import type {ComponentProps, VNode} from '@capillaryjs/capillary-ui'
import {TraceRecorder, TraceSelection, TracePlayback, traceRoots, devtoolsDiagnosticScope} from '@capillaryjs/capillary-devtools/model'
import {FlowScenario, ScenarioClock} from './scenario.js'
import './lab.css'

interface ScenarioProps extends ComponentProps {model: FlowScenario}
class ScenarioApp extends Component<ScenarioProps> {
    static override diagnosticLabel = 'Search application'
    static override dependencies = [Textbox, DataTable]
    render() {
        const {model} = this.props
        const button = (label: string, onClick: () => void) => h('button', {type: 'button', onClick}, label)
        return h('section', {className: 'scenario', 'aria-label': 'Live application'},
            h('h2', null, 'Try an interaction'), h('p', null, 'Type a search or run a scenario, then follow its recorded path below.'),
            h(Textbox, {label: 'Search', valueEmitter: model.search, placeholder: 'Try capillary'}),
            h('div', {className: 'scenario-actions'}, button('Direct write / diamond', () => model.direct()),
                button('Unchanged normalization', () => model.unchangedWrite()), button('Fail then retry', () => model.retry()),
                button('Start pending request', () => model.startPending()), button('Supersede pending request', () => model.supersede()),
                button('Abort request', () => model.abort()), button('Dispose query', () => model.query.dispose()),
                button('Run command', () => model.runCommand()), button('Complete command', () => model.completeCommand()),
                button('Abort command', () => model.command.abort())),
            h('div', {className: 'scenario-results'},
                h(DataTable, {dataSource: model.table, caption: 'Search results', rowKey: 'id',
                    columns: [{field: 'id', label: 'ID'}, {field: 'title', label: 'Result', sortable: true}]}),
                h('div', null, h('p', {'data-testid': 'summary'}, model.summary),
                    h('p', {title: live(model.summary)}, 'The summary also drives this title binding.'),
                    h('output', {'aria-label': 'Command result'}, model.commandText),
                    h('p', null, 'Combined score and saved search are non-UI leaves.'))))
    }
}

export interface DemoComposition extends ComponentProps {
    recorder: TraceRecorder
    selection: TraceSelection
    playback: TracePlayback
    runtime: ReturnType<typeof createCapillaryUiRuntime>
}

export function mountDemo(compose: (models: DemoComposition) => Component): void {
    const parameters = new URLSearchParams(location.search)
    const clock = new ScenarioClock()
    const recorder = new TraceRecorder({verbose: true, capture: 'snapshot', clock: clock.now,
        maxEvents: parameters.has('limit') ? 12 : 2000})
    const late = parameters.has('late')
    if (!late) recorder.start({fromStart: true})
    const model = new FlowScenario(clock)
    const selection = new TraceSelection(), playback = new TracePlayback()
    const applicationRuntime = createCapillaryUiRuntime()
    applicationRuntime.registerStyles(ScenarioApp)
    const root = document.getElementById('app')!
    const heading = document.createElement('header')
    heading.className = 'lab-header'
    const title = document.createElement('h1'); title.textContent = 'Follow the whole story.'
    const subtitle = document.createElement('p'); subtitle.textContent = 'CAPILLARY DEVTOOLS / CAUSAL FLOW LAB'
    const navigation = document.createElement('nav'); navigation.setAttribute('aria-label', 'Demo composition')
    for (const [label, href] of [['Workbench', './index.html'], ['Compact view', './compact.html'],
        ['Bounded capture', './index.html?limit=12'], ['Late capture', './index.html?late=1']]) {
        const link = document.createElement('a'); link.textContent = label!; link.href = href!; navigation.append(link)
    }
    heading.append(subtitle, title, navigation); root.append(heading)
    const application = applicationRuntime.create(ScenarioApp, {model})
    applicationRuntime.mount(application, root)
    applicationRuntime.injectStyles()
    if (late) recorder.start({roots: model.diagnosticEntryPoints()})
    const runtime = createCapillaryUiRuntime({diagnosticScope: devtoolsDiagnosticScope})
    const inspector = compose({recorder, selection, playback, runtime})
    runtime.registerStyles(inspector.constructor as typeof Component)
    runtime.mount(inspector, root); runtime.injectStyles()
    recorder.revision.subscribe(() => {
        const recording = recorder.snapshot()
        const root = traceRoots(recording).findLast((event) => event.kind === 'interaction'
            && recording.events.some((child) => child.parentId === event.id))
        if (root && selection.state.get().rootId !== root.id) { selection.selectRoot(root.id); playback.seek(null, 0) }
    }, {emitCurrent: false, diagnosticScope: devtoolsDiagnosticScope})
    // Explicit demo diagnostics for semantic browser assertions; no application mutation API.
    Reflect.set(window, 'capillaryFlowLab', {
        recording: () => JSON.parse(recorder.export()) as unknown,
        metrics: () => model.metrics(),
        selected: () => selection.state.get(),
    })
    window.addEventListener('pagehide', () => { inspector.destroy(); application.destroy(); recorder.dispose();
        selection.dispose(); playback.dispose(); model.dispose() }, {once: true})
}
