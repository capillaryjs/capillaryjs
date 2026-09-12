import {Component} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
import {
    Button,
    DataTable,
    DescriptionItem,
    DescriptionList,
    Dialog,
    DialogActions,
    Layout,
    ListView,
    Panel,
    PanelToolbar,
    Sidebar,
    Toolbar,
} from '@sylwellsoftware/fray'

import {services} from '../model/data.js'
import type {GalleryModel} from '../model/GalleryModel.js'
import type {ServiceRecord} from '../model/types.js'
import type {GalleryPageProps} from './DataGridPage.js'
import {serviceColumns} from './serviceColumns.js'

/** ListView-driven record directory with a detail dialog and related table. */
export class DirectoryPage extends Component<GalleryPageProps> {
    render(): FrayChild {
        const model = this.props.model
        const selected = this.read(model.directorySelection)
        return <Layout horizontal allocation="flexible" className="gallery-page">
            <Sidebar island header="Services" className="gallery-sidebar">
                <ListView<ServiceRecord>
                    label="Service directory"
                    items={services}
                    itemKey="id"
                    selectedItemEmitter={model.directorySelection}
                    renderItem={(service) => `${service.id} — ${service.name}`}
                />
            </Sidebar>
            <Layout vertical allocation="flexible" className="gallery-main">
                <Panel island header="Selected service" scroll={false}>
                    <PanelToolbar>
                        <Toolbar label="Record actions">
                            <Button
                                label="Details…"
                                onClick={() =>
                                    model.directoryDialogOpen.set(true, 'details opened')}
                            />
                        </Toolbar>
                    </PanelToolbar>
                    {selected == null
                        ? <p class="gallery-note">No service selected.</p>
                        : <DescriptionList label="Service details">
                            <DescriptionItem term="Id" value={selected.id} />
                            <DescriptionItem term="Name" value={selected.name} />
                            <DescriptionItem term="Owner" value={selected.owner} />
                            <DescriptionItem term="Region" value={selected.region} />
                            <DescriptionItem term="Status" value={selected.status} />
                            <DescriptionItem term="Tier" value={selected.tier} />
                        </DescriptionList>}
                    <Dialog
                        title="Service details"
                        description="Full record for the selected service."
                        valueEmitter={model.directoryDialogOpen}
                    >
                        {selected == null
                            ? <p>No service selected.</p>
                            : <DescriptionList label="Service record">
                                <DescriptionItem term="Id" value={selected.id} />
                                <DescriptionItem term="Name" value={selected.name} />
                                <DescriptionItem term="Owner" value={selected.owner} />
                                <DescriptionItem term="Region" value={selected.region} />
                                <DescriptionItem term="Status" value={selected.status} />
                                <DescriptionItem term="Tier" value={selected.tier} />
                                <DescriptionItem term="Uptime" value={`${selected.uptime}%`} />
                                <DescriptionItem
                                    term="Incidents"
                                    value={String(selected.incidents)}
                                />
                                <DescriptionItem term="Updated" value={selected.updated} />
                                <DescriptionItem term="Resolved" value={selected.resolved} />
                            </DescriptionList>}
                        <DialogActions>
                            <Button
                                label="Close"
                                onClick={() =>
                                    model.directoryDialogOpen.set(false, 'details closed')}
                            />
                        </DialogActions>
                    </Dialog>
                </Panel>
                <Panel island header="Related services" allocation="flexible">
                    <DataTable
                        dataSource={model.directoryTable}
                        rowKey="id"
                        caption={selected == null
                            ? 'All services'
                            : `Services owned by ${selected.owner}`}
                        emptyMessage="No related services"
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
        ListView,
        DescriptionList,
        DescriptionItem,
        Dialog,
        DialogActions,
        DataTable,
    ]
}
