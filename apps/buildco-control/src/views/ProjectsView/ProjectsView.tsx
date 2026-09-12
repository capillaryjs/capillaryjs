import type {FrayChild, Key} from "@sylwellsoftware/fray";
import {
    Component, DataTable, DescriptionList, DescriptionItem,
    Panel, Sidebar, SidebarToolbar, SplitPrimary, SplitSecondary, SplitView, TreeView,
    Textbox, Button, ProgressBar, RouteQuery, Placeholder, Toolbar,
    stringRouteQueryCodec,
} from "@sylwellsoftware/fray";
import type {TableColumn, TableRow, TreeNode} from "@sylwellsoftware/fray";
import {Emitter} from "@sylwellsoftware/glue";
import type {Choice, Row} from "../../api/ScenarioApi.ts";
import type {ScopeNode} from "../../domain/model.ts";
import {keyQueryCodec, screens} from "../../app/routing.ts";
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

export class ProjectsView extends Component {
    static dependencies = [
        DataTable, DescriptionList, DescriptionItem,
        Panel, Sidebar, SidebarToolbar, SplitView, TreeView,
        Textbox, Button, ProgressBar, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.projects;
    private query = buildco.view("projects", {params: this.state.params, revision}, {owner: this});
    private readonly nodeSelection = new Emitter<Key | null>(null);
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
        const progress = detail?.record?.progress
            ?? detail?.fields.find(f => f.format === "percent" && /progress/i.test(f.label))?.value;

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
                <Panel island allocation="flexible" header={detail?.title ?? "Project"}>
                    {detail ? <>
                        {detail.subtitle ? <p className="muted detail-subtitle">{detail.subtitle}</p> : null}
                        <DescriptionList label="Details">
                            {detail.fields.map(f => <DescriptionItem
                                key={f.label}
                                term={f.label}
                                value={f.format ? formatValue(f.value, f.format) : String(f.value)}
                            />)}
                        </DescriptionList>
                        {progress != null ? <div className="progress-list">
                            <ProgressBar
                                label="Progress"
                                value={Number(progress)}
                                valueText={`${Math.round(Number(progress))}%`}
                            />
                        </div> : null}
                        <Panel allocation="natural" header="Phases">
                            <DataTable
                                caption="Phases"
                                columns={phaseColumns}
                                data={rows}
                                rowKey="id"
                                selectedItemEmitter={this.state.selection}
                            />
                        </Panel>
                        {detail.sections.map(section => <Panel
                            key={section.title}
                            allocation="natural"
                            header={section.title}
                        >
                            {renderRows(section.rows as readonly Row[])}
                        </Panel>)}
                    </> : <Placeholder/>}
                </Panel>
            </SplitSecondary>
            </SplitView>
        </>;
    }
}
