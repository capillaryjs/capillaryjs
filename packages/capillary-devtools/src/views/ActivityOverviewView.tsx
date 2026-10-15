import {h, ListView} from '@capillaryjs/capillary-ui'
import {TraceView} from './shared.js'
import {nodeActivity} from '../model/projection.js'

export class ActivityOverviewView extends TraceView {
    static override hostName = 'traceactivity'
    static override dependencies = [ListView]
    private readonly selected = this.selectionValue<string | null>(() => {
        const id = this.props.selection.state.get().nodeId
        return this.events.some(event => event.nodeId === id) ? id : null
    }, id => this.props.selection.selectNode(id))
    override render() {
        const counts = new Map<string, number>()
        for (const event of this.events) counts.set(event.nodeId, (counts.get(event.nodeId) ?? 0) + 1)
        return this.host({role: 'region', 'aria-label': 'Trace activity'}, h('h2', null, 'Activity'),
            h(ListView<string>, {label: 'Node activity', items: [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id),
                itemKey: id => id, selectedItemEmitter: this.selected,
                renderItem: id => h('span', {'data-node-id': id}, `${this.label(id)} · ${this.recording.nodes.find(node => node.id === id)
                    ? nodeActivity(this.recording.nodes.find(node => node.id === id)!, this.events.filter(event => event.nodeId === id))
                    : `${counts.get(id)} events`}`)}))
    }
}
