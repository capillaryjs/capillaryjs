import {Component, Panel} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import {AffectedAssetsPanel} from './AffectedAssetsPanel.js'
import {ApprovalsHistoryPanel} from './ApprovalsHistoryPanel.js'
import {ChangeSummaryPanel} from './ChangeSummaryPanel.js'
import {PlanningAssessmentPanel} from './PlanningAssessmentPanel.js'

interface ChangeScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

export class ChangeScreen extends Component<ChangeScreenProps> {
    render(): FrayChild {
        const {model} = this.props
        const selected = this.read(model.selectedChange)
        return <div class="work-area change-area">
            {selected == null
                ? <Panel island header="Change summary">
                    <p>Select a change in Portfolio or Register to continue.</p>
                </Panel>
                : <>
                    <ChangeSummaryPanel key="summary" model={model} change={selected} />
                    <div class="change-workspace-grid">
                        <AffectedAssetsPanel key="assets" model={model} change={selected} />
                        <PlanningAssessmentPanel key="planning" change={selected} />
                        <ApprovalsHistoryPanel key="approvals" changeId={selected.id} />
                    </div>
                </>}
        </div>
    }
}
