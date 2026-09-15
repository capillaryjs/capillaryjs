import {h} from '@capillaryjs/capillary-ui'
import {nodeValueEvent, projectFlow} from '../model/projection.js'
import {TraceView} from './shared.js'

export class FlowGraphView extends TraceView {
    static override hostName = 'traceflow'
    static override css = `
        & .trace-canvas { position: relative; }
        & .trace-node { position: absolute; width: 218px; min-height: 100px; padding: .7rem; z-index: 1; border-inline-start: 4px solid var(--cap-trace-accent, #005bb8); }
        & .trace-node[data-observed="false"] { border-style: dashed; border-inline-start-color: var(--cap-trace-muted, #526477); }
        & .trace-node[data-observed="true"][data-reached="false"] { border-inline-start-color: var(--cap-trace-line, #cad4de); }
        & .trace-node[aria-current="step"] { box-shadow: 0 0 0 3px var(--cap-trace-accent, #005bb8); }
        & .trace-node strong { display: block; overflow-wrap: anywhere; }
        & .trace-node span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        & .trace-edge { position: absolute; height: 0; border-top: 2px solid var(--cap-trace-accent, #005bb8); transform-origin: left center; }
        & .trace-edge[data-observed="false"] { border-top-style: dashed; border-top-color: var(--cap-trace-muted, #526477); }
        & .trace-edge[data-observed="true"][data-reached="false"] { border-top-color: var(--cap-trace-line, #cad4de); color: var(--cap-trace-line, #cad4de); }
        & .trace-edge::after { content: ''; position: absolute; right: 0; top: -5px; width: 7px; height: 7px; border-top: 2px solid currentColor; border-right: 2px solid currentColor; transform: rotate(45deg); }
        & .trace-leaves { display: flex; flex-wrap: wrap; gap: .5rem; list-style: none; padding: 0; }
    `
    override render() {
        const events = this.events
        const flow = projectFlow(this.recording, events, {includeConnected: !this.props.selection.state.get().targetId})
        const positions = new Map(flow.nodes.map((node) => [node.node.id, node]))
        const reached = new Set(events.slice(0, this.cursor + 1).map((event) => event.id))
        const byId = new Map(events.map((event) => [event.id, event]))
        const reachedEdges = new Set(events.filter((event) => reached.has(event.id) && event.parentId)
            .map((event) => `${byId.get(event.parentId!)?.nodeId}:${event.nodeId}`))
        return this.host({role: 'region', 'aria-label': 'Propagation graph'},
            h('h2', null, 'Propagation graph'),
            h('p', null, 'Solid arrows: recorded propagation. Dashed arrows: known connections with no observed hop in this trace. Pale solid paths have not reached this step yet.'),
            !events.length ? h('p', {className: 'trace-empty'}, 'Select a recorded root to follow its flow.')
                : h('div', {className: 'trace-scroll', tabIndex: 0, 'aria-label': 'Scrollable flow graph'},
                    h('div', {className: 'trace-canvas', style: {width: `${flow.width}px`, height: `${flow.height}px`}},
                        ...flow.edges.map((edge) => {
                            const from = positions.get(edge.from)!, to = positions.get(edge.to)!
                            const x = from.x + 218, y = from.y + 50, dx = to.x - x, dy = to.y + 50 - y
                            return h('div', {key: `${edge.from}:${edge.to}`, className: 'trace-edge', 'aria-hidden': true,
                                'data-observed': String(edge.observed), 'data-reached': String(reachedEdges.has(`${edge.from}:${edge.to}`)),
                                style: {left: `${x}px`, top: `${y}px`,
                                    width: `${Math.hypot(dx, dy)}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)`}})
                        }),
                        ...flow.nodes.map(({node, events: occurrences, x, y, leaf}) => {
                            const current = nodeValueEvent(occurrences.filter((event) => reached.has(event.id)))
                            return h('button', {key: node.id, type: 'button', className: 'trace-node',
                                'data-node-id': node.id, 'data-observed': String(occurrences.length > 0),
                                'data-reached': String(Boolean(current)),
                                'aria-current': events[this.cursor]?.nodeId === node.id ? 'step' : undefined,
                                'aria-pressed': this.props.selection.state.get().nodeId === node.id,
                                style: {left: `${x}px`, top: `${y}px`}, onClick: () => this.props.selection.selectNode(node.id)},
                                h('strong', null, node.label), h('small', null, `${node.kind} · ${occurrences.length} events`),
                                h('span', null, current?.value.text ?? (occurrences.length ? 'Not reached at this step' : 'No recorded event')),
                                leaf ? h('small', null, leaf) : null)
                        }))),
            flow.nodes.some((node) => node.leaf) ? h('details', {open: true}, h('summary', null, 'Downstream leaves'),
                h('ul', {className: 'trace-leaves'}, ...flow.nodes.filter((node) => node.leaf).map(({node, leaf, events: occurrences}) =>
                    h('li', {key: node.id}, h('button', {type: 'button', onClick: () => this.props.selection.selectNode(node.id)},
                        `${node.label} — ${leaf}${occurrences.length ? '' : ' · unobserved'}`))))) : null)
    }
}
