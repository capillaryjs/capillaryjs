import {Component} from '@capillaryjs/capillary-ui'
import type {ComponentProps} from '@capillaryjs/capillary-ui'
import type {ReadableEmitter} from '@capillaryjs/capillary'
import {TraceRecorder} from '../model/TraceRecorder.js'
import {devtoolsDiagnosticScope} from '../model/scope.js'
import {filterTrace} from '../model/projection.js'
import type {TraceRecording, TraceEvent} from '../model/types.js'
import type {TraceSelection} from '../model/TraceSelection.js'
import type {TracePlayback} from '../model/TracePlayback.js'

export interface TraceViewProps extends ComponentProps {
    recording: TraceRecording | TraceRecorder
    selection: TraceSelection
    playback?: TracePlayback
}

/** Shared view lifecycle; importing a view does not import sibling views. */
export abstract class TraceView extends Component<TraceViewProps> {
    static override diagnosticScope = devtoolsDiagnosticScope
    static override css = `
        & { display: block; min-width: 0; color: var(--cap-trace-text, var(--ui-color, #192c3d)); font: inherit; line-height: 1.5; --ui-select-bg: var(--cap-trace-selected, #eaf3ff); --ui-select-bg-dark: var(--cap-trace-selected, #eaf3ff); --ui-select-text-color: var(--cap-trace-text, #192c3d); --selected-bg-color: var(--cap-trace-selected, #eaf3ff); }
        & select, & input { font: inherit; }
        & select { color: inherit; background: var(--cap-trace-surface, #fff); border: 1px solid var(--cap-trace-line, #cad4de); border-radius: 5px; padding: .35rem .55rem; }
        & :focus-visible { outline: 3px solid var(--cap-trace-accent, #005bb8); outline-offset: 2px; }
        & [role="option"][aria-selected="true"], & [role="treeitem"][aria-selected="true"] { outline: 2px solid var(--cap-trace-accent, #005bb8); outline-offset: -2px; background: var(--cap-trace-selected, #eaf3ff); }
        & h2, & h3 { font-family: inherit; font-weight: 650; font-size: 1rem; line-height: 1.4; margin: 0 0 .75rem; }
        & p { margin: .4rem 0; }
        & small { display: block; color: var(--cap-trace-muted, #526477); }
        & .trace-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
        & .trace-pane { padding: 1rem; border: 1px solid var(--cap-trace-line, #cad4de); border-radius: 8px; background: var(--cap-trace-surface, #fff); min-width: 0; }
        & .trace-scroll { overflow: auto; max-height: 32rem; }
        & .trace-empty { padding: 1rem 0; color: var(--cap-trace-muted, #526477); }
        & table { width: 100%; border-collapse: collapse; text-align: start; }
        & th, & td { padding: .4rem; border-bottom: 1px solid var(--cap-trace-line, #cad4de); vertical-align: top; }
        & dl { display: grid; grid-template-columns: minmax(6rem, auto) minmax(0, 1fr); gap: .4rem 1rem; }
        & dt { font-weight: 600; } & dd { margin: 0; overflow-wrap: anywhere; }
        & .trace-limit { border-inline-start: 3px solid var(--cap-trace-warning, #ae6500); padding-inline-start: .7rem; }
    `
    override initialize(): void {
        if (this.props.recording instanceof TraceRecorder) this.watch(this.props.recording.revision)
        this.watch(this.props.selection.state)
        if (this.props.playback) this.watch(this.props.playback.state)
    }
    protected get recording(): TraceRecording {
        return this.props.recording instanceof TraceRecorder ? this.props.recording.snapshot() : this.props.recording
    }
    protected get events(): readonly TraceEvent[] {
        const state = this.props.selection.state.get()
        return state.rootId ? filterTrace(this.recording, state) : []
    }
    protected get cursor(): number {
        return Math.min(this.events.length - 1, this.props.playback?.state.get().cursor ?? this.events.length - 1)
    }
    protected label(nodeId: string): string { return this.recording.nodes.find((node) => node.id === nodeId)?.label ?? nodeId }
    protected choose(event: TraceEvent): void {
        this.props.selection.selectEvent(event.id, event.nodeId)
        this.props.playback?.seek(this.events.findIndex((candidate) => candidate.id === event.id), this.events.length)
    }

    /** A stateless view of the existing selection owner, not a mirrored store. */
    protected selectionValue<T>(read: () => T, write: (value: T) => void): ReadableEmitter<T> & {set(value: T): boolean} {
        const source = this.props.selection.state
        return {
            get: read,
            getError: () => source.getError(),
            getFetchState: () => source.getFetchState(),
            subscribe: (listener, options) => source.subscribe(notification =>
                listener({...notification, value: read()}), options),
            set: value => {
                // Collection reconciliation can publish the same logical value.
                // That is not a new user selection and must not reset playback.
                if (Object.is(read(), value)) return false
                const previous = source.get()
                write(value)
                return previous !== source.get()
            },
        }
    }

    /** Canvas options use the same direct selection model as other widgets. */
    protected optionProps(selected: boolean, tabbable: boolean, choose: () => void): ComponentProps {
        return {
            role: 'option', 'aria-selected': String(selected), tabIndex: tabbable ? 0 : -1,
            onClick: (event: MouseEvent) => { choose(); (event.currentTarget as HTMLElement).focus() },
            onKeyDown: (event: KeyboardEvent) => {
                if (event.defaultPrevented) return
                const current = event.currentTarget as HTMLElement
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); current.click(); return }
                const list = current.closest('[role="listbox"]')
                const options = [...list?.querySelectorAll<HTMLElement>('[role="option"]') ?? []]
                    .filter(option => option.closest('[role="listbox"]') === list)
                const index = options.indexOf(current)
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
                    : ['ArrowRight', 'ArrowDown'].includes(event.key) ? Math.min(index + 1, options.length - 1)
                        : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? Math.max(0, index - 1) : -1
                if (next < 0 || !options[next]) return
                event.preventDefault()
                options[next]!.click()
                options[next]!.focus()
            },
        }
    }
}
