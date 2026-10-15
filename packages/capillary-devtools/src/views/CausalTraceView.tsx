import {h, TreeView} from '@capillaryjs/capillary-ui'
import type {Key, TreeNode} from '@capillaryjs/capillary-ui'
import {Emitter} from '@capillaryjs/capillary'
import type {TraceEvent} from '../model/types.js'
import {devtoolsDiagnosticScope} from '../model/scope.js'
import {causalOutline, eventValueText} from '../model/projection.js'
import {TraceView} from './shared.js'

export class CausalTraceView extends TraceView {
    static override hostName = 'causaltrace'
    static override dependencies = [TreeView]
    static override css = `& cap-treeview { max-width: 100%; overflow-wrap: anywhere; }`
    private readonly expanded = new Emitter<Key[]>([], {owner: this, purpose: 'causal outline expansion', diagnosticScope: devtoolsDiagnosticScope})
    private readonly knownBranches = new Set<string>()
    private rootId: string | null | undefined
    private resetExpansion = false
    private pendingExpansion: string[] = []
    private readonly selected = this.selectionValue<Key | null>(() => {
        const id = this.props.selection.state.get().eventId
        return this.events.some(event => event.id === id) ? id : null
    }, id => {
        const event = this.events.find(event => event.id === id)
        if (event) this.choose(event)
        else if (id == null) this.props.selection.selectNode(null)
    })
    override render() {
        const events = this.events
        const rows = causalOutline(events)
        if (this.rootId !== this.props.selection.state.get().rootId) {
            this.rootId = this.props.selection.state.get().rootId
            this.knownBranches.clear()
            this.resetExpansion = true
        }
        type Branch = TreeNode<TraceEvent> & {children: Branch[]}
        const roots: Branch[] = [], stack: Branch[] = [], nodes: Branch[] = []
        for (const {event, depth} of rows) {
            const label = `#${event.sequence} ${this.label(event.nodeId)} · ${event.cause}`
            const node: Branch = {id: event.id, textValue: label, value: event, children: [],
                label: h('span', {'data-event-id': event.id,
                    'aria-current': events[this.cursor]?.id === event.id ? 'step' : undefined}, label,
                h('small', null, `${event.outcome ?? event.kind} · ${eventValueText(event)}`))}
            const level = Math.max(0, Math.min(depth, stack.length))
            const parent = stack[level - 1]
            if (parent) parent.children.push(node)
            else roots.push(node)
            stack.length = level
            stack.push(node)
            nodes.push(node)
        }
        this.pendingExpansion = nodes.filter(node => node.children.length && !this.knownBranches.has(String(node.id))).map(node => String(node.id))
        this.pendingExpansion.forEach(id => this.knownBranches.add(id))
        return this.host({role: 'region', 'aria-label': 'Causal trace'},
            h('h2', null, 'Causal trace'), rows.length ? h(TreeView<TraceEvent>, {nodes: roots, label: 'Trace events',
                selectedKeyEmitter: this.selected, expandedKeysEmitter: this.expanded})
                : h('p', {className: 'trace-empty'}, 'Select a recorded root to inspect its causal path.'))
    }
    override afterUpdate(): void {
        if (this.resetExpansion || this.pendingExpansion.length) {
            const previous = this.resetExpansion ? [] : this.expanded.get()
            this.resetExpansion = false
            const next = [...new Set([...previous, ...this.pendingExpansion])]
            this.pendingExpansion = []
            this.expanded.set(next)
        }
    }
    override onDestroy(): void { this.expanded.dispose() }
}
