import {Component, Panel} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {FeaturePlaceholder, ScreenHeading} from '../../components/shared.js'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface AnalysisScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

export class AnalysisScreen extends Component<AnalysisScreenProps> {
    render(): FrayChild {
        const visibleCount = this.read(this.props.model.visibleChanges).length
        return <div class="work-area analysis-area">
            <ScreenHeading
                eyebrow="Analysis"
                title="Portfolio analysis"
                summary={`${visibleCount} visible changes will feed every analytical view.`}
            />
            <div class="analysis-layout">
                <Panel header="Grouping and visibility">
                    <FeaturePlaceholder
                        feature="CategoryHidePanel"
                        purpose="Risk and status category visibility will be controlled here."
                    />
                    <FeaturePlaceholder
                        feature="SplitSelectionPanel"
                        purpose="Grouping presets and split order will be configured here."
                    />
                </Panel>
                <Panel header="Portfolio distribution">
                    <FeaturePlaceholder
                        feature="BlockGraph"
                        purpose="Site → risk → status partitions will fill this workspace."
                    />
                </Panel>
                <Panel className="history-panel" header="Change history">
                    <FeaturePlaceholder
                        feature="LineGraph"
                        purpose="Open, completed, and high-risk changes over time will appear here."
                    />
                </Panel>
            </div>
        </div>
    }
}
