import {h} from '@capillaryjs/capillary-ui'
import {TraceView} from './shared.js'

export class ChronologicalTraceView extends TraceView {
    static override hostName = 'chronologicaltrace'
    override render() {
        const start = this.events[0]?.timestamp ?? 0
        return this.host({role: 'region', 'aria-label': 'Chronological trace'}, h('h2', null, 'Chronological trace'),
            h('div', {className: 'trace-scroll'}, h('table', null,
                h('thead', null, h('tr', null, ...['Step', 'Time', 'Event', 'Outcome'].map((label) => h('th', {scope: 'col'}, label)))),
                h('tbody', null, ...this.events.map((event) => h('tr', {key: event.id},
                    h('td', null, String(event.sequence)), h('td', null, `${event.timestamp - start} ms`),
                    h('td', null, h('button', {type: 'button', onClick: () => this.choose(event)}, `${this.label(event.nodeId)} · ${event.cause}`)),
                    h('td', null, event.outcome ?? event.kind)))))))
    }
}
