import {
    Button,
    Component,
    Dialog,
    RadioGroup,
    Sidebar,
    Toggle,
    Toolbar,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {scopes} from '../model/data.js'
import type {MeridianModel} from '../model/MeridianModel.js'
import {FeaturePlaceholder} from './shared.js'

interface ScopeSidebarProps extends ComponentProps {
    readonly model: MeridianModel
}

const statusOptions = [
    ['all', 'All'],
    ['planned', 'Planned'],
    ['active', 'Active'],
    ['completed', 'Completed'],
] as const

export class ScopeSidebar extends Component<ScopeSidebarProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Sidebar
            className="meridian-scope"
            header="Scope"
            toolbar={<Toolbar label="Scope actions">
                <Button
                    label="Clear scope"
                    disabled={live(model.forceDisabled)}
                    onClick={() => model.clearScopeDialogOpen.set(
                        true,
                        'scope clear requested',
                    )}
                />
            </Toolbar>}
        >
            <div class="scope-content">
                <p>Scope changes every work area; table sort remains local to Register.</p>
                <FeaturePlaceholder
                    compact={true}
                    feature="TreeView + TreeItem"
                    purpose="The organisation, sites, areas, and assets will be navigable here."
                />
                <RadioGroup
                    label="Temporary site scope"
                    valueEmitter={model.selectedScope}
                    options={scopes.map(({id, label}) => [id, label] as const)}
                    disabled={live(model.forceDisabled)}
                    required={live(model.forceRequired)}
                    onChange={(scope) => model.note(`Scope → ${scope}`)}
                />
                <Toggle
                    label="Status focus"
                    valueEmitter={model.statusFocus}
                    options={statusOptions}
                    disabled={live(model.forceDisabled)}
                    required={live(model.forceRequired)}
                    error={live(model.statusFocusError)}
                    onChange={(status) => model.note(`Status focus → ${status}`)}
                />
            </div>
            <Dialog
                title="Clear scope filters?"
                description="This resets site and status focus in every work area."
                valueEmitter={model.clearScopeDialogOpen}
                actions={<Button
                    label="Clear filters"
                    onClick={() => model.clearScopeFilters()}
                />}
            />
        </Sidebar>
    }
}
