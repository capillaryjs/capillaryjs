import {Component, Panel, ProgressBar, live} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface PortfolioSummaryPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class PortfolioSummaryPanel extends Component<PortfolioSummaryPanelProps> {
    render(): FrayChild {
        const {model} = this.props
        const scoped = this.read(model.scopedChanges)
        const completed = scoped.filter((change) => change.statusFocus === 'completed').length
        const critical = scoped.filter((change) => change.risk === 'Critical').length
        const completionMaximum = Math.max(scoped.length, 1)
        const completionText = scoped.length === 0
            ? 'No changes in scope'
            : `${completed} of ${scoped.length} completed`

        return <Panel island header="Portfolio summary" disabled={live(model.panelDisabled)}>
            <div class="portfolio-summary-content">
                <div class="metric-row">
                    <p><strong>{scoped.length}</strong><span>Changes in scope</span></p>
                    <p><strong>{critical}</strong><span>Critical</span></p>
                    <p><strong>{completed}</strong><span>Completed</span></p>
                </div>
                <ProgressBar
                    label={`Completed changes: ${completionText}`}
                    value={completed}
                    max={completionMaximum}
                    valueText={completionText}
                />
            </div>
        </Panel>
    }
}
