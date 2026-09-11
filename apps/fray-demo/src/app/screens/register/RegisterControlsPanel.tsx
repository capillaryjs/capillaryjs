import {
    Button,
    Checkbox,
    Component,
    Dropdown,
    Panel,
    PanelToolbar,
    Textbox,
    Toolbar,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {AttentionFilter} from '../../model/types.js'

interface RegisterControlsPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

const attentionSymbols: readonly [FrayChild, AttentionFilter][] = [
    ['☐', 'all'],
    ['✓', 'attention'],
]

export class RegisterControlsPanel extends Component<RegisterControlsPanelProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel
            island
            className="register-controls"
            header="Register controls"
        >
            <PanelToolbar><Toolbar label="Register actions">
                <Button
                    label="Reset filters"
                    disabled={live(model.forceDisabled)}
                    onClick={() => model.clearRegisterFilters()}
                />
                <Button
                    label="Select next critical"
                    disabled={live(model.forceDisabled)}
                    onClick={() => model.selectNextCritical()}
                />
                <Button
                    label="Refresh data"
                    busy={live(model.refreshing)}
                    busyLabel="Refreshing…"
                    onClick={() => model.refreshData()}
                />
            </Toolbar></PanelToolbar>
            <div class="register-filter-grid">
                <Textbox
                    label="Search changes"
                    type="search"
                    placeholder="ID, title, summary, or owner"
                    autoComplete="off"
                    inputMode="search"
                    valueEmitter={model.registerSearch}
                    disabled={live(model.forceDisabled)}
                    required={live(model.forceRequired)}
                    onInput={(value) => model.note(`Search → ${value || 'empty'}`)}
                />
                <Dropdown
                    label="Risk focus"
                    valueEmitter={model.riskFocus}
                    disabled={live(model.forceDisabled)}
                    required={live(model.forceRequired)}
                    options={[
                        {value: 'all', label: 'All risks'},
                        {value: 'Critical', label: 'Critical'},
                        {value: 'High', label: 'High'},
                        {value: 'Medium', label: 'Medium'},
                        {value: 'Low', label: 'Low'},
                    ]}
                    onChange={(risk) => model.note(`Risk focus → ${risk}`)}
                />
                <Checkbox
                    label="Needs attention only"
                    valueEmitter={model.attentionOnly}
                    symbols={attentionSymbols}
                    disabled={live(model.forceDisabled)}
                    required={live(model.forceRequired)}
                    onChange={(value) => model.note(`Attention filter → ${value}`)}
                />
            </div>
        </Panel>
    }
}
