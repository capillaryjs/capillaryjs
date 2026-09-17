import {Component} from '@capillaryjs/capillary-ui'
import {BlockGraph} from '@capillaryjs/capillary-viz'
import type {ComponentProps, CapillaryUiChild, TableColumn} from '@capillaryjs/capillary-ui'
import {
    Button,
    DataTable,
    Layout,
    ListView,
    Panel,
    PanelToolbar,
    Sidebar,
    Toolbar,
    TreeView,
} from '@capillaryjs/capillary-ui'

import {galleryData} from '../model/GalleryModel.js'
import type {GalleryDataItem, GalleryModel} from '../model/GalleryModel.js'

export interface DataComponentsPageProps extends ComponentProps {
    model: GalleryModel
}

const columns: readonly TableColumn<GalleryDataItem>[] = [
    {
        field: 'name',
        label: 'Component',
        sortable: true,
        filterOptions: galleryData.map(({name}) => name),
    },
    {
        field: 'team',
        label: 'Owner',
        sortable: true,
        filterOptions: ['Platform', 'Capillary UI'],
    },
    {
        field: 'status',
        label: 'Status',
        sortable: true,
        filterOptions: ['Stable', 'Review', 'Active'],
    },
]

/** Data-state gallery for skeleton refresh, empty, error, and retry presentation. */
export class DataComponentsPage extends Component<DataComponentsPageProps> {
    render(): CapillaryUiChild {
        const model = this.props.model
        const snapshot = this.snapshot(model.dataItems)
        return <Layout horizontal allocation="flexible" className="gallery-page">
            <Sidebar island header="Data states" className="gallery-sidebar">
                <nav class="gallery-section-nav" aria-label="Data component sections">
                    <Button label="Table" onClick={() => scrollToSection('gallery-table')} />
                    <Button label="List and tree"
                        onClick={() => scrollToSection('gallery-collections')} />
                    <Button label="Block graph" onClick={() => scrollToSection('gallery-blockgraph')} />
                    <Button label="Empty" onClick={() => scrollToSection('gallery-empty')} />
                </nav>
                <p class="gallery-data-state" role="status">
                    Data state: {snapshot.fetchState}
                    {snapshot.error == null ? '' : ` — ${String(snapshot.error)}`}
                </p>
                <p class="gallery-data-guidance">
                    Initial loading and replacement loading show placeholders. Refresh loading keeps
                    table, list, and tree rows visible while marking them busy. Error shows an alert
                    while retaining available rows.
                    The table and list support multi-selection: Ctrl or Cmd toggles one row;
                    Shift applies the anchor row's selected state to its inclusive range. The table
                    offers retry.
                </p>
            </Sidebar>
            <Layout vertical allocation="flexible" scroll className="gallery-main">
                <Panel island header="DataTable" id="gallery-table" context="form">
                    <PanelToolbar>
                        <Toolbar label="Table actions">
                            <Button label="Reset table view" onClick={() => model.resetTableState()} />
                        </Toolbar>
                    </PanelToolbar>
                    <DataTable<GalleryDataItem>
                        dataSource={model.tableDataSource}
                        columns={columns}
                        rowKey="id"
                        multiSelect
                        placeholderCount={5}
                    />
                </Panel>
                <Panel island header="ListView and TreeView" id="gallery-collections"
                    context="form">
                    <Layout horizontal className="gallery-data-grid">
                        <ListView
                            items={model.dataItems}
                            itemKey="id"
                            label="Framework component list (multiple selection)"
                            multiSelect
                            placeholderCount={5}
                            renderItem={(item) => `${item.name} — ${item.status}`}
                        />
                        <TreeView
                            nodes={model.dataItems}
                            label="Framework component tree"
                            placeholderCount={5}
                        />
                    </Layout>
                </Panel>
                <Panel island header="BlockGraph" id="gallery-blockgraph" context="form">
                    <BlockGraph model={model.blockSelection} label="Framework component blocks" />
                </Panel>
                <Panel island header="Ready but empty" id="gallery-empty" context="form">
                    <Layout horizontal className="gallery-data-grid">
                        <DataTable<GalleryDataItem>
                            caption="Empty table"
                            data={[]}
                            columns={columns}
                            emptyMessage="No components"
                        />
                        <ListView items={[]} label="Empty list" />
                        <TreeView nodes={[]} label="Empty tree" />
                    </Layout>
                </Panel>
            </Layout>
        </Layout>
    }

    static dependencies = [
        Layout,
        Sidebar,
        Panel,
        PanelToolbar,
        Button,
        Toolbar,
        DataTable,
        ListView,
        TreeView,
        BlockGraph,
    ]
}

function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({block: 'start'})
}
