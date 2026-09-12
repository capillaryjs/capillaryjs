import {Component} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
import {
    Button,
    Layout,
    OptionsPanel,
    Panel,
    PanelToolbar,
    Sidebar,
    SplitPrimary,
    SplitSecondary,
    SplitView,
    Toolbar,
} from '@sylwellsoftware/fray'
import {
    BlockGraph,
    CategoryHidePanel,
    CollapsibleOptionGroup,
    LineGraph,
    SplitSelectionPanel,
} from '@sylwellsoftware/fray-visualization'

import type {GalleryModel} from '../model/GalleryModel.js'
import type {GalleryPageProps} from './DataGridPage.js'

/** Accordion sidebar of visualization controls with a split chart data area. */
export class AnalyticsPage extends Component<GalleryPageProps> {
    render(): FrayChild {
        const model = this.props.model
        const selectedCount = this.read(model.blockSelection.selectedItems$).length
        const selectedPath = this.read(model.blockSelection.selectedPath$)
        const totalCount = this.read(model.visibleServices).length
        return <Layout horizontal allocation="flexible" className="gallery-page">
            <Sidebar island header="Analytics" className="gallery-sidebar">
                <OptionsPanel header="Grouping">
                    <CollapsibleOptionGroup label="Visible categories">
                        <CategoryHidePanel
                            items$={model.serviceCatalog}
                            criteria={model.groupingCriteria}
                            label="Visible categories"
                            description="Hide categories from the charts."
                        />
                    </CollapsibleOptionGroup>
                    <CollapsibleOptionGroup label="Grouping" collapsed>
                        <SplitSelectionPanel
                            model={model.splitSelection}
                            label="Grouping"
                            description="Choose the block-graph grouping order."
                        />
                    </CollapsibleOptionGroup>
                    <CollapsibleOptionGroup label="Presentation" collapsed>
                        <label>
                            <input type="checkbox" bind:checked={model.analyticsStacked} />
                            Stacked history
                        </label>
                        <label>
                            <input type="checkbox" bind:checked={model.analyticsSmooth} />
                            Smooth curves
                        </label>
                    </CollapsibleOptionGroup>
                </OptionsPanel>
            </Sidebar>
            <Layout vertical allocation="flexible" className="gallery-main">
                <Panel island header="Distribution selection" scroll={false}>
                    <PanelToolbar>
                        <Toolbar label="Selection actions">
                            <Button
                                label="Clear selection"
                                disabled={selectedPath == null}
                                onClick={() =>
                                    model.blockSelection.clear('distribution selection cleared')}
                            />
                        </Toolbar>
                    </PanelToolbar>
                    <p class="gallery-note" role="status">
                        {selectedPath == null
                            ? `Selected: all ${totalCount} services`
                            : `Selected: ${selectedCount} of ${totalCount} services`}
                    </p>
                </Panel>
                <SplitView horizontal allocation="flexible" primarySize="45%">
                    <SplitPrimary label="Distribution">
                        <Panel island header="Service distribution" allocation="flexible">
                            <BlockGraph
                                model={model.blockSelection}
                                label="Service distribution"
                                description="Services grouped by the active split criteria."
                            />
                        </Panel>
                    </SplitPrimary>
                    <SplitSecondary label="History">
                        <Panel island header="Incident history" allocation="flexible">
                            <LineGraph
                                label="Incident load by status"
                                shapes$={model.analyticsShapes}
                                stacked$={model.analyticsStacked}
                                smooth$={model.analyticsSmooth}
                                range$={model.analyticsRange}
                            />
                        </Panel>
                    </SplitSecondary>
                </SplitView>
            </Layout>
        </Layout>
    }

    static dependencies = [
        Layout,
        Sidebar,
        OptionsPanel,
        CollapsibleOptionGroup,
        CategoryHidePanel,
        SplitSelectionPanel,
        Panel,
        PanelToolbar,
        Toolbar,
        Button,
        SplitView,
        SplitPrimary,
        SplitSecondary,
        BlockGraph,
        LineGraph,
    ]
}
