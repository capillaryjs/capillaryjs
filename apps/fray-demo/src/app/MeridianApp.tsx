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
} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
import {
    BlockGraph,
    CategoryHidePanel,
    LineGraph,
    SplitSelectionPanel,
} from '@sylwellsoftware/fray-visualization'
import {AppHeader} from './components/AppHeader.js'
import {DemoHarness} from './components/DemoHarness.js'
import {ScopeSidebar} from './components/ScopeSidebar.js'
import {WorkArea} from './components/WorkArea.js'
import {MeridianModel} from './model/MeridianModel.js'

export class MeridianApp extends Component {
    static override dependencies = [
        AppHeader,
        ScopeSidebar,
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

    render(): FrayChild {
        return <main class="meridian-app fray-fill-horizontal fray-fill-vertical">
            <AppHeader key="masthead" model={this.model} />
            <div class="meridian-shell">
                <ScopeSidebar key="scope" model={this.model} />
                <WorkArea key="work-area" model={this.model} />
            </div>
            <DemoHarness key="harness" model={this.model} />
        </main>
    }

    onDestroy(): void {
        this.model.dispose()
    }
}
