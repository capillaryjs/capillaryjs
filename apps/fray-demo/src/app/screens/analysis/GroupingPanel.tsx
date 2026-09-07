import {Component, Panel} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {SplitSelectionPanel} from '@sylwellsoftware/fray-visualization'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface GroupingPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class GroupingPanel extends Component<GroupingPanelProps> {
    render(): FrayChild {
        return <Panel island className="grouping-panel" header="Grouping">
            <SplitSelectionPanel
                model={this.props.model.splitSelection}
                label="Distribution groups"
                description="Apply a preset or enable and reorder grouping levels."
            />
        </Panel>
    }
}
