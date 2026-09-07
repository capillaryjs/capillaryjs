import {
    Component,
    DescriptionItem,
    DescriptionList,
    Panel,
    ProgressBar,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface SelectedChangePanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class SelectedChangePanel extends Component<SelectedChangePanelProps> {
    render(): FrayChild {
        const selected = this.read(this.props.model.selectedChange)
        return <Panel island className="register-selection-panel" header="Selected change">
            {selected == null ? <p>No change selected.</p> : <div class="selected-change-callout">
                <p class="eyebrow">{selected.id}</p>
                <h3>{selected.title}</h3>
                <p>{selected.summary}</p>
                <DescriptionList class="compact-facts" label="Selected Register change facts">
                    <DescriptionItem term="Risk" value={selected.risk} />
                    <DescriptionItem term="Status" value={selected.status} />
                    <DescriptionItem term="Owner" value={selected.owner} />
                    <DescriptionItem term="Site" value={selected.site} />
                    <DescriptionItem term="Type" value={selected.type} />
                </DescriptionList>
                <ProgressBar
                    label={`${selected.title}: ${selected.progress}% complete`}
                    value={selected.progress}
                    valueText={`${selected.progress}%`}
                />
            </div>}
        </Panel>
    }
}
