import {
    Button,
    Checkbox,
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
    Toggle,
    Toolbar,
    TriCheckbox,
} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
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
        Toggle,
        Toolbar,
        TriCheckbox,
    ]
    static override css = ''

    readonly model = new MeridianModel()

    render(): FrayChild {
        return <main class="meridian-app">
            <AppHeader key="masthead" />
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
