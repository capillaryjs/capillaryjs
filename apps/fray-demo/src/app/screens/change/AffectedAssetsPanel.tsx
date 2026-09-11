import {Button, Component, Panel, PanelToolbar, Toolbar, live} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {Change} from '../../model/types.js'

interface AffectedAssetsPanelProps extends ComponentProps {
    readonly model: MeridianModel
    readonly change: Change
}

export class AffectedAssetsPanel extends Component<AffectedAssetsPanelProps> {
    render(): FrayChild {
        const {model, change} = this.props
        return <Panel
            island
            className="affected-assets-panel"
            header="Affected assets"
        >
            <PanelToolbar><Toolbar label="Affected asset actions">
                <Button label="Add affected asset" disabled />
                <Button label="Remove affected asset" disabled />
            </Toolbar></PanelToolbar>
            <p class="supporting-copy">
                Asset hierarchy is pending; this list preserves the current source data.
            </p>
            <ul class="asset-list" aria-label={`Assets affected by ${change.id}`}>
                {change.affectedAssets.map((asset) => <li key={asset}>{asset}</li>)}
            </ul>
            <Button
                label="Record asset review"
                disabled={live(model.forceDisabled)}
                onClick={() => model.note(`Reviewed affected assets for ${change.id}`)}
            />
        </Panel>
    }
}
