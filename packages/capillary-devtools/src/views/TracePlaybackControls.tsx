import {h, Button} from '@capillaryjs/capillary-ui'
import {TraceView} from './shared.js'

export class TracePlaybackControls extends TraceView {
    static override hostName = 'traceplayback'
    static override dependencies = [Button]
    private mode: 'events' | 'elapsed' = 'events'
    override render() {
        const playback = this.props.playback
        const events = this.events
        const count = events.length
        const cursor = this.cursor
        return this.host({role: 'group', 'aria-label': 'Trace playback'}, h('div', {className: 'trace-actions'},
            h(Button, {icon: 'first', ariaLabel: 'First step', appearance: 'subtle', disabled: !playback || !count, onClick: () => playback?.seek(0, count)}),
            h(Button, {icon: 'previous', ariaLabel: 'Previous step', appearance: 'subtle', disabled: !playback || cursor <= 0, onClick: () => playback?.step(-1, events)}),
            h(Button, {icon: playback?.state.get().playing ? 'pause' : 'play', ariaLabel: playback?.state.get().playing ? 'Pause' : 'Play', appearance: 'subtle', disabled: !playback || !count,
                busy: playback?.state.get().playing ?? false, disableWhileRunning: false,
                onClick: () => playback?.state.get().playing ? playback.pause() : playback?.play(events, {mode: this.mode})}),
            h(Button, {icon: 'next', ariaLabel: 'Next step', appearance: 'subtle', disabled: !playback || cursor >= count - 1, onClick: () => playback?.step(1, events)}),
            h(Button, {icon: 'last', ariaLabel: 'Complete flow', appearance: 'subtle', disabled: !playback || !count, onClick: () => playback?.seek(null, count)}),
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
