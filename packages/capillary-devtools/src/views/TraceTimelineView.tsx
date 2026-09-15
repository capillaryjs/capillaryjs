import {h} from '@capillaryjs/capillary-ui'
import {traceAttempts} from '../model/projection.js'
import {TraceView} from './shared.js'

export class TraceTimelineView extends TraceView {
    static override hostName = 'tracetimeline'
    override render() {
        const start = this.events[0]?.timestamp ?? 0
        return this.host({role: 'region', 'aria-label': 'Attempt timeline'}, h('h2', null, 'Attempt timeline'),
            h('p', null, 'Durations and outcomes describe the complete selected trace, independent of the replay cursor.'),
            h('div', {className: 'trace-scroll'}, h('table', null,
                h('thead', null, h('tr', null, ...['Operation', 'Start', 'Duration', 'Disposition'].map((label) => h('th', {scope: 'col'}, label)))),
                h('tbody', null, ...traceAttempts(this.events).map((attempt) => h('tr', {key: attempt.id},
                    h('td', null, this.label(attempt.nodeId), h('small', null, attempt.id)),
                    h('td', null, attempt.start ? `${attempt.start.timestamp - start} ms` : 'Outside capture'),
                    h('td', null, attempt.durationMs === null ? 'Unknown' : `${attempt.durationMs} ms`),
                    h('td', null, attempt.status)))))))
    }
}
