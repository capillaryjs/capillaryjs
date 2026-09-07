import {Component, Panel} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {FeaturePlaceholder} from '../../components/shared.js'
import type {Change} from '../../model/types.js'

interface PlanningAssessmentPanelProps extends ComponentProps {
    readonly change: Change
}

export class PlanningAssessmentPanel extends Component<PlanningAssessmentPanelProps> {
    render(): FrayChild {
        const {change} = this.props
        return <Panel island className="planning-assessment-panel" header="Planning and assessment">
            <dl class="compact-facts">
                <div><dt>Planned start</dt><dd>{change.plannedStart}</dd></div>
                <div><dt>Planned completion</dt><dd>{change.plannedCompletion}</dd></div>
                <div><dt>Safety impact</dt><dd>{change.safetyImpact ? 'Yes' : 'No'}</dd></div>
            </dl>
            <FeaturePlaceholder
                compact
                feature="DateTimePicker"
                purpose="Detailed scheduling will appear here after that component is approved."
            />
            <FeaturePlaceholder
                compact
                feature="Accordion"
                purpose="The structured impact assessment will expand here."
            />
        </Panel>
    }
}
