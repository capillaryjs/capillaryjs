import {Button, Component, ListView, Panel, PanelToolbar, live} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {Change} from '../../model/types.js'

interface AttentionQueuePanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class AttentionQueuePanel extends Component<AttentionQueuePanelProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel
            island
            className="attention-queue-panel"
            header="Attention queue"
        >
            <PanelToolbar><Button
                label="Refresh data"
                busy={live(model.refreshing)}
                busyLabel="Refreshing…"
                onClick={() => model.refreshData()}
            /></PanelToolbar>
            <ListView
                className="attention-list"
                label="Changes in the attention profile"
                items={model.attentionChanges}
                itemKey="id"
                selectedItemEmitter={model.portfolioSelection}
                placeholderCount={4}
                renderItem={(change: Change) => <span class="attention-item">
                    <strong>{change.id}</strong>
                    <span>{change.title}</span>
                    <small>{change.risk}</small>
                </span>}
            />
        </Panel>
    }
}
