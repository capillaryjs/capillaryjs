import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, DataTable, DescriptionList, DescriptionItem, ListView,
    Panel, Sidebar, SidebarToolbar, SplitPrimary, SplitSecondary, SplitView, TabPanel, TreeView,
    Textbox, Dropdown, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    routeTarget, stringRouteQueryCodec, withRouteQuery,
} from "@sylwellsoftware/fray";
import type {TableColumn, TableRow, TreeNode} from "@sylwellsoftware/fray";
import type {Row} from "../../api/ScenarioApi.ts";
import type {ScopeNode} from "../../domain/model.ts";
import {keyQueryCodec, screens, routes} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue} from "../shared.tsx";

interface PhaseRow extends TableRow {
    id: string;
    name: string;
    status: string;
    progress: number;
    cost: number;
    budget: number;
    variance: number;
    openIssues: number;
    priority: string;
}

const phaseColumns: TableColumn<PhaseRow>[] = [
    {field: "name", label: "Phase", sortable: true},
    {field: "status", label: "Status", sortable: true},
    {field: "progress", label: "Progress", sortable: true},
    {field: "cost", label: "Cost", sortable: true},
    {field: "variance", label: "Variance (days)", sortable: true},
    {field: "openIssues", label: "Issues", sortable: true},
];

function scopeToNodes(nodes: readonly ScopeNode[], parentId?: string): TreeNode[] {
    return nodes
        .filter(n => n.parentId === parentId)
        .map(n => ({
            id: n.id,
            label: n.name,
            children: scopeToNodes(nodes, n.id),
        }));
}

export class ProjectsView extends Component {
    static dependencies = [
        DataTable, DescriptionList, DescriptionItem, ListView,
        Panel, Sidebar, SidebarToolbar, SplitView, TabPanel, TreeView,
        Textbox, Dropdown, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.projects;
    private query = buildco.view("projects", {params: this.state.params, revision}, {owner: this});

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Projects"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Projects"><Placeholder/></Panel>;
        if (view.fetchState === "error" || !view.value) return <Panel island header="Projects"><Placeholder/></Panel>;

        const v = view.value;
        const rows = v.rows as readonly Row[];
        const tree = (v.tree ?? []) as readonly ScopeNode[];
        const detail = v.detail;

        const treeNodes = scopeToNodes(tree);

        return <SplitView className="projects-view fray-size-flexible" primarySize="18rem" primaryLabel="Project scope" secondaryLabel="Project details">
            <RouteQuery name="project" codec={stringRouteQueryCodec} valueEmitter={this.state.field("project")} defaultValue=""/>
            <RouteQuery name="scope" codec={keyQueryCodec} valueEmitter={this.state.scope} defaultValue={null}/>
            <RouteQuery name="phase" codec={stringRouteQueryCodec} valueEmitter={this.state.field("phase")} defaultValue=""/>
            <RouteQuery name="tab" codec={keyQueryCodec} valueEmitter={this.state.tab} defaultValue="summary"/>
            <RouteQuery name="search" codec={stringRouteQueryCodec} valueEmitter={this.state.field("search")} defaultValue=""/>
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Project Explorer">
                    <SidebarToolbar>
                        <Toolbar label="Project selection">
                            <Dropdown
                                label="Project"
                                options={b.value.choices.projects ?? []}
                                valueEmitter={this.state.field("project") as any}
                            />
                            <Textbox
                                label="Search"
                                placeholder="Filter tree…"
                                valueEmitter={this.state.field("search") as any}
                            />
                        </Toolbar>
                    </SidebarToolbar>
                    <TreeView
                        label="Scope structure"
                        nodes={treeNodes}
                        selectedKeyEmitter={this.state.scope}
                    />
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header={detail?.title ?? "Project"}>
                    <TabPanel
                        label="Project detail tabs"
                        valueEmitter={this.state.tab}
                        mountPolicy="active-only"
                        tabs={[
                            {
                                id: "summary",
                                label: "Summary",
                                content: detail ? <>
                                    <DescriptionList label="Project summary">
                                        {detail.fields.map(f => <DescriptionItem
                                            key={f.label}
                                            term={f.label}
                                            value={f.format ? formatValue(f.value, f.format) : String(f.value)}
                                        />)}
                                    </DescriptionList>
                                    <div className="progress-list">
                                        <ProgressBar
                                            label="Overall progress"
                                            value={Number(detail.record?.progress ?? 0)}
                                            valueText={`${Math.round(Number(detail.record?.progress ?? 0))}%`}
                                        />
                                    </div>
                                </> : <Placeholder/>,
                            },
                            {
                                id: "prerequisites",
                                label: "Prerequisites",
                                content: <ListView
                                    label="Prerequisites"
                                    items={rows}
                                    itemKey="id"
                                    renderItem={r => <RouteLink to={withRouteQuery(routeTarget(routes.projects), {project: String(r.projectId ?? ""), scope: String(r.id), tab: "summary"})}>
                                        {r.name}
                                    </RouteLink>}
                                />,
                            },
                            {
                                id: "resources",
                                label: "Resources",
                                content: <DataTable
                                    caption="Resources"
                                    columns={[
                                        {field: "name", label: "Resource", sortable: true},
                                        {field: "status", label: "Status", sortable: true},
                                        {field: "cost", label: "Cost", sortable: true},
                                    ]}
                                    data={rows as readonly TableRow[]}
                                    rowKey="id"
                                />,
                            },
                            {
                                id: "reports",
                                label: "Progress reports",
                                content: <DataTable
                                    caption="Progress reports"
                                    columns={[
                                        {field: "name", label: "Phase", sortable: true},
                                        {field: "date", label: "Date", sortable: true},
                                        {field: "progress", label: "Progress", sortable: true},
                                        {field: "status", label: "Status", sortable: true},
                                    ]}
                                    data={rows as readonly TableRow[]}
                                    rowKey="id"
                                />,
                            },
                        ]}
                    />
                </Panel>
            </SplitSecondary>
        </SplitView>;
    }
}
