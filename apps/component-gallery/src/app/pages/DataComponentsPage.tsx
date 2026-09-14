import {Component} from '@capillaryjs/capillary-ui'
import {BlockGraph} from '@capillaryjs/capillary-viz'
import type {ComponentProps, CapillaryUiChild, TableColumn} from '@capillaryjs/capillary-ui'
import {
    Button,
    DataTable,
    Layout,
    ListView,
    Panel,
    Sidebar,
    TreeView,
} from '@capillaryjs/capillary-ui'

import type {GalleryDataItem, GalleryModel} from '../model/GalleryModel.js'

export interface DataComponentsPageProps extends ComponentProps {
    model: GalleryModel
}

const columns: readonly TableColumn<GalleryDataItem>[] = [
    {field: 'name', label: 'Component', sortable: true},
    {field: 'team', label: 'Owner', filterOptions: ['Platform', 'Capillary UI']},
    {field: 'status', label: 'Status'},
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
                    Initial and Loading replace data with placeholders, including during refresh.
                    Error shows an alert; tables, lists, and trees retain stale rows.
                    The table offers retry.
                </p>
            </Sidebar>
            <Layout vertical allocation="flexible" scroll className="gallery-main">
                <Panel island header="DataTable" id="gallery-table" context="form">
                    <DataTable<GalleryDataItem>
                        caption="Framework components"
                        dataSource={model.tableDataSource}
                        columns={columns}
                        rowKey="id"
                        placeholderCount={5}
                    />
                </Panel>
                <Panel island header="ListView and TreeView" id="gallery-collections"
                    context="form">
                    <Layout horizontal className="gallery-data-grid">
                        <ListView
                            items={model.dataItems}
                            itemKey="id"
                            label="Framework component list"
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
        Button,
        DataTable,
        ListView,
        TreeView,
        BlockGraph,
    ]
}

function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({block: 'start'})
}
