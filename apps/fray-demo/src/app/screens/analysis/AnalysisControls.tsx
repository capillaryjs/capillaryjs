import {Component, Panel} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {
    CategoryHidePanel,
    SplitSelectionPanel,
} from '@sylwellsoftware/fray-visualization'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface AnalysisControlsProps extends ComponentProps {
    readonly model: MeridianModel
}

export class AnalysisControls extends Component<AnalysisControlsProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel island className="analysis-controls" header="Grouping and visibility">
            <CategoryHidePanel
                items$={model.visibleChanges}
                criteria={model.groupingCriteria}
                label="Visible categories"
                description="Hide a category from both analytical views. Counts remain unfiltered."
                initiallyOpen={({key}) => key === 'risk' || key === 'lifecycle'}
            />
            <SplitSelectionPanel
                model={model.splitSelection}
                label="Distribution groups"
                description="Apply a preset or enable and reorder grouping levels."
            />
        </Panel>
    }
}
