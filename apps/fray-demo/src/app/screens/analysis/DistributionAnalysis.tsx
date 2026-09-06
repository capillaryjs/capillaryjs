import {Component, Panel} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {BlockGraph} from '@sylwellsoftware/fray-visualization'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface DistributionAnalysisProps extends ComponentProps {
    readonly model: MeridianModel
}

export class DistributionAnalysis extends Component<DistributionAnalysisProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel island className="distribution-panel" header="Portfolio distribution">
            <BlockSelectionSummary key="block-selection-summary" model={model} />
            <BlockGraph
                model={model.blockSelection}
                label="Visible change distribution"
                description="Area represents records after shared and category filters."
            />
        </Panel>
    }
}

class BlockSelectionSummary extends Component<DistributionAnalysisProps> {
    render(): FrayChild {
        const selectedCount = this.read(this.props.model.blockSelection.selectedItems$).length
        return <p class="supporting-copy" role="status">
            {selectedCount === 0
                ? 'Select a block to inspect its exact record subset.'
                : `${selectedCount} records are selected in the distribution.`}
        </p>
    }
}
