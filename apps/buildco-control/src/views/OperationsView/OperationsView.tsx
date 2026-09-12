import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, DataTable, Panel, PanelToolbar, Sidebar, SidebarToolbar,
    SplitPrimary, SplitSecondary, SplitView,
    TabPanel, Toggle, Checkbox, OptionsPanel, OptionGroup, GroupPanel,
    Dropdown, Textbox, Button, Placeholder,
} from "@sylwellsoftware/fray";
import type {TableColumn, TableRow} from "@sylwellsoftware/fray";
import type {Row} from "../../api/ScenarioApi.ts";
import {screens} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";

interface OperationsRow extends TableRow {
    id: string;
    name: string;
    date: string;
    cost: number;
    quantity?: number;
    overtime?: number;
    reason?: string;
    status?: string;
}

const labourColumns: TableColumn<OperationsRow>[] = [
    {field: "name", label: "Person", sortable: true},
    {field: "date", label: "Date", sortable: true},
    {field: "cost", label: "Cost", sortable: true},
    {field: "overtime", label: "Overtime", sortable: true},
    {field: "reason", label: "Reason", sortable: true},
];

const materialColumns: TableColumn<OperationsRow>[] = [
    {field: "name", label: "Material", sortable: true},
    {field: "date", label: "Date", sortable: true},
    {field: "quantity", label: "Quantity", sortable: true},
    {field: "cost", label: "Cost", sortable: true},
];

const progressColumns: TableColumn<OperationsRow>[] = [
    {field: "name", label: "Phase", sortable: true},
    {field: "date", label: "Date", sortable: true},
    {field: "status", label: "Status", sortable: true},
    {field: "cost", label: "Cost", sortable: true},
];

export class OperationsView extends Component {
    static dependencies = [
        DataTable, Panel, PanelToolbar, Sidebar, SidebarToolbar, SplitView,
        TabPanel, Toggle, Checkbox, OptionsPanel, OptionGroup, GroupPanel,
        Dropdown, Textbox, Button, Placeholder,
    ];

    private state = screens.operations;
    private query = buildco.view("operations", {params: this.state.params, revision}, {owner: this});

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Operations"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Operations"><Placeholder/></Panel>;
        if (view.fetchState === "error" || !view.value) return <Panel island header="Operations"><Placeholder/></Panel>;

        const v = view.value;
        const rows = v.rows as readonly OperationsRow[];
        const tab = this.state.tab.get() ?? "labour";

        const columns = tab === "materials" ? materialColumns : tab === "progress" ? progressColumns : labourColumns;

        return <SplitView className="operations-view fray-size-flexible" primarySize="16rem" primaryLabel="Operations filters" secondaryLabel="Operations register">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Operations Register">
                    <SidebarToolbar>
                        <Textbox
                            label="Search"
                            placeholder="Filter records…"
                            valueEmitter={this.state.field("search") as any}
                        />
                        <Button
                            label="Reset"
                            onClick={() => {
                                this.state.field("search").set("");
                                this.state.field("overtime").set("neutral" as any);
                                this.state.field("material").set("");
                                this.state.field("availability").set("");
                            }}
                        />
                    </SidebarToolbar>
                    <OptionsPanel header="Filters">
                        <GroupPanel header="Scope">
                            <Dropdown
                                label="Project"
                                options={[{value: "", label: "All projects"}]}
                                valueEmitter={this.state.field("project") as any}
                            />
                            <Dropdown
                                label="Scope"
                                options={[{value: "", label: "All scopes"}]}
                                valueEmitter={this.state.field("scope") as any}
                            />
                        </GroupPanel>
                        <GroupPanel header="Register-specific filters">
                            {tab === "labour" && <>
                                <Checkbox label="Overtime only" valueEmitter={this.state.field("overtime") as any}/>
                                <Checkbox label="Include standby" valueEmitter={this.state.field("availability") as any}/>
                                <Checkbox label="Issue-attributed only" valueEmitter={this.state.field("reason") as any}/>
                            </>}
                            {tab === "materials" && <>
                                <Checkbox label="Waste only" valueEmitter={this.state.field("material") as any}/>
                                <Checkbox label="Issue-attributed only" valueEmitter={this.state.field("reason") as any}/>
                            </>}
                            {tab === "progress" && <>
                                <Checkbox label="Blocked reports only" valueEmitter={this.state.field("conditions") as any}/>
                                <Checkbox label="Forecast slip" valueEmitter={this.state.field("lifecycle") as any}/>
                            </>}
                        </GroupPanel>
                        <Toggle
                            label="Compact rows"
                            ariaLabel="Compact presentation"
                            options={[
                                ["false", "Normal"],
                                ["true", "Compact"],
                            ]}
                            valueEmitter={this.state.field("view") as any}
                        />
                    </OptionsPanel>
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Operational Records">
                    <PanelToolbar>
                        <span className="result-count">{rows.length} records</span>
                        <Button
                            label="Previous"
                            onClick={() => this.state.field("page").set(String(Math.max(0, Number(this.state.field("page").get()) - 1)))}
                        />
                        <span className="page-info">Page {Number(this.state.field("page").get()) + 1}</span>
                        <Button
                            label="Next"
                            onClick={() => this.state.field("page").set(String(Number(this.state.field("page").get()) + 1))}
                        />
                    </PanelToolbar>
                    <TabPanel
                        label="Register tabs"
                        valueEmitter={this.state.tab}
                        mountPolicy="active-only"
                        tabs={[
                            {id: "labour", label: "Labour"},
                            {id: "materials", label: "Materials"},
                            {id: "progress", label: "Progress"},
                        ]}
                    >
                        {rows.length === 0
                            ? <Placeholder/>
                            : <DataTable
                                caption={`Operations ${tab}`}
                                columns={columns}
                                data={rows}
                                rowKey="id"
                                selectedItemEmitter={this.state.selection as any}
                            />
                        }
                    </TabPanel>
                </Panel>
            </SplitSecondary>
        </SplitView>;
    }
}
