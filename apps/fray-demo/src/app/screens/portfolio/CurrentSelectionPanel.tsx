import {
    Component,
    DescriptionItem,
    DescriptionList,
    Panel,
    ProgressBar,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {scopes} from '../../model/data.js'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {Scope} from '../../model/types.js'

interface CurrentSelectionPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class CurrentSelectionPanel extends Component<CurrentSelectionPanelProps> {
    render(): FrayChild {
        const selected = this.read(this.props.model.selectedChange)
        return <Panel island className="current-selection-panel" header="Current selection">
            {selected == null
                ? <p>No change is currently selected.</p>
                : <div class="selected-change-callout">
                    <p class="eyebrow">{selected.id}</p>
                    <h3>{selected.title}</h3>
                    <p>{selected.summary}</p>
                    <DescriptionList class="compact-facts" label="Selected change facts">
                        <DescriptionItem term="Risk" value={selected.risk} />
                        <DescriptionItem term="Status" value={selected.status} />
                        <DescriptionItem term="Owner" value={selected.owner} />
                        <DescriptionItem term="Site" value={scopeLabel(selected.site)} />
                    </DescriptionList>
                    <ProgressBar
                        label={`${selected.title}: ${selected.progress}% complete`}
                        value={selected.progress}
                        valueText={`${selected.progress}%`}
                    />
                    <div class="selection-supporting-grid">
                        <section aria-labelledby="selection-assets-heading">
                            <h4 id="selection-assets-heading">Affected assets</h4>
                            <ul class="asset-list">
                                {selected.affectedAssets.map((asset) =>
                                    <li key={asset}>{asset}</li>)}
                            </ul>
                        </section>
                        <section aria-labelledby="selection-dates-heading">
                            <h4 id="selection-dates-heading">Planned dates</h4>
                            <dl class="compact-facts">
                                <div><dt>Start</dt><dd>{selected.plannedStart}</dd></div>
                                <div><dt>Complete</dt><dd>{selected.plannedCompletion}</dd></div>
                            </dl>
                        </section>
                    </div>
                </div>}
        </Panel>
    }
}

function scopeLabel(scope: Scope): string {
    return scopes.find((candidate) => candidate.id === scope)?.label ?? scope
}
