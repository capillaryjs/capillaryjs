import {
    Component,
    DescriptionItem,
    DescriptionList,
    Panel,
    ProgressBar,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {FeaturePlaceholder, ScreenHeading} from '../../components/shared.js'
import {scopes} from '../../model/data.js'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {Scope} from '../../model/types.js'

interface ChangeScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

export class ChangeScreen extends Component<ChangeScreenProps> {
    render(): FrayChild {
        const {model} = this.props
        const selected = this.read(model.selectedChange)
        return <div class="work-area change-area">
            <ScreenHeading
                eyebrow="Change"
                title={selected == null ? 'Change details' : `${selected.id} · ${selected.title}`}
                summary="One selected change, its impact, planning, assets, and approvals."
            />
            {selected == null
                ? <Panel island header="Selected change">
                    <p>Select a change in Portfolio or Register to continue.</p>
                </Panel>
                : <div class="change-layout">
                    <Panel island header="Change summary">
                        <DescriptionList class="change-facts" label="Change facts">
                            <DescriptionItem term="Risk" value={selected.risk} />
                            <DescriptionItem term="Status" value={selected.status} />
                            <DescriptionItem term="Site" value={scopeLabel(selected.site)} />
                            <DescriptionItem term="Owner" value={selected.owner} />
                            <DescriptionItem term="Type" value={selected.type} />
                            <DescriptionItem
                                term="Supplier"
                                value={selected.supplierInvolvement ? 'Involved' : 'Internal'}
                            />
                        </DescriptionList>
                        <p>{selected.summary}</p>
                        <ProgressBar
                            label={`${selected.title}: ${selected.progress}% complete`}
                            value={selected.progress}
                            valueText={`${selected.progress}%`}
                        />
                    </Panel>
                    <Panel island header="Planning and assessment">
                        <dl class="compact-facts">
                            <div><dt>Start</dt><dd>{selected.plannedStart}</dd></div>
                            <div><dt>Complete</dt><dd>{selected.plannedCompletion}</dd></div>
                            <div>
                                <dt>Safety impact</dt>
                                <dd>{selected.safetyImpact ? 'Yes' : 'No'}</dd>
                            </div>
                        </dl>
                        <FeaturePlaceholder
                            compact={true}
                            feature="DateTimePicker"
                            purpose="Editable planning dates will appear here in a future slice."
                        />
                        <FeaturePlaceholder
                            compact={true}
                            feature="Accordion"
                            purpose="The structured impact assessment will expand here."
                        />
                    </Panel>
                    <Panel island header="Affected assets">
                        <ul class="asset-list">
                            {selected.affectedAssets.map((asset) =>
                                <li key={asset}>{asset}</li>)}
                        </ul>
                    </Panel>
                    <Panel island header="Approvals and history">
                        <p class="future-content">
                            Approvals and change history will be composed here in a later
                            application slice.
                        </p>
                    </Panel>
                </div>}
        </div>
    }
}

function scopeLabel(scope: Scope): string {
    return scopes.find((candidate) => candidate.id === scope)?.label ?? scope
}
