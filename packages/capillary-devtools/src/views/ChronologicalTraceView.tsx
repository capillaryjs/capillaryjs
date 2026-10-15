import {h, DataTable} from '@capillaryjs/capillary-ui'
import type {TraceEvent} from '../model/types.js'
import {TraceView} from './shared.js'

interface EventRow extends Record<string, unknown> {
    id: string
    step: number
    time: string
    label: string
    outcome: string
    event: TraceEvent
}

export class ChronologicalTraceView extends TraceView {
    static override hostName = 'chronologicaltrace'
    static override dependencies = [DataTable]
    private rows: EventRow[] = []
    private readonly selected = this.selectionValue<EventRow | null>(() =>
        this.rows.find(row => row.id === this.props.selection.state.get().eventId) ?? null,
    row => { if (row) this.choose(row.event); else this.props.selection.selectNode(null) })
    override render() {
        const start = this.events[0]?.timestamp ?? 0
        this.rows = this.events.map(event => ({id: event.id, step: event.sequence,
            time: `${event.timestamp - start} ms`, label: `${this.label(event.nodeId)} · ${event.cause}`,
            outcome: event.outcome ?? event.kind, event}))
        return this.host({role: 'region', 'aria-label': 'Chronological trace'}, h('h2', null, 'Chronological trace'),
            h(DataTable<EventRow>, {data: this.rows, rowKey: 'id', caption: 'Recorded events', selectedItemEmitter: this.selected,
                columns: [{field: 'step', label: 'Step'}, {field: 'time', label: 'Time'},
                    {field: 'label', label: 'Event', render: row => h('span', {'data-event-id': row.id}, row.label)},
                    {field: 'outcome', label: 'Outcome'}]}))
    }
}
