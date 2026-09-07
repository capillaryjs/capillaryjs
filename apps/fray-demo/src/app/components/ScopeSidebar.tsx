import {
    Button,
    Component,
    Dialog,
    Sidebar,
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

const scopeColorTriplets = {
    all: ['#294a63', '#527a96', '#91b8ce'],
    'north-plant': ['#006076', '#078da8', '#69c6d8'],
    warehouse: ['#68421c', '#a76f32', '#deb079'],
    'south-plant': ['#493371', '#7958aa', '#b398d7'],
} as const satisfies Record<Scope, readonly [string, string, string]>

function scopeColorStyle(scope: Scope): Record<string, string> {
    const [c1, c2, c3] = scopeColorTriplets[scope]
    return {'--c1': c1, '--c2': c2, '--c3': c3}
}

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
                <TreeView<Scope>
                    className="scope-tree"
                    label="Organisational scope"
                    selectedKeyEmitter={model.selectedScopeKey}
                    expandedKeysEmitter={model.expandedScopeKeys}
                    itemLabelClassName={() => 'colored'}
                    itemLabelStyle={(node) => scopeColorStyle(node.value ?? 'all')}
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
