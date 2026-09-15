import {h} from '@capillaryjs/capillary-ui'
import {TraceView} from './shared.js'

export class TracePlaybackControls extends TraceView {
    static override hostName = 'traceplayback'
    private mode: 'events' | 'elapsed' = 'events'
    override render() {
        const playback = this.props.playback
        const events = this.events
        const count = events.length
        const cursor = this.cursor
        return this.host({role: 'group', 'aria-label': 'Trace playback'}, h('div', {className: 'trace-actions'},
            h('button', {type: 'button', disabled: !playback || !count, onClick: () => playback?.seek(0, count)}, 'First step'),
            h('button', {type: 'button', disabled: !playback || cursor <= 0, onClick: () => playback?.step(-1, events)}, 'Previous step'),
            h('button', {type: 'button', disabled: !playback || !count,
                onClick: () => playback?.state.get().playing ? playback.pause() : playback?.play(events, {mode: this.mode})},
                playback?.state.get().playing ? 'Pause' : 'Play'),
            h('button', {type: 'button', disabled: !playback || cursor >= count - 1, onClick: () => playback?.step(1, events)}, 'Next step'),
            h('button', {type: 'button', disabled: !playback || !count, onClick: () => playback?.seek(null, count)}, 'Complete flow'),
            h('label', null, 'Step ', h('input', {type: 'range', min: 0, max: Math.max(0, count - 1), value: Math.max(0, cursor),
                disabled: !playback || !count, 'aria-label': 'Replay step',
                onInput: (event: Event) => playback?.seek(Number((event.currentTarget as HTMLInputElement).value), count)})),
            h('output', {'aria-live': 'polite'}, `${Math.max(0, cursor + 1)} / ${count}`),
            h('label', null, 'Timing ', h('select', {'aria-label': 'Playback timing', value: this.mode,
                onChange: (event: Event) => { this.mode = (event.currentTarget as HTMLSelectElement).value as 'events' | 'elapsed'; this.update() }},
                h('option', {value: 'events'}, 'Event steps'), h('option', {value: 'elapsed'}, 'Elapsed (idle capped at 1 s)')))),
            h('small', null, 'Playback only inspects this recording. It does not run application code. Playback starts only when you press Play.'))
    }
}
