import {h} from '@capillaryjs/capillary-ui'
import {eventValueText, flowLayout, nodeActivity, nodeValueEvent, projectFlow} from '../model/projection.js'
import {TraceView} from './shared.js'

export class FlowGraphView extends TraceView {
    static override hostName = 'traceflow'
    static override css = `
        & .trace-flow-surface { position: relative; min-width: 0; min-height: 0; }
        & .trace-flow-surface > .trace-scroll { height: 100%; min-height: 0; }
        & .trace-canvas { position: relative; }
        & .trace-node { --_node-accent: var(--cap-trace-accent, #005bb8); --_node-radius-start: .45rem; --_node-radius-end: .45rem; --_node-padding-inline: .6rem; box-sizing: border-box; position: absolute; width: ${flowLayout.nodeWidth}px; min-height: 0; padding: .5rem var(--_node-padding-inline); z-index: 1; border-inline-start: 4px solid var(--_node-accent); border-start-start-radius: var(--_node-radius-start); border-end-start-radius: var(--_node-radius-start); border-start-end-radius: var(--_node-radius-end); border-end-end-radius: var(--_node-radius-end); line-height: 1.35; }
        & .trace-node[data-kind="component"], & .trace-node[data-kind="binding"] { --_node-accent: var(--cap-trace-kind-ui, #6d28d9); --_node-radius-start: 1rem; --_node-radius-end: 1rem; }
        & .trace-node[data-kind="query"] { --_node-accent: var(--cap-trace-kind-query, #0e7490); --_node-radius-start: 999px; --_node-radius-end: 999px; --_node-padding-inline: 1.05rem; }
        & .trace-node[data-kind="command"] { --_node-accent: var(--cap-trace-kind-command, #b45309); --_node-radius-start: .15rem; --_node-radius-end: .15rem; }
        & .trace-node[data-kind="derived"] { --_node-accent: var(--cap-trace-kind-derived, #0f766e); }
        & .trace-node[data-kind="subscriber"] { --_node-accent: var(--cap-trace-kind-subscriber, #4d7c0f); --_node-radius-start: .35rem; --_node-radius-end: 1rem; }
        & .trace-node[data-kind="interaction"] { --_node-accent: var(--cap-trace-kind-interaction, #be185d); --_node-radius-start: 1rem; --_node-radius-end: .35rem; }
        & .trace-node[data-kind="emitter"] { --_node-radius-start: 1rem; --_node-radius-end: .35rem; }
        & .trace-node[data-kind="external"] { --_node-accent: var(--cap-trace-kind-external, #526477); }
        & .trace-node[data-observed="false"] { border-style: dashed; border-inline-start-color: var(--cap-trace-muted, #526477); }
        & .trace-node[data-observed="true"][data-reached="false"] { border-inline-start-color: var(--cap-trace-line, #cad4de); }
        & .trace-node[aria-current="step"] { box-shadow: 0 0 0 3px var(--_node-accent); }
        & .trace-node strong { display: block; overflow-wrap: anywhere; line-height: 1.35; }
        & .trace-node small, & .trace-node span { line-height: 1.35; }
        & .trace-node span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        & .trace-edge { position: absolute; height: 0; border-top: 2px solid var(--cap-trace-accent, #005bb8); color: var(--cap-trace-accent, #005bb8); transform-origin: left center; }
        & .trace-edge[data-observed="false"] { border-top-style: dashed; border-top-color: var(--cap-trace-muted, #526477); color: var(--cap-trace-muted, #526477); }
        & .trace-edge[data-observed="true"][data-reached="false"] { border-top-color: var(--cap-trace-line, #cad4de); color: var(--cap-trace-line, #cad4de); }
        & .trace-edge::after, & .trace-legend-edge::after { content: ''; position: absolute; right: 0; top: -5px; width: 7px; height: 7px; border-top: 2px solid currentColor; border-right: 2px solid currentColor; transform: rotate(45deg); }
        & .trace-flow-help { position: absolute; inset-inline-start: .75rem; inset-block-end: 1rem; z-index: 2; box-sizing: border-box; max-inline-size: min(28rem, calc(100% - 1.5rem)); margin: 0; overflow: hidden; border: 1px solid var(--cap-trace-line, #cad4de); border-radius: .5rem; background: var(--cap-trace-surface, #fff); box-shadow: 0 .25rem .75rem rgb(0 0 0 / .18); }
        & .trace-flow-help summary { padding: .4rem .6rem; cursor: pointer; font-weight: 600; user-select: none; }
        & .trace-flow-help[open] summary { border-block-end: 1px solid var(--cap-trace-line, #cad4de); }
        & .trace-flow-help p { margin: .5rem .6rem; }
        & .trace-flow-legend { display: grid; gap: .35rem; margin: .5rem .6rem; padding: 0; list-style: none; }
        & .trace-flow-legend li { display: flex; align-items: center; gap: .65rem; }
        & .trace-legend-edge { position: relative; flex: 0 0 2.75rem; height: 0; border-top: 2px solid var(--cap-trace-accent, #005bb8); color: var(--cap-trace-accent, #005bb8); }
        & .trace-legend-edge[data-observed="false"] { border-top-style: dashed; border-top-color: var(--cap-trace-muted, #526477); color: var(--cap-trace-muted, #526477); }
        & .trace-legend-edge[data-observed="true"][data-reached="false"] { border-top-color: var(--cap-trace-line, #cad4de); color: var(--cap-trace-line, #cad4de); }
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
            h('div', {className: 'trace-flow-surface'},
                h('details', {className: 'trace-flow-help', open: true}, h('summary', null, 'Legend'),
                    h('ul', {className: 'trace-flow-legend'},
                        h('li', null, h('span', {className: 'trace-legend-edge', 'aria-hidden': true,
                            'data-observed': 'true', 'data-reached': 'true'}), 'Recorded propagation'),
                        h('li', null, h('span', {className: 'trace-legend-edge', 'aria-hidden': true,
                            'data-observed': 'false', 'data-reached': 'false'}), 'Known connection with no observed hop in this trace'),
                        h('li', null, h('span', {className: 'trace-legend-edge', 'aria-hidden': true,
                            'data-observed': 'true', 'data-reached': 'false'}), 'Recorded path not yet reached at this step')),
                    h('p', null, 'Node shape and accent color reflect node kind.'),
                    h('p', null, 'Renders count executions, not visible changes. Own DOM writes exclude nested consumers; UI consumers can also have downstream children.')),
                !events.length ? h('p', {className: 'trace-empty'}, 'Select a recorded root to follow its flow.')
                    : h('div', {className: 'trace-scroll', tabIndex: 0, 'aria-label': 'Scrollable flow graph'},
                        h('div', {className: 'trace-canvas', style: {width: `${flow.width}px`, height: `${flow.height}px`}},
                            ...flow.edges.map((edge) => {
                                const from = positions.get(edge.from)!, to = positions.get(edge.to)!
                                const x = from.x + flowLayout.nodeWidth, y = from.y + flowLayout.edgeY
                                const dx = to.x - x, dy = to.y + flowLayout.edgeY - y
                                return h('div', {key: `${edge.from}:${edge.to}`, className: 'trace-edge', 'aria-hidden': true,
                                    'data-observed': String(edge.observed), 'data-reached': String(reachedEdges.has(`${edge.from}:${edge.to}`)),
                                    style: {left: `${x}px`, top: `${y}px`,
                                        width: `${Math.hypot(dx, dy)}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)`}})
                            }),
                            ...flow.nodes.map(({node, events: occurrences, x, y, leaf}) => {
                                const current = nodeValueEvent(occurrences.filter((event) => reached.has(event.id)))
                                const kind = node.kind === 'component' || node.kind === 'binding' ? 'UI' : node.kind
                                const kindLabel = node.kind === 'component' || node.kind === 'binding' ? 'UI consumer' : node.kind
                                return h('button', {key: node.id, type: 'button', className: 'trace-node',
                                    'data-node-id': node.id, 'data-kind': node.kind, 'data-observed': String(occurrences.length > 0),
                                    'data-reached': String(Boolean(current)),
                                    'aria-current': events[this.cursor]?.nodeId === node.id ? 'step' : undefined,
                                    'aria-pressed': this.props.selection.state.get().nodeId === node.id,
                                    style: {left: `${x}px`, top: `${y}px`}, onClick: () => this.props.selection.selectNode(node.id)},
                                    h('strong', null, node.label), h('small', {title: kindLabel}, `${nodeActivity(node, occurrences)} · ${kind}`),
                                    h('span', {title: current ? eventValueText(current) : undefined}, current ? eventValueText(current) : (occurrences.length ? 'Not reached at this step' : 'No recorded event')),
                                    current?.fetchState ? h('small', null, `State: ${current.fetchState}`) : null,
                                    leaf ? h('small', null, leaf) : null)
                            })))),
            flow.nodes.some((node) => node.leaf) ? h('details', null, h('summary', null, 'Downstream leaves'),
                h('ul', {className: 'trace-leaves'}, ...flow.nodes.filter((node) => node.leaf).map(({node, leaf, events: occurrences}) =>
                    h('li', {key: node.id}, h('button', {type: 'button', onClick: () => this.props.selection.selectNode(node.id)},
                        `${node.label} — ${leaf}${occurrences.length ? '' : ' · unobserved'}`))))) : null)
    }
}
