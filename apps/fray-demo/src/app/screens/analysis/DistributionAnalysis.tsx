import {Button, Component, Panel, Toolbar} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {BlockGraph} from '@sylwellsoftware/fray-visualization'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface DistributionAnalysisProps extends ComponentProps {
    readonly model: MeridianModel
}

export class DistributionAnalysis extends Component<DistributionAnalysisProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel
            island
            className="distribution-panel"
            header="Portfolio distribution"
            toolbar={<BlockSelectionToolbar key="block-selection-toolbar" model={model} />}
        >
            <BlockGraph
                model={model.blockSelection}
                label="Visible change distribution"
                description="Area represents records after shared and category filters."
            />
        </Panel>
    }
}

class BlockSelectionToolbar extends Component<DistributionAnalysisProps> {
    render(): FrayChild {
        const {model} = this.props
        const selectedCount = this.read(model.blockSelection.selectedItems$).length
        const selectedPath = this.read(model.blockSelection.selectedPath$)
        return <Toolbar label="Distribution selection">
            <p class="supporting-copy" role="status">
                {selectedCount === 0
                    ? `Selected: all ${model.visualizationChanges.get().length} analytical changes`
                    : `Selected: ${selectedCount} changes`}
            </p>
            <Button
                label="Clear selection"
                disabled={selectedPath == null}
                onClick={() => model.blockSelection.clear('distribution selection cleared')}
            />
        </Toolbar>
    }
}
