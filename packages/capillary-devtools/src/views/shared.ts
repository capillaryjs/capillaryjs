import {Component} from '@capillaryjs/capillary-ui'
import type {ComponentProps} from '@capillaryjs/capillary-ui'
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
        & { display: block; min-width: 0; color: var(--cap-trace-text, #192c3d); font: 13px/1.5 system-ui, sans-serif; }
        & button, & select, & input { font: inherit; }
        & button, & select { color: inherit; background: var(--cap-trace-surface, #fff); border: 1px solid var(--cap-trace-line, #cad4de); border-radius: 5px; padding: .35rem .55rem; }
        & button { cursor: pointer; text-align: start; }
        & button:disabled { cursor: default; opacity: .55; }
        & :focus-visible { outline: 3px solid var(--cap-trace-accent, #005bb8); outline-offset: 2px; }
        & button[aria-pressed="true"], & button[aria-current="step"] { outline: 2px solid var(--cap-trace-accent, #005bb8); outline-offset: -2px; background: var(--cap-trace-selected, #eaf3ff); }
        & h2, & h3 { font: 650 1rem/1.4 system-ui, sans-serif; margin: 0 0 .75rem; }
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
}
