import type {ComponentProps, FrayChild, TreeNode} from "@sylwellsoftware/fray";
import {
    Button,
    Checkbox,
    Component,
    createQueryTableDataSource,
    DataTable,
    Dropdown,
    live,
    RouteQuery,
    stringRouteQueryCodec,
    TabPanel,
    Textbox
} from "@sylwellsoftware/fray";
import {DerivedEmitter, Emitter} from "@sylwellsoftware/glue";
import type {Choice, Screen, SemanticMode, ViewResult} from "../../api/ScenarioApi.ts";
import {CONDITIONS, human} from "../../api/ScenarioApi.ts";
import {bootstrap, buildco, demo, flags, forceResult, revision, screens} from "../../app/session.ts";
import {columns, DetailView} from "./ViewComponents.tsx";

export const titles: Record<Screen, [string, string]> = {
    overview: ["Portfolio overview", "A clear view of delivery, cost, and the work that needs attention."],
    projects: ["Projects", "From the physical structure to every phase of delivery."],
    planning: ["Planning", "Look ahead. Understand dependencies. Keep the critical work moving."],
    queue: ["Work queue", "Find the right work with precise, composable conditions."],
    resources: ["Resources", "People, working hours, and materials — connected to delivery."],
    issues: ["Issues & delays", "Investigate causes, follow the cost, and close the loop."],
    analytics: ["Analytics", "Explore the shape of the portfolio and how it changes over time."],
};
export const options = (values: string[]): Choice[] => values.map(value => ({value, label: human(value)}));

export abstract class ScreenView extends Component<ComponentProps & { screen: Screen }> {
    protected state = screens[this.props.screen];
    protected query = buildco.view(this.props.screen, {params: this.state.params, revision}, {owner: this});
    protected result = forceResult(this.query);
    protected rows = this.result.map(value => value?.rows ?? []);
    protected tableRows = this.result.map(value => value?.rows);
    protected dataSource = createQueryTableDataSource({
        query: this.tableRows,
        sortEmitter: this.state.sort,
        filtersEmitter: this.state.filters,
        owner: this
    });
    protected treeSearch = new Emitter("");
    protected tree = new DerivedEmitter([this.result, this.treeSearch] as const, ([result, search]): TreeNode[] => {
        const nodes = result?.tree ?? [], q = search.toLowerCase();
        const children = (parent?: string): TreeNode[] => nodes.filter(n => n.parentId === parent).map(n => ({
            id: n.id,
            label: n.name,
            textValue: n.name,
            children: children(n.id)
        }))
            .filter(n => !q || n.textValue.toLowerCase().includes(q) || n.children.length > 0);
        return children();
    });
    protected conditionFields = CONDITIONS.map(c => ({
        ...c,
        emitter: new Emitter<SemanticMode>(JSON.parse(this.state.field("conditions").get() || "{}")[c.value] ?? "neutral")
    }));

    initialize(): void {
        this.onInit();
        for (const disposable of [this.query, this.result, this.rows, this.tableRows, this.dataSource, this.treeSearch, this.tree, ...this.conditionFields.map(c => c.emitter)]) this.onCleanup(() => disposable.dispose());
        for (const c of this.conditionFields) this.onCleanup(c.emitter.subscribe(() => this.state.field("conditions").set(JSON.stringify(Object.fromEntries(this.conditionFields.map(f => [f.value, f.emitter.get()])))), {emitCurrent: false}));
        this.onCleanup(this.state.field("tab").subscribe(({value}) => {
            if (value) this.state.tab.set(value);
        }, {emitCurrent: false}));
        this.onCleanup(this.state.field("project").subscribe(() => {
            this.state.field("scope").set("");
            this.state.field("phase").set("");
            this.state.field("selected").set("");
            this.state.selection.set(null);
        }, {emitCurrent: false}));
        void this.query.activate();
    }

