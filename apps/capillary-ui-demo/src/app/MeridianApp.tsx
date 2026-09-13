import {
    Button,
    Checkbox,
    ColorPicker,
    Component,
    DataTable,
    DescriptionItem,
    DescriptionList,
    Dialog,
    Dropdown,
    FilterPanel,
    GroupBox,
    Header,
    ListView,
    Panel,
    Placeholder,
    ProgressBar,
    QuadCheckbox,
    RadioButton,
    RadioGroup,
    Sidebar,
    SplitView,
    TabLine,
    TabPanel,
    TableHeader,
    TableHeaderCell,
    Textbox,
    ThemePicker,
    Toggle,
    Toolbar,
    TreeItem,
    TreeView,
    TriCheckbox,
} from '@capillaryjs/capillary-ui'
import type {CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {
    BlockGraph,
    CategoryHidePanel,
    LineGraph,
    SplitSelectionPanel,
} from '@capillaryjs/capillary-viz'
import {AppHeader} from './components/AppHeader.js'
import {DemoHarness} from './components/DemoHarness.js'
import {NavigationRail} from './components/NavigationRail.js'
import {ScopeSidebar} from './components/ScopeSidebar.js'
import {ViewPanel} from './components/ViewPanel.js'
import {WorkArea} from './components/WorkArea.js'
import {MeridianModel} from './model/MeridianModel.js'

export class MeridianApp extends Component {
    static override dependencies = [
        AppHeader,
        NavigationRail,
        ScopeSidebar,
        ViewPanel,
        WorkArea,
        DemoHarness,
        Button,
        Checkbox,
        ColorPicker,
        DataTable,
        DescriptionItem,
        DescriptionList,
        Dialog,
        Dropdown,
        FilterPanel,
        GroupBox,
        Header,
        ListView,
        Panel,
        Placeholder,
        ProgressBar,
        QuadCheckbox,
        RadioButton,
        RadioGroup,
        Sidebar,
        SplitView,
        TabLine,
        TabPanel,
        TableHeader,
        TableHeaderCell,
        Textbox,
        ThemePicker,
        Toggle,
        Toolbar,
        TreeItem,
        TreeView,
        TriCheckbox,
        BlockGraph,
        CategoryHidePanel,
        LineGraph,
        SplitSelectionPanel,
    ]
    static override css = ''

    readonly model = new MeridianModel()

    render(): CapillaryUiChild {
        return <main class="meridian-app cap-fill-horizontal cap-fill-vertical">
            <AppHeader key="masthead" />
            <div class="meridian-shell">
                <NavigationRail key="navigation" model={this.model} />
                <WorkArea key="work-area" model={this.model} />
            </div>
            <DemoHarness key="harness" model={this.model} />
        </main>
    }

    onDestroy(): void {
        this.model.dispose()
    }
}
