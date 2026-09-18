import {h} from '@capillaryjs/capillary-ui'
import {TraceRecorder} from '../model/TraceRecorder.js'
import {traceRoots, captureLimitations, eventValueText} from '../model/projection.js'
import {TraceView} from './shared.js'
import {FlowGraphView} from './FlowGraphView.js'
import {CausalTraceView} from './CausalTraceView.js'
import {ChronologicalTraceView} from './ChronologicalTraceView.js'
import {TraceDetailsView} from './TraceDetailsView.js'
import {TraceTimelineView} from './TraceTimelineView.js'
import {TracePlaybackControls} from './TracePlaybackControls.js'
import {ActivityOverviewView} from './ActivityOverviewView.js'

export class TraceInspector extends TraceView {
    static override hostName = 'traceinspector'
    static override dependencies = [FlowGraphView, CausalTraceView, ChronologicalTraceView, TraceDetailsView,
        TraceTimelineView, TracePlaybackControls, ActivityOverviewView]
    static override css = `
        & .trace-workbench { display: grid; grid-template-columns: minmax(12rem, 17rem) minmax(0, 1fr); gap: 1rem; }
        & .trace-stack { display: flex; flex-flow: column nowrap; gap: 1rem; min-width: 0; }
        & .trace-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(14rem, .7fr); gap: 1rem; }
        & .trace-roots { display: flex; flex-flow: column nowrap; gap: .4rem; padding: 0; list-style: none; }
        & .trace-roots button { width: 100%; }
        & select { max-width: 18rem; }
        @media (max-width: 900px) { & .trace-workbench, & .trace-columns { grid-template-columns: minmax(0, 1fr); } & .trace-roots { max-height: 12rem; overflow: auto; } }
    `
    override render() {
        const recorder = this.props.recording instanceof TraceRecorder ? this.props.recording : null
        const state = this.props.selection.state.get()
        const roots = traceRoots(this.recording).toReversed()
        const filter = (kind: 'source' | 'target') => h('label', null, kind === 'source' ? 'From source ' : 'To target ',
            h('select', {'aria-label': kind === 'source' ? 'From source' : 'To target', value: kind === 'source' ? state.sourceId ?? '' : state.targetId ?? '',
                onChange: (event: Event) => {
                    const id = (event.currentTarget as HTMLSelectElement).value || null
                    this.props.selection.filter(kind === 'source' ? id : state.sourceId, kind === 'target' ? id : state.targetId)
                    this.props.playback?.seek(null, 0)
                }}, h('option', {value: ''}, 'All'), ...this.recording.nodes.map((node) => h('option', {key: node.id, value: node.id}, node.label))))
        return this.host({role: 'region', 'aria-label': 'Capillary DevTools'},
            h('div', {className: 'trace-actions'}, h('h2', null, 'Capillary DevTools'),
                h('span', {role: 'status'}, `${this.recording.capture.active ? 'Recording' : 'Stopped'} · ${this.recording.events.length} events`),
                recorder ? h('button', {type: 'button', onClick: () => this.recording.capture.active ? recorder.stop() : recorder.start()},
                    this.recording.capture.active ? 'Stop capture' : 'Start capture') : null,
                recorder ? h('button', {type: 'button', onClick: () => { recorder.reset(); this.props.selection.selectRoot(null); this.props.playback?.seek(null, 0) }}, 'Clear recording') : null),
            ...captureLimitations(this.recording).map((message) => h('p', {key: message, className: 'trace-limit'}, message)),
            h('div', {key: 'workbench', className: 'trace-workbench'},
                h('nav', {className: 'trace-pane', 'aria-label': 'Recorded roots'}, h('h3', null, 'Recorded roots'),
                    roots.length ? h('ol', {className: 'trace-roots'}, ...roots.map((root) => h('li', {key: root.id},
                        h('button', {type: 'button', 'data-root-id': root.id, 'aria-pressed': state.rootId === root.id,
                            onClick: () => { this.props.selection.selectRoot(root.id); this.props.playback?.seek(null, 0) }},
                            `${this.label(root.nodeId)} · ${root.cause}`, h('small', null, `#${root.sequence} · ${eventValueText(root)}`)))))
                        : h('p', null, 'Interact with the application to record a trace.')),
                h('div', {className: 'trace-stack'},
                    h('div', {className: 'trace-actions'}, filter('source'), filter('target')),
                    h('div', {className: 'trace-columns'},
                        h('div', {className: 'trace-pane'}, h(FlowGraphView, this.props)),
                        h('div', {className: 'trace-pane'}, h(TraceDetailsView, this.props))),
                    h('div', {className: 'trace-pane'}, h(TracePlaybackControls, this.props)),
                    h('div', {className: 'trace-pane trace-scroll'}, h(CausalTraceView, this.props)),
                    h('details', {className: 'trace-pane'}, h('summary', null, 'Chronological events'), h(ChronologicalTraceView, this.props)),
                    h('details', {className: 'trace-pane'}, h('summary', null, 'Timeline and activity'),
                        h(TraceTimelineView, this.props), h(ActivityOverviewView, this.props)))))
    }
}
