import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import {ChangeHistory} from './ChangeHistory.js'
import {DistributionAnalysis} from './DistributionAnalysis.js'
import {GroupingPanel} from './GroupingPanel.js'
import {VisibleCategoriesPanel} from './VisibleCategoriesPanel.js'

interface AnalysisScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

export class AnalysisScreen extends Component<AnalysisScreenProps> {
    render(): FrayChild {
        return <div class="work-area analysis-area">
            <div class="analysis-grid">
                <div class="analysis-control-column">
                    <VisibleCategoriesPanel key="visibility" model={this.props.model} />
                    <GroupingPanel key="grouping" model={this.props.model} />
                </div>
                <div class="analysis-chart-column">
                    <DistributionAnalysis key="distribution" model={this.props.model} />
                    <ChangeHistory key="history" model={this.props.model} />
                </div>
            </div>
        </div>
    }
}
