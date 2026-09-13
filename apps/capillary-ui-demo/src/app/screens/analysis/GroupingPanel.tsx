import {Component} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {SplitSelectionPanel} from '@capillaryjs/capillary-viz'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface GroupingPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class GroupingPanel extends Component<GroupingPanelProps> {
    render(): CapillaryUiChild {
        return <SplitSelectionPanel
            island
            className="grouping-panel"
            model={this.props.model.splitSelection}
            label="Distribution groups"
            description="Apply a preset or enable and reorder grouping levels."
        />
    }
}
