import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {
    Button,
    Checkbox,
    DataTable,
    Dropdown,
    FilterPanel,
    Layout,
    Panel,
    PanelToolbar,
    Sidebar,
    Textbox,
    Toolbar,
} from '@sylwellsoftware/fray'

import {serviceOwners} from '../model/data.js'
import {gridCriterionOptions} from '../model/GalleryModel.js'
import type {GalleryModel} from '../model/GalleryModel.js'
import {serviceColumns} from './serviceColumns.js'

export interface GalleryPageProps extends ComponentProps {
    model: GalleryModel
}

/** Plain-panel sidebar filters plus a semantic FilterPanel and DataTable. */
export class DataGridPage extends Component<GalleryPageProps> {
    render(): FrayChild {
        const model = this.props.model
        return <Layout horizontal allocation="flexible" className="gallery-page">
            <Sidebar island header="Filters" className="gallery-sidebar">
                <div class="gallery-sidebar-stack">
                    <Textbox
                        label="Search"
                        type="search"
                        placeholder="Name or id"
                        valueEmitter={model.gridSearch}
                    />
                    <Dropdown
                        label="Owner"
                        valueEmitter={model.gridOwner}
                        options={[
                            {value: 'all', label: 'All owners'},
                            ...serviceOwners.map((owner) => ({value: owner, label: owner})),
                        ]}
                    />
                    <Checkbox
                        label="Attention focus"
                        valueEmitter={model.gridAttention}
                        symbols={[['☐', 'all'], ['✓', 'attention']]}
                    />
                    <label>
                        <input type="checkbox" bind:checked={model.gridReadyOnly} />
                        Ready only
                    </label>
                </div>
            </Sidebar>
            <Layout vertical allocation="flexible" className="gallery-main">
                <Panel island header="Semantic criteria" scroll={false}>
                    <PanelToolbar>
                        <Toolbar label="Grid actions">
                            <Button
                                label="Clear filters"
                                onClick={() => model.clearGridFilters()}
                            />
                        </Toolbar>
                    </PanelToolbar>
                    <FilterPanel
                        label="Service criteria"
                        options={gridCriterionOptions}
                        filters={this.read(model.gridCriteria)}
                        onChange={(filters) =>
                            model.gridCriteria.set(filters, 'criteria changed')}
                    />
                </Panel>
                <Panel island header="Service register" allocation="flexible">
                    <DataTable
                        dataSource={model.gridTable}
                        rowKey="id"
                        caption="Filtered service register"
                        emptyMessage="No services match the current filters"
                        selectedItemEmitter={model.gridSelection}
                        columns={serviceColumns}
                    />
                </Panel>
            </Layout>
        </Layout>
    }

    static dependencies = [
        Layout,
        Sidebar,
        Panel,
        PanelToolbar,
        Toolbar,
        Button,
        Textbox,
        Dropdown,
        Checkbox,
        FilterPanel,
        DataTable,
    ]
}
