import {
    Button,
    Component,
    DescriptionItem,
    DescriptionList,
    Panel,
    ProgressBar,
    Toolbar,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {scopes} from '../../model/data.js'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {Change, Scope} from '../../model/types.js'

interface ChangeSummaryPanelProps extends ComponentProps {
    readonly model: MeridianModel
    readonly change: Change
}

export class ChangeSummaryPanel extends Component<ChangeSummaryPanelProps> {
    render(): FrayChild {
        const {model, change} = this.props
        const scoped = this.read(model.scopedChanges)
        const completed = scoped.filter(({statusFocus}) => statusFocus === 'completed').length
        return <Panel
            island
            className="change-summary-panel"
            header="Change summary"
            toolbar={<Toolbar label="Change actions">
                <Button label="Edit change" disabled />
                <Button label="Advance change" disabled />
                <Button label="More change actions" disabled />
            </Toolbar>}
        >
            <div class="change-summary-heading">
                <p class="eyebrow">{change.id}</p>
                <h3>{change.title}</h3>
                <p>{change.summary}</p>
            </div>
            <div class="change-summary-content">
                <DescriptionList class="change-facts" label="Change facts">
                    <DescriptionItem term="Risk" value={change.risk} />
                    <DescriptionItem term="Status" value={change.status} />
                    <DescriptionItem term="Site" value={scopeLabel(change.site)} />
                    <DescriptionItem term="Owner" value={change.owner} />
                    <DescriptionItem term="Type" value={change.type} />
                    <DescriptionItem
                        term="Supplier"
                        value={change.supplierInvolvement ? 'Involved' : 'Internal'}
                    />
                </DescriptionList>
                <div class="change-progress-summary">
                    <ProgressBar
                        label={`${change.title}: ${change.progress}% complete`}
                        value={change.progress}
                        valueText={`${change.progress}%`}
                    />
                    <p>{completed} of {scoped.length} scoped changes completed.</p>
                </div>
            </div>
        </Panel>
    }
}

function scopeLabel(scope: Scope): string {
    return scopes.find((candidate) => candidate.id === scope)?.label ?? scope
}
