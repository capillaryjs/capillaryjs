import {ViewFeedback, viewParameters} from "../ViewFeedback.js";
import type {CapillaryUiChild} from "@capillaryjs/capillary-ui";
import {
    Component, DataTable, Panel, PanelToolbar, Sidebar, SidebarToolbar,
    SplitPrimary, SplitSecondary, SplitView,
    TabPanel, Toggle, Checkbox, OptionsBox, OptionGroup,
    Dropdown, Textbox, Button, RouteQuery, Placeholder, Toolbar, stringRouteQueryCodec,
} from "@capillaryjs/capillary-ui";
import type {TableColumn, TableRow} from "@capillaryjs/capillary-ui";
import {Emitter} from "@capillaryjs/capillary";
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
        TabPanel, Toggle, Checkbox, OptionsBox, OptionGroup,
        Dropdown, Textbox, Button, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.operations;
    private readonly retrievalParams = viewParameters(this.state.params, ["compact"], this);
    private query = buildco.view("operations", {params: this.retrievalParams, revision}, {owner: this});
    private readonly feedback = new ViewFeedback(this.query, this.retrievalParams, this);
    private readonly previousPage = this.feedback.operation('previous page', () =>
        this.state.field('page').set(String(Math.max(0, Number(this.state.field('page').get() || 0) - 1))));
    private readonly nextPage = this.feedback.operation('next page', () =>
        this.state.field('page').set(String(Number(this.state.field('page').get() || 0) + 1)));
    private readonly resetFilters = this.feedback.operation('reset register filters', () => {
        for (const key of filterFields) this.state.field(key).set(['overtime', 'standby', 'issueOnly', 'waste', 'blocked', 'slip'].includes(key) ? 'neutral' : '');
    });
    // Compact rows are presentation state and stay out of the query contract.
    private readonly compact = new Emitter<string>("false", {owner: this, purpose: "compact rows"});

    initialize(): void {
        void this.query.activate();
    }

    render(): CapillaryUiChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);
        const compact = this.read(this.compact);

        if (!b.value) return <Panel island header="Operations"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Operations"><Placeholder/></Panel>;
        if (view.fetchState === "error" && !view.value) return <Panel island header="Operations">
            <Placeholder/>
            <p className="muted">{String(view.error ?? "The operations register could not be loaded.")}</p>
            <Button label="Retry" command={this.feedback.refresh}/>
        </Panel>;
        if (!view.value) return <Panel island header="Operations"><Placeholder/></Panel>;

        const v = view.value;
        const rows = v.rows as readonly OperationsRow[];
        const tab = this.read(this.state.tab) ?? "labour";
        const scopes = (v.options?.scopes ?? []) as readonly {value: string, label: string}[];
        // The backend clamps the requested page; display and increment the
        // effective page so the UI cannot drift past the result bounds.
        const page = v.page;
        const lastPage = Math.max(0, Math.ceil(v.total / v.pageSize) - 1);

        const table = (id: string, columns: TableColumn<OperationsRow>[]) => rows.length === 0
            ? <Placeholder/>
            : <DataTable busy={this.feedback.dataBusy()} selectionBusy={this.feedback.busyFor("selected", "phase")}
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
            <SplitView className="operations-view cap-size-flexible" primarySize="16rem" primaryLabel="Operations filters" secondaryLabel="Operations register">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Operations Register">
                    <SidebarToolbar>
                        <Toolbar label="Register search">
                            <Textbox busy={this.feedback.busyFor("search")}
                                label="Search"
                                placeholder="Filter records…"
                                valueEmitter={this.state.field("search") as any}
                            />
                            <Button label="Reset"
                                command={this.resetFilters}
                            />
                        </Toolbar>
                    </SidebarToolbar>
                    <OptionsBox header="Filters">
                        <OptionGroup label="Scope">
                            <Dropdown busy={this.feedback.busyFor("project")}
                                label="Project"
                                options={[{value: "", label: "All projects"}, ...(b.value.choices.projects ?? [])]}
                                valueEmitter={this.state.field("project") as any}
                                onChange={() => this.state.field("scope").set("")}
                            />
                            <Dropdown busy={this.feedback.busyFor("scope")}
                                label="Scope"
                                options={[{value: "", label: "All scopes"}, ...scopes]}
                                valueEmitter={this.state.field("scope") as any}
                            />
                        </OptionGroup>
                        <OptionGroup label="Dates">
                            <Textbox busy={this.feedback.busyFor("from")} label="From" type="date" valueEmitter={this.state.field("from") as any}/>
                            <Textbox busy={this.feedback.busyFor("to")} label="To" type="date" valueEmitter={this.state.field("to") as any}/>
                        </OptionGroup>
                        <OptionGroup label="Register-specific filters">
                            {tab === "labour" && <>
                                <Checkbox busy={this.feedback.busyFor("overtime")} label="Overtime only" valueEmitter={this.state.field("overtime") as any}/>
                                <Checkbox busy={this.feedback.busyFor("standby")} label="Include standby" valueEmitter={this.state.field("standby") as any}/>
                                <Checkbox busy={this.feedback.busyFor("issueOnly")} label="Issue-attributed only" valueEmitter={this.state.field("issueOnly") as any}/>
                            </>}
                            {tab === "materials" && <>
                                <Checkbox busy={this.feedback.busyFor("waste")} label="Waste only" valueEmitter={this.state.field("waste") as any}/>
                                <Checkbox busy={this.feedback.busyFor("issueOnly")} label="Issue-attributed only" valueEmitter={this.state.field("issueOnly") as any}/>
                            </>}
                            {tab === "progress" && <>
                                <Checkbox busy={this.feedback.busyFor("blocked")} label="Blocked reports only" valueEmitter={this.state.field("blocked") as any}/>
                                <Checkbox busy={this.feedback.busyFor("slip")} label="Forecast slip" valueEmitter={this.state.field("slip") as any}/>
                            </>}
                        </OptionGroup>
                        <OptionGroup label="Display">
                            <Toggle
                                label="Compact rows"
                                ariaLabel="Compact presentation"
                                options={[
                                    ["false", "Normal"],
                                    ["true", "Compact"],
                                ]}
                                valueEmitter={this.compact}
                            />
                        </OptionGroup>
                    </OptionsBox>
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Operational Records">
                    <PanelToolbar>
                        <Toolbar label="Register paging">
                            <Button icon="refresh" ariaLabel="Refresh results" appearance="subtle" command={this.feedback.refresh}/>
                            <span className="result-count">{v.total} records</span>
                            <Button icon="previous" ariaLabel="Previous" appearance="subtle"
                                disabled={page <= 0}
                                command={this.previousPage}
                            />
                            <span className="page-info">Page {page + 1}</span>
                            <Button icon="next" ariaLabel="Next" appearance="subtle"
                                disabled={page >= lastPage}
                                command={this.nextPage}
                            />
                        </Toolbar>
                    </PanelToolbar>
                    {view.fetchState === "error" ? <p role="alert">{String(view.error ?? "The results could not be refreshed.")}</p> : null}
                    <TabPanel busy={this.feedback.busyFor("tab")}
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
