import {Component, h} from '@capillaryjs/capillary-ui'
import {FlowGraphView} from '@capillaryjs/capillary-devtools/views/FlowGraphView'
import {TracePlaybackControls} from '@capillaryjs/capillary-devtools/views/TracePlaybackControls'
import {TraceDetailsView} from '@capillaryjs/capillary-devtools/views/TraceDetailsView'
import {devtoolsDiagnosticScope, traceRoots} from '@capillaryjs/capillary-devtools/model'
import type {DemoComposition} from './harness.js'
import {mountDemo} from './harness.js'

class CompactTrace extends Component<DemoComposition> {
    static override diagnosticScope = devtoolsDiagnosticScope
    static override dependencies = [FlowGraphView, TracePlaybackControls, TraceDetailsView]
    initialize(): void { this.watch(this.props.recorder.revision, this.props.selection.state) }
    render() {
        const {recorder, selection, playback} = this.props
        const props = {recording: recorder, selection, playback}
        return h('section', {className: 'compact-trace', 'aria-label': 'Compact event trace'},
            h('label', null, 'Recent event ', h('select', {'aria-label': 'Recent event', value: selection.state.get().rootId ?? '',
                onChange: (event: Event) => { selection.selectRoot((event.currentTarget as HTMLSelectElement).value); playback.seek(null, 0) }},
                h('option', {value: ''}, 'Choose an event'), ...traceRoots(recorder.snapshot()).toReversed().map((event) =>
                    h('option', {key: event.id, value: event.id}, `#${event.sequence} ${event.cause}`)))),
            h(FlowGraphView, props), h(TracePlaybackControls, props),
            h('details', null, h('summary', null, 'Event details'), h(TraceDetailsView, props)))
    }
}
mountDemo((models) => new CompactTrace(models))
