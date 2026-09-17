import {h} from '@capillaryjs/capillary-ui'
import {TraceView} from './shared.js'
import {nodeActivity} from '../model/projection.js'

export class ActivityOverviewView extends TraceView {
    static override hostName = 'traceactivity'
    override render() {
        const counts = new Map<string, number>()
        for (const event of this.events) counts.set(event.nodeId, (counts.get(event.nodeId) ?? 0) + 1)
        return this.host({role: 'region', 'aria-label': 'Trace activity'}, h('h2', null, 'Activity'),
            h('ul', null, ...[...counts].sort((a, b) => b[1] - a[1]).map(([id, count]) =>
                h('li', {key: id}, h('button', {type: 'button', onClick: () => this.props.selection.selectNode(id)},
                    `${this.label(id)} · ${this.recording.nodes.find((node) => node.id === id)
                        ? nodeActivity(this.recording.nodes.find((node) => node.id === id)!, this.events.filter((event) => event.nodeId === id))
                        : `${count} events`}`)))))
    }
}
