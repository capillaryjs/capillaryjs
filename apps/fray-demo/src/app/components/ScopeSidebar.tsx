import {
    Button,
    Component,
    Dialog,
    Sidebar,
    Toggle,
    Toolbar,
    TreeItem,
    TreeView,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../model/MeridianModel.js'
import type {Scope, ScopeTreeKey} from '../model/types.js'

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
            island
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
                <TreeView<Scope>
                    className="scope-tree"
                    label="Organisational scope"
                    selectedKeyEmitter={model.selectedScopeKey}
                    expandedKeysEmitter={model.expandedScopeKeys}
                    onSelect={(node) => model.selectScopeNode(
                        node.id as ScopeTreeKey,
                        node.value ?? 'all',
                    )}
                >
                    <TreeItem id="all" label="Company" textValue="Company" value="all">
                        <TreeItem
                            id="north-plant"
                            label="North Plant"
                            textValue="North Plant"
                            value="north-plant"
                        >
                            <TreeItem
                                id="assembly"
                                label="Assembly"
                                textValue="Assembly"
                                value="north-plant"
                            />
                            <TreeItem
                                id="packaging"
                                label="Packaging"
                                textValue="Packaging"
                                value="north-plant"
                            />
                            <TreeItem
                                id="warehouse"
                                label="Warehouse"
                                textValue="Warehouse"
                                value="warehouse"
                            />
                        </TreeItem>
                        <TreeItem
                            id="south-plant"
                            label="South Plant"
                            textValue="South Plant"
                            value="south-plant"
                        />
                    </TreeItem>
                </TreeView>
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
