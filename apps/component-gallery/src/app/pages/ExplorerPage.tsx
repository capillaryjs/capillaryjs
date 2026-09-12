import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {
    DescriptionItem,
    DescriptionList,
    Layout,
    Panel,
    Sidebar,
    TreeItem,
    TreeView,
} from '@sylwellsoftware/fray'
import {LineGraph} from '@sylwellsoftware/fray-visualization'

import {serviceOwners, services} from '../model/data.js'
import type {GalleryModel} from '../model/GalleryModel.js'
import type {GalleryPageProps} from './DataGridPage.js'

/** TreeView-driven scope explorer with a cumulative incident history chart. */
export class ExplorerPage extends Component<GalleryPageProps> {
    render(): FrayChild {
        const model = this.props.model
        return <Layout horizontal allocation="flexible" className="gallery-page">
            <Sidebar island header="Catalog" className="gallery-sidebar">
                <TreeView<string>
                    label="Service catalog"
                    selectedKeyEmitter={model.treeSelectedKey}
                    expandedKeysEmitter={model.treeExpandedKeys}
                    onSelect={(node) => model.selectExplorerScope(String(node.value))}
                >
                    <TreeItem id="all" label="All services" textValue="All services" value="all">
                        {serviceOwners.map((owner) => <TreeItem
                            key={owner}
                            id={owner}
                            label={owner}
                            textValue={owner}
                            value={owner}
                        >
                            {services
                                .filter((service) => service.owner === owner)
                                .map((service) => <TreeItem
                                    key={service.id}
                                    id={service.id}
                                    label={`${service.id} ${service.name}`}
                                    textValue={`${service.id} ${service.name}`}
                                    value={service.id}
                                />)}
                        </TreeItem>)}
                    </TreeItem>
                </TreeView>
            </Sidebar>
            <Layout vertical allocation="flexible" className="gallery-main">
                <Panel island header="Chart options" scroll={false}>
                    <div class="gallery-form-grid">
                        <label>
                            <input type="checkbox" bind:checked={model.explorerStacked} />
                            Stacked
                        </label>
                        <label>
                            <input type="checkbox" bind:checked={model.explorerSmooth} />
                            Smooth curves
                        </label>
                    </div>
                    <DescriptionList label="Selected scope">
                        <DescriptionItem term="Scope" value={this.read(model.explorerScope)} />
                        <DescriptionItem
                            term="Services"
                            value={String(this.read(model.explorerRows).length)}
                        />
                    </DescriptionList>
                </Panel>
                <Panel island header="Incident load" allocation="flexible">
                    <LineGraph
                        label="Incident load by status"
                        shapes$={model.explorerShapes}
                        stacked$={model.explorerStacked}
                        smooth$={model.explorerSmooth}
                        range$={model.explorerRange}
                    />
                </Panel>
            </Layout>
        </Layout>
    }

    static dependencies = [
        Layout,
        Sidebar,
        Panel,
        TreeView,
        TreeItem,
        DescriptionList,
        DescriptionItem,
        LineGraph,
    ]
}
