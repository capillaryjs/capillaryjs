import type {FrayChild, Key} from "@sylwellsoftware/fray";
import {
    Breadcrumb, Component, DataTable, InfoField, Layout,
    Panel, Sidebar, SidebarToolbar, SplitPrimary, SplitSecondary, SplitView, TabPanel, TreeView,
    Textbox, Button, RouteQuery, Placeholder, Toolbar,
    routeTarget, stringRouteQueryCodec, withRouteQuery,
} from "@sylwellsoftware/fray";
import type {BreadcrumbItem, TableColumn, TableRow, TreeNode} from "@sylwellsoftware/fray";
import {Emitter} from "@sylwellsoftware/glue";
import type {Choice, Detail, Row} from "../../api/ScenarioApi.ts";
import type {ScopeNode} from "../../domain/model.ts";
import {keyQueryCodec, routes, screens} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue, renderRows} from "../shared.tsx";

const PROJECT_NODE = "project:";

interface ExplorerNode {
    kind: "project" | "scope";
    projectId: string;
}

const phaseColumns: TableColumn<TableRow>[] = [
    {field: "name", label: "Phase", sortable: true},
    {field: "status", label: "Status", sortable: true},
    {field: "progress", label: "Progress", sortable: true},
    {field: "cost", label: "Cost", sortable: true},
    {field: "variance", label: "Variance (days)", sortable: true},
    {field: "openIssues", label: "Issues", sortable: true},
];

function scopeChildren(
    scopes: readonly ScopeNode[],
    projectId: string,
    parentId: string | undefined,
): TreeNode<ExplorerNode>[] {
    return scopes
        .filter(s => s.projectId === projectId && s.parentId === parentId)
        .map(s => ({
            id: String(s.id),
            label: s.name,
            value: {kind: "scope", projectId: String(s.projectId)},
            children: scopeChildren(scopes, projectId, s.id),
        }));
}

function buildTree(projects: readonly Choice[], scopes: readonly ScopeNode[]): TreeNode<ExplorerNode>[] {
    return projects.map(p => ({
        id: `${PROJECT_NODE}${p.value}`,
        label: p.label,
        value: {kind: "project", projectId: p.value},
        children: scopeChildren(scopes, p.value, undefined),
    }));
}

function collectKeys(nodes: readonly TreeNode<ExplorerNode>[], into: Key[] = []): Key[] {
    for (const node of nodes) {
        into.push(node.id);
        collectKeys(node.children ?? [], into);
    }
    return into;
}

function filterTree(nodes: readonly TreeNode<ExplorerNode>[], query: string): TreeNode<ExplorerNode>[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...nodes];
    const visit = (node: TreeNode<ExplorerNode>): TreeNode<ExplorerNode> | null => {
        const children = (node.children ?? [])
            .map(visit)
            .filter((c): c is TreeNode<ExplorerNode> => c != null);
        if (String(node.label).toLowerCase().includes(q) || children.length) return {...node, children};
        return null;
    };
    return nodes.map(visit).filter((n): n is TreeNode<ExplorerNode> => n != null);
}