    render(): FrayChild {
        const screen = this.props.screen, result = this.read(this.result), snapshot = this.snapshot(this.result),
            b = this.read(bootstrap);
        this.read(this.state.params);
        this.read(this.state.tab);
        const queryKeys = ["project", "scope", "phase", "tab", "selected", "search", "page", "subject", "focus", "horizon", "view", "type", "phaseType", "conditions", "lifecycle", "metric", "days", "trade", "availability", "reason", "from", "to", "overtime", "material", "group", "status", "severity", "cause", "person", "supplier", "due", "minCost", "maxCost", "costView", "critical"];
        return <div className={`screen screen-${screen} fray-layout-vertical fray-size-flexible`}>
            {queryKeys.map(name => <RouteQuery key={name} name={name} valueEmitter={this.field(name)}
                                               codec={stringRouteQueryCodec} defaultValue={this.field(name).get()}/>)}
            <div className="page-heading fray-size-natural">
                <div><span className="eyebrow">BuildCo / {screen === "queue" ? "Operations" : human(screen)}</span>
                    <h1>{titles[screen][0]}</h1><p>{titles[screen][1]}</p></div>
                <div className="heading-tools"><span
                    className="as-of">As of <b>{b?.metadata.anchorDate ?? "…"}</b></span><Button label="↻ Refresh"
                                                                                                 onClick={() => void this.query.refresh()}
                                                                                                 disabled={live(flags.disabled)}/>
                </div>
            </div>
            <div className="query-feedback fray-size-natural">{snapshot.fetchState !== "ready" &&
                <div role={snapshot.fetchState === "error" ? "alert" : "status"}
                     className={`fetch-notice ${snapshot.fetchState}`}>
                    {snapshot.fetchState === "error" ? <><strong>Unable to load this
                        view.</strong> {demo.mode.get() === "error" ? "Simulated error from the demo controls." : "Please retry the request."}<Button
                        label="Retry" onClick={() => {
                        demo.mode.set("live");
                        void this.query.retry();
                    }}/></> : snapshot.fetchState === "initial" ? "Initial state — waiting for a request." : "Updating view… Previous results may remain visible."}
                </div>}</div>
            <div className="screen-content fray-size-flexible fray-layout-vertical fray-scroll"
                 key="screen-content">{this.renderContent(result)}</div>
        </div>;
    }

    protected onInit(): void {
    }

    protected field(name: string) {
        return this.state.field(name);
    }

    protected semanticField(name: string) {
        return this.field(name) as Emitter<SemanticMode>;
    }

    protected select(name: string, label: string, choices: readonly Choice[], all = true): FrayChild {
        return <Dropdown key={`${name}:${choices.map(c => c.value).join(",")}`} label={label}
                         placeholder={all ? `All ${label.toLowerCase()}` : "Select…"} valueEmitter={this.field(name)}
                         options={all ? [{value: "__all", label: `All ${label.toLowerCase()}`}, ...choices] : choices}
                         disabled={live(flags.disabled)} required={live(flags.required)} error={live(flags.error)}/>;
    }

    protected text(name: string, label: string, type = "text"): FrayChild {
        return <Textbox key={name} label={label} type={type} valueEmitter={this.field(name)}
                        placeholder={type === "text" ? `Search ${label.toLowerCase()}…` : undefined}
                        disabled={live(flags.disabled)} required={live(flags.required)} error={live(flags.error)}/>;
    }

    protected project(): FrayChild {
        return this.select("project", "Projects", this.read(bootstrap)?.choices.projects ?? []);
    }

    protected check(name: string, label: string): FrayChild {
        return <Checkbox valueEmitter={this.field(name)} symbols={[["☐", "off"], ["✓", "on"]]} label={label}
                         disabled={live(flags.disabled)}/>;
    }

    protected tabs(values: [string, string][], content: FrayChild): FrayChild {
        return <TabPanel label={`${titles[this.props.screen][0]} views`} activeTabEmitter={this.state.tab}
                         mountPolicy="active-only" tabs={values.map(([id, label]) => ({
            id,
            label,
            content: <div className="tab-content" key={id}>{content}</div>
        }))}/>;
    }

    protected pager(result?: ViewResult): FrayChild {
        if (!result || !result.total) return <p className="empty-inline">No records match the current filters.</p>;
        return <div className="pager">
            <span>{(result.page * result.pageSize + 1).toLocaleString()}–{Math.min(result.total, (result.page + 1) * result.pageSize).toLocaleString()} of {result.total.toLocaleString()} records</span>
            <div><Button label="← Previous" disabled={result.page === 0}
                         onClick={() => this.field("page").set(String(result.page - 1))}/><Button label="Next →"
                                                                                                  disabled={(result.page + 1) * result.pageSize >= result.total}
                                                                                                  onClick={() => this.field("page").set(String(result.page + 1))}/>
            </div>
        </div>;
    }

    protected table(fields: string[], result?: ViewResult): FrayChild {
        return <>
            <div className="table-scroll"><DataTable key={`${this.props.screen}-${this.field("tab").get()}`}
                                                     columns={columns(fields)} dataSource={this.dataSource}
                                                     selectedItemEmitter={this.state.selection}
                                                     caption={`${titles[this.props.screen][0]} records`}
                                                     emptyMessage="No matching records. Adjust your filters to broaden the view."/>
            </div>
            {this.pager(result)}</>;
    }

    protected selected(result?: ViewResult): FrayChild {
        return result?.detail ? <DetailView detail={result.detail}/> :
            <div className="selection-hint">Select a record to inspect its context, dependencies, and resource
                costs.</div>;
    }

    protected abstract renderContent(result?: ViewResult): FrayChild;
}
