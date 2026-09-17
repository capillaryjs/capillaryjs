import {h} from '@capillaryjs/capillary-ui'
import {causalOutline, eventValueText} from '../model/projection.js'
import {TraceView} from './shared.js'

export class CausalTraceView extends TraceView {
    static override hostName = 'causaltrace'
    static override css = `& ol { list-style: none; padding: 0; margin: 0; } & li { margin: .25rem 0; } & summary { cursor: pointer; } & button { max-width: 100%; overflow-wrap: anywhere; }`
    override render() {
        const events = this.events
        const rows = causalOutline(events)
        const ids = new Set(events.map((event) => event.id))
        const nodes = new Map<string, ReturnType<typeof h>[]>()
        const roots: ReturnType<typeof h>[] = []
        for (const {event} of [...rows].reverse()) {
            const children = nodes.get(event.id) ?? []
            const label = `#${event.sequence} ${this.label(event.nodeId)} · ${event.cause}`
            const button = h('button', {type: 'button', 'data-event-id': event.id,
                'aria-current': events[this.cursor]?.id === event.id ? 'step' : undefined,
                onClick: () => this.choose(event)}, label,
                h('small', null, `${event.outcome ?? event.kind} · ${eventValueText(event)}`))
            const content = h('li', {key: event.id}, children.length
                ? h('details', {open: true}, h('summary', null, label), button,
                    h('ol', {style: {paddingInlineStart: '1rem'}}, ...children.reverse())) : button)
            const parent = event.parentId && ids.has(event.parentId) ? event.parentId : null
            if (parent) { const list = nodes.get(parent) ?? []; list.push(content); nodes.set(parent, list) }
            else roots.push(content)
        }
        return this.host({role: 'region', 'aria-label': 'Causal trace'},
            h('h2', null, 'Causal trace'), rows.length ? h('ol', null, ...roots.reverse())
                : h('p', {className: 'trace-empty'}, 'Select a recorded root to inspect its causal path.'))
    }
}