/** URL-safe tab id from a section title. */
function slug(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Cluster detail fields into titled groups, preserving first-seen order. */
function groupFields(fields: Detail["fields"]): {title: string; fields: Detail["fields"]}[] {
    const map = new Map<string, Detail["fields"]>();
    for (const f of fields) {
        const key = f.group ?? "";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(f);
    }
    return [...map].map(([title, fields]) => ({title, fields}));
}

/** Ancestor scope chain for a scope id, root-first, excluding the scope itself. */
function scopePath(scopes: readonly ScopeNode[], scopeId: string | undefined): ScopeNode[] {
    const byId = new Map(scopes.map(s => [String(s.id), s]));
    const path: ScopeNode[] = [];
    for (let cur = scopeId ? byId.get(scopeId) : undefined; cur; cur = cur.parentId ? byId.get(String(cur.parentId)) : undefined) {
        path.unshift(cur);
    }
    return path;
}

function buildCrumbs(
    detail: Detail,
    scopes: readonly ScopeNode[],
    projects: readonly Choice[],
): BreadcrumbItem[] {
    const projectId = String(detail.projectId ?? "");
    const projectName = projects.find(p => p.value === projectId)?.label ?? projectId;
    const link = (params: Record<string, string>) =>
        withRouteQuery(routeTarget(routes.projects), params);
    const items: BreadcrumbItem[] = [{
        id: `project:${projectId}`,
        label: projectName,
        to: link({project: projectId, scope: "", phase: ""}),
    }];
    for (const s of scopePath(scopes, detail.scopeId)) {
        items.push({
            id: String(s.id),
            label: s.name,
            to: link({project: projectId, scope: String(s.id), phase: ""}),
        });
    }
    if (detail.phaseId) {
        items.push({id: `phase:${String(detail.phaseId)}`, label: detail.title});
    }
    return items;
}

export class ProjectsView extends Component {
    static dependencies = [
        Breadcrumb, DataTable, InfoField, Layout, TabPanel,
        Panel, Sidebar, SidebarToolbar, SplitView, TreeView,
        Textbox, Button, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.projects;
    private query = buildco.view("projects", {params: this.state.params, revision}, {owner: this});
    private readonly nodeSelection = new Emitter<Key | null>(null);
    // Separate from state.tab: that emitter clears selection/sort/filters on change,
    // which would deselect a phase when switching detail sections.
    private readonly sectionTab = new Emitter<Key | null>(null);
    private nodeSync = false;
    private scopeProject = new Map<string, string>();
    private allNodeKeys: Key[] = [];

    initialize(): void {
        void this.query.activate();
        // Tree selection drives the project/scope route params. Project nodes use a
        // "project:" key prefix; scope nodes use their scope id.
        this.nodeSelection.subscribe(({value}) => {
            if (this.nodeSync) return;
            const key = value == null ? "" : String(value);
            this.state.selection.set(null);
            if (key.startsWith(PROJECT_NODE)) {
                this.state.field("project").set(key.slice(PROJECT_NODE.length));
                this.state.scope.set(null);
            } else if (key) {
                this.state.scope.set(key);
                const projectId = this.scopeProject.get(key);
                if (projectId) this.state.field("project").set(projectId);
            } else {
                this.state.scope.set(null);
            }
        });
        const reflect = () => {
            const scope = this.state.field("scope").get();
            const project = this.state.field("project").get();
            this.nodeSync = true;
            this.nodeSelection.set(scope ? scope : project ? `${PROJECT_NODE}${project}` : null);
            this.nodeSync = false;
        };
        this.state.field("scope").subscribe(reflect);
        this.state.field("project").subscribe(() => {
            reflect();
            const project = this.state.field("project").get();
            if (!project) return;
            const key = `${PROJECT_NODE}${project}`;
            if (!this.state.expanded.get().includes(key)) {
                this.state.expanded.set([...this.state.expanded.get(), key]);
            }
        });
        // Reveal matches while filtering the tree.
        this.state.field("search").subscribe(({value}) => {
            if (value) this.state.expanded.set(this.allNodeKeys);
        });
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Projects"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Projects"><Placeholder/></Panel>;
        if (view.fetchState === "error" && !view.value) return <Panel island header="Projects">
            <Placeholder/>
            <p className="muted">{String(view.error ?? "The project explorer could not be loaded.")}</p>
            <Button label="Retry" onClick={() => void this.query.refresh()}/>
        </Panel>;
        if (!view.value) return <Panel island header="Projects"><Placeholder/></Panel>;

        const v = view.value;
        const rows = v.rows as readonly Row[];
        const scopes = (v.tree ?? []) as readonly ScopeNode[];
        const detail = v.detail;
        const search = this.state.field("search").get();

        this.scopeProject = new Map(scopes.map(s => [String(s.id), String(s.projectId)]));
        const fullTree = buildTree(b.value.choices.projects ?? [], scopes);
        this.allNodeKeys = collectKeys(fullTree);
        const treeNodes = filterTree(fullTree, search);
        const crumbs = detail ? buildCrumbs(detail, scopes, b.value.choices.projects ?? []) : [];
        const groups = detail ? groupFields(detail.fields) : [];

        return <>
            <RouteQuery name="project" codec={stringRouteQueryCodec} valueEmitter={this.state.field("project")} defaultValue=""/>
            <RouteQuery name="scope" codec={keyQueryCodec} valueEmitter={this.state.scope} defaultValue={null}/>
            <RouteQuery name="phase" codec={stringRouteQueryCodec} valueEmitter={this.state.field("phase")} defaultValue=""/>
            <RouteQuery name="search" codec={stringRouteQueryCodec} valueEmitter={this.state.field("search")} defaultValue=""/>
            <SplitView className="projects-view fray-size-flexible" primarySize="18rem" primaryLabel="Project explorer" secondaryLabel="Details">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Project Explorer">
                    <SidebarToolbar>
                        <Toolbar label="Explorer search">
                            <Textbox
                                label="Search"
                                placeholder="Filter tree…"
                                valueEmitter={this.state.field("search") as any}
                            />
                        </Toolbar>
                    </SidebarToolbar>
                    <TreeView
                        label="Project structure"
                        nodes={treeNodes}
                        selectedKeyEmitter={this.nodeSelection}
                        expandedKeysEmitter={this.state.expanded}
                    />
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Layout vertical allocation="flexible" className="project-detail">
                    {detail ? <>
                        <Breadcrumb items={crumbs}/>
                        <Panel island allocation="natural" header={detail.title} className="detail-info">
                            <Layout horizontal className="info-groups">
                                {groups.map(g => <div className="info-group" key={g.title || "details"}>
                                    {g.title ? <h4 className="info-group-title">{g.title}</h4> : null}
                                    <dl>{g.fields.map(f => <InfoField
                                        key={f.label}
                                        label={f.label}
                                        value={f.format ? formatValue(f.value, f.format) : String(f.value)}
                                    />)}</dl>
                                </div>)}
                            </Layout>
                        </Panel>
                        <Panel island allocation="flexible" header="Phases">
                            <DataTable
                                caption="Phases"
                                columns={phaseColumns}
                                data={rows}
                                rowKey="id"
                                selectedItemEmitter={this.state.selection}
                            />
                        </Panel>
                        {detail.sections.length ? <TabPanel
                            island
                            allocation="flexible"
                            label="Detail sections"
                            valueEmitter={this.sectionTab}
                            mountPolicy="active-only"
                            tabs={detail.sections.map(s => ({
                                id: slug(s.title),
                                label: s.title,
                                content: renderRows(s.rows as readonly Row[]),
                            }))}
                        /> : null}
                    </> : <Panel island><Placeholder/></Panel>}
                </Layout>
            </SplitSecondary>
            </SplitView>
        </>;
    }
}
