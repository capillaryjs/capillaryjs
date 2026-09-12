import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, DataTable, Panel, PanelToolbar, Sidebar, SidebarToolbar,
    SplitPrimary, SplitSecondary, SplitView,
    TabPanel, Toggle, Checkbox, OptionsPanel, OptionGroup, GroupPanel,
    Dropdown, Textbox, Button, RouteQuery, Placeholder, Toolbar, stringRouteQueryCodec,
} from "@sylwellsoftware/fray";
import type {TableColumn, TableRow} from "@sylwellsoftware/fray";
import {Emitter} from "@sylwellsoftware/glue";
import {keyQueryCodec, screens} from "../../app/routing.ts";
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
    progress?: number;
    forecast?: string;
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
    {field: "progress", label: "Progress", sortable: true},
    {field: "status", label: "Status", sortable: true},
    {field: "forecast", label: "Forecast", sortable: true},
];

const filterFields = ["search", "project", "scope", "from", "to", "overtime", "standby", "issueOnly", "waste", "blocked", "slip"];

export class OperationsView extends Component {
    static dependencies = [
        DataTable, Panel, PanelToolbar, Sidebar, SidebarToolbar, SplitView,
        TabPanel, Toggle, Checkbox, OptionsPanel, OptionGroup, GroupPanel,
        Dropdown, Textbox, Button, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.operations;
    private query = buildco.view("operations", {params: this.state.params, revision}, {owner: this});
    // Compact rows are presentation state and stay out of the query contract.
    private readonly compact = new Emitter<string>("false", {owner: this, purpose: "compact rows"});

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);
        const compact = this.read(this.compact);

        if (!b.value) return <Panel island header="Operations"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Operations"><Placeholder/></Panel>;
        if (view.fetchState === "error" && !view.value) return <Panel island header="Operations">
            <Placeholder/>
            <p className="muted">{String(view.error ?? "The operations register could not be loaded.")}</p>
            <Button label="Retry" onClick={() => void this.query.refresh()}/>
        </Panel>;
        if (!view.value) return <Panel island header="Operations"><Placeholder/></Panel>;

        const v = view.value;
        const rows = v.rows as readonly OperationsRow[];
        const tab = this.read(this.state.tab) ?? "labour";
        const scopes = (v.options?.scopes ?? []) as readonly {value: string, label: string}[];

        const table = (id: string, columns: TableColumn<OperationsRow>[]) => rows.length === 0
            ? <Placeholder/>
            : <DataTable
                caption={`Operations ${id}`}
                className={compact === "true" ? "compact-rows" : null}
                columns={columns}
                data={rows}
                rowKey="id"
                selectedItemEmitter={this.state.selection as any}
            />;

        return <>
            <RouteQuery name="tab" codec={keyQueryCodec} valueEmitter={this.state.tab} defaultValue="labour"/>
            <RouteQuery name="project" codec={stringRouteQueryCodec} valueEmitter={this.state.field("project")} defaultValue=""/>
            <RouteQuery name="scope" codec={stringRouteQueryCodec} valueEmitter={this.state.field("scope")} defaultValue=""/>
            <RouteQuery name="search" codec={stringRouteQueryCodec} valueEmitter={this.state.field("search")} defaultValue=""/>
            <RouteQuery name="page" codec={stringRouteQueryCodec} valueEmitter={this.state.field("page")} defaultValue=""/>
            <RouteQuery name="from" codec={stringRouteQueryCodec} valueEmitter={this.state.field("from")} defaultValue=""/>
            <RouteQuery name="to" codec={stringRouteQueryCodec} valueEmitter={this.state.field("to")} defaultValue=""/>
            <SplitView className="operations-view fray-size-flexible" primarySize="16rem" primaryLabel="Operations filters" secondaryLabel="Operations register">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Operations Register">
                    <SidebarToolbar>
                        <Toolbar label="Register search">
                            <Textbox
                                label="Search"
                                placeholder="Filter records…"
                                valueEmitter={this.state.field("search") as any}
                            />
                            <Button
                                label="Reset"
                                onClick={() => {
                                    for (const key of filterFields) this.state.field(key).set(key === "overtime" || key === "standby" || key === "issueOnly" || key === "waste" || key === "blocked" || key === "slip" ? "neutral" : "");
                                }}
                            />
                        </Toolbar>
                    </SidebarToolbar>
                    <OptionsPanel header="Filters">
                        <GroupPanel header="Scope">
                            <Dropdown
                                label="Project"
                                options={[{value: "", label: "All projects"}, ...(b.value.choices.projects ?? [])]}
                                valueEmitter={this.state.field("project") as any}
                            />
                            <Dropdown
                                label="Scope"
                                options={[{value: "", label: "All scopes"}, ...scopes]}
                                valueEmitter={this.state.field("scope") as any}
                            />
                        </GroupPanel>
                        <GroupPanel header="Dates">
                            <Textbox label="From" type="date" valueEmitter={this.state.field("from") as any}/>
                            <Textbox label="To" type="date" valueEmitter={this.state.field("to") as any}/>
                        </GroupPanel>
                        <GroupPanel header="Register-specific filters">
                            {tab === "labour" && <>
                                <Checkbox label="Overtime only" valueEmitter={this.state.field("overtime") as any}/>
                                <Checkbox label="Include standby" valueEmitter={this.state.field("standby") as any}/>
                                <Checkbox label="Issue-attributed only" valueEmitter={this.state.field("issueOnly") as any}/>
                            </>}
                            {tab === "materials" && <>
                                <Checkbox label="Waste only" valueEmitter={this.state.field("waste") as any}/>
                                <Checkbox label="Issue-attributed only" valueEmitter={this.state.field("issueOnly") as any}/>
                            </>}
                            {tab === "progress" && <>
                                <Checkbox label="Blocked reports only" valueEmitter={this.state.field("blocked") as any}/>
                                <Checkbox label="Forecast slip" valueEmitter={this.state.field("slip") as any}/>
                            </>}
                        </GroupPanel>
                        <Toggle
                            label="Compact rows"
                            ariaLabel="Compact presentation"
                            options={[
                                ["false", "Normal"],
                                ["true", "Compact"],
                            ]}
                            valueEmitter={this.compact}
                        />
                    </OptionsPanel>
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Operational Records">
                    <PanelToolbar>
                        <Toolbar label="Register paging">
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
                        </Toolbar>
                    </PanelToolbar>
                    <TabPanel
                        label="Register tabs"
                        valueEmitter={this.state.tab}
                        mountPolicy="active-only"
                        tabs={[
                            {id: "labour", label: "Labour", content: table("labour", labourColumns)},
                            {id: "materials", label: "Materials", content: table("materials", materialColumns)},
                            {id: "progress", label: "Progress", content: table("progress", progressColumns)},
                        ]}
                    />
                </Panel>
            </SplitSecondary>
            </SplitView>
        </>;
    }
}
