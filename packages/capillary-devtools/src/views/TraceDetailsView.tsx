import {h} from '@capillaryjs/capillary-ui'
import {captureLimitations, nodeValueEvent, traceAttempts} from '../model/projection.js'
import {TraceView} from './shared.js'

export class TraceDetailsView extends TraceView {
    static override hostName = 'tracedetails'
    override render() {
        const selection = this.props.selection.state.get()
        const stepping = this.props.playback?.state.get().cursor != null
        const event = selection.eventId ? (stepping ? this.events[this.cursor]
            : this.recording.events.find((candidate) => candidate.id === selection.eventId))
            : nodeValueEvent(this.events.slice(0, this.cursor + 1).filter((candidate) => candidate.nodeId === selection.nodeId))
        const node = this.recording.nodes.find((candidate) => candidate.id === (selection.eventId ? event?.nodeId : selection.nodeId))
        const fields: Array<[string, string]> = [
            ['Node', node?.label ?? 'Select a node or event'], ['Identity', node?.id ?? '—'], ['Kind', node?.kind ?? '—'],
            ...(node ? [['First observed', `#${node.firstSequence}`],
                ['Disposed', node.disposedSequence === null ? 'Not observed' : `#${node.disposedSequence}`]] as Array<[string, string]> : []),
            ...(event ? [
                ['Event', `#${event.sequence} · ${event.id}`], ['Cause', event.cause], ['Outcome', event.outcome ?? event.kind],
                ['Before', event.before?.text ?? 'Not captured'], ['Value', event.value.text + (event.value.truncated ? '… (truncated)' : '')],
                ['Fetch state', event.fetchState ?? '—'], ['Error', event.error?.text ?? '—'],
                ['Parent', event.parentId ?? 'Root event'], ['Attempt', event.attemptId ?? '—'],
            ] as Array<[string, string]> : []),
        ]
        const attempts = traceAttempts(this.events).filter((attempt) => attempt.nodeId === node?.id)
        return this.host({role: 'region', 'aria-label': 'Trace details'}, h('h2', null, 'Trace details'),
            h('dl', null, ...fields.flatMap(([label, value]) => [h('dt', null, label), h('dd', null, value)])),
            node && !event ? h('p', null, 'This node is known through topology, but has no selected event at this cursor.') : null,
            event?.inputs.length ? h('details', {open: true}, h('summary', null, 'Inputs used'),
                h('ul', null, ...event.inputs.map((input) => h('li', {key: input.nodeId}, `${this.label(input.nodeId)}: ${input.value.text}`)))) : null,
            attempts.length ? h('details', {open: true}, h('summary', null, 'Request attempts (complete selected trace)'),
                h('ul', null, ...attempts.map((attempt) => h('li', {key: attempt.id},
                    `${attempt.id}: ${attempt.status}${attempt.durationMs === null ? '' : ` · ${attempt.durationMs} ms`}`)))) : null,
            h('div', {className: 'trace-limit', role: 'note', 'aria-label': 'Capture limitations'},
                ...captureLimitations(this.recording).map((message) => h('p', null, message))))
    }
}
