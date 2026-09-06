import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {ScreenHeading} from '../../components/shared.js'
import type {MeridianModel} from '../../model/MeridianModel.js'
import {AnalysisControls} from './AnalysisControls.js'
import {ChangeHistory} from './ChangeHistory.js'
import {DistributionAnalysis} from './DistributionAnalysis.js'

interface AnalysisScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

export class AnalysisScreen extends Component<AnalysisScreenProps> {
    render(): FrayChild {
        const visibleCount = this.read(this.props.model.visibleChanges).length
        const analyticalCount = this.read(this.props.model.visualizationChanges).length
        return <div class="work-area analysis-area">
            <ScreenHeading
                eyebrow="Analysis"
                title="Portfolio analysis"
                summary={`${analyticalCount} of ${visibleCount} visible changes currently feed the analytical views.`}
            />
            <div class="analysis-layout">
                <AnalysisControls key="analysis-controls" model={this.props.model} />
                <DistributionAnalysis key="distribution" model={this.props.model} />
                <ChangeHistory key="history" model={this.props.model} />
            </div>
        </div>
    }
}
