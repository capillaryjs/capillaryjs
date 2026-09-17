import {h} from '@capillaryjs/capillary-ui'
import type {CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {captureLimitations, eventValueText, nodeActivity, nodeValueEvent, traceAttempts} from '../model/projection.js'
import type {ValuePreview, ValueSnapshot} from '../model/types.js'
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
        const fields: Array<[string, CapillaryUiChild]> = [
            ['Node', node?.label ?? 'Select a node or event'], ['Identity', node?.id ?? '—'], ['Kind', node?.kind ?? '—'],
        ]
        if (node) fields.push(
            ['Activity', nodeActivity(node, this.events.filter((candidate) => candidate.nodeId === node.id))],
            ['First observed', `#${node.firstSequence}`],
            ['Disposed', node.disposedSequence === null ? 'Not observed' : `#${node.disposedSequence}`],
        )
        if (event) fields.push(
            ['Event', `#${event.sequence} · ${event.id}`], ['Cause', event.cause], ['Outcome', event.outcome ?? event.kind],
            ['Before', previewValue(event.before, event.before?.text ?? 'Not captured')],
            ['Value / effect', previewValue(event.value, eventValueText(event))],
            ['Fetch state', event.fetchState ?? '—'], ['Error', previewValue(event.error, event.error?.text ?? '—')],
            ['Parent', event.parentId ?? 'Root event'], ['Attempt', event.attemptId ?? '—'],
        )
        if (event?.consumer) fields.push(['Triggered by', event.consumer.trigger],
            ['Own renderer DOM writes', event.consumer.domWrites === undefined ? 'Unknown / not completed' : String(event.consumer.domWrites)])
        const attempts = traceAttempts(this.events).filter((attempt) => attempt.nodeId === node?.id)
        return this.host({role: 'region', 'aria-label': 'Trace details'}, h('h2', null, 'Trace details'),
            h('dl', null, ...fields.flatMap(([label, value]) => [h('dt', null, label), h('dd', null, value)])),
            event?.consumer ? h('p', null, 'Renderer counts exclude nested consumers and application DOM code. They do not measure browser paint or layout.') : null,
            node && !event ? h('p', null, 'This node is known through topology, but has no selected event at this cursor.') : null,
            event?.inputs.length ? h('details', {open: true}, h('summary', null, 'Inputs used'),
                h('ul', null, ...event.inputs.map((input) => h('li', {key: input.nodeId}, `${this.label(input.nodeId)}: `,
                    previewValue(input.value, input.value.text))))) : null,
            attempts.length ? h('details', {open: true}, h('summary', null, 'Request attempts (complete selected trace)'),
                h('ul', null, ...attempts.map((attempt) => h('li', {key: attempt.id},
                    `${attempt.id}: ${attempt.status}${attempt.durationMs === null ? '' : ` · ${attempt.durationMs} ms`}`)))) : null,
            h('div', {className: 'trace-limit', role: 'note', 'aria-label': 'Capture limitations'},
                ...captureLimitations(this.recording).map((message) => h('p', null, message))))
    }
}

function previewValue(preview: ValuePreview | null, fallback: string): CapillaryUiChild {
    if (!preview || preview.type !== 'object') {
        return `${fallback}${preview?.truncated ? '… (truncated)' : ''}`
    }
    if (preview.snapshot) return snapshotTree(null, preview.snapshot)
    return h('span', {className: 'trace-limit'},
        `${fallback}${preview.truncated ? '… (truncated)' : ''} · expandable contents were not captured. Use TraceRecorder({capture: 'snapshot'}) and record again.`)
}

function snapshotTree(label: string | null, value: ValueSnapshot): CapillaryUiChild {
    const text = `${label == null ? '' : `${label}: `}${value.text}${value.truncated ? ' … (truncated)' : ''}`
    return value.entries ? h('details', null, h('summary', null, text),
        h('ul', null, ...value.entries.map((entry, index) => h('li', {key: index}, snapshotTree(entry.key, entry.value)))))
        : h('span', null, text)
}
