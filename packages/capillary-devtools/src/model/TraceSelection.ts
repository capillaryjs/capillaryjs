import {Emitter} from '@capillaryjs/capillary'
import {devtoolsDiagnosticScope} from './scope.js'

export interface TraceSelectionState {
    readonly rootId: string | null
    readonly eventId: string | null
    readonly nodeId: string | null
    readonly sourceId: string | null
    readonly targetId: string | null
}

export class TraceSelection {
    readonly state = new Emitter<TraceSelectionState>({rootId: null, eventId: null, nodeId: null,
        sourceId: null, targetId: null}, {diagnosticScope: devtoolsDiagnosticScope})
    selectRoot(rootId: string | null): void {
        this.state.set({rootId, eventId: rootId, nodeId: null, sourceId: null, targetId: null})
    }
    selectEvent(eventId: string, nodeId: string): void { this.patch({eventId, nodeId}) }
    selectNode(nodeId: string): void { this.patch({nodeId, eventId: null}) }
    filter(sourceId: string | null, targetId: string | null): void {
        this.patch({sourceId, targetId, nodeId: targetId ?? sourceId, eventId: null})
    }
    dispose(): void { this.state.dispose() }
    private patch(next: Partial<TraceSelectionState>): void { this.state.set({...this.state.get(), ...next}) }
}
