import {ViewFeedback} from "../ViewFeedback.js";
import type {CapillaryUiChild} from "@capillaryjs/capillary-ui";
import {
    Component, ListView, Panel, PanelToolbar, Sidebar, SidebarToolbar,
    SplitPrimary, SplitSecondary, SplitView,
    OptionsBox, OptionGroup, OptionGroupHeaderEnd,
    QuadCheckbox, TriCheckbox, Dropdown, Textbox, Button,
    DescriptionList, DescriptionItem, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    routeTarget, stringRouteQueryCodec, withRouteQuery,
} from "@capillaryjs/capillary-ui";
import type {Parameters, Row} from "../../api/ScenarioApi.ts";
import {CONDITIONS} from "../../api/ScenarioApi.ts";
import {screens, routes} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue} from "../shared.tsx";

const AFFINITY_PREFIX = "affinity:";

function affinityKey(value: string): string {
    return `${AFFINITY_PREFIX}${value}`;
}

/** Route query names must match /^[A-Za-z][A-Za-z0-9_.-]*$/; affinity values may contain spaces. */
function affinityQueryName(value: string): string {
    return `aff-${value.replace(/[^A-Za-z0-9_.-]+/g, "-")}`;
}

function encodeModes(params: Parameters, keys: readonly string[]): string {
    const modes = Object.fromEntries(keys
        .map(key => [key, params[key]] as const)
        .filter(([, mode]) => mode && mode !== "neutral"));
    return JSON.stringify(modes);
}

export class QueueView extends Component {
    static dependencies = [
        ListView, Panel, PanelToolbar, Sidebar, SidebarToolbar, SplitView,
        OptionsBox, OptionGroup, OptionGroupHeaderEnd,
        QuadCheckbox, TriCheckbox, Dropdown, Textbox, Button,
        DescriptionList, DescriptionItem, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.queue;
    private affinityKeys: readonly string[] = [];
    // The backend expects semantic modes as JSON in `conditions`/`affinities`;
    // the individual checkbox fields are serialized here.
    private queryParams = this.state.params.map(params => ({
        ...params,
        conditions: encodeModes(params, CONDITIONS.map(c => c.value)),
        affinities: encodeModes(params, this.affinityKeys),
    }));
    private query = buildco.view("queue", {params: this.queryParams, revision}, {owner: this});
    private readonly feedback = new ViewFeedback(this.query, this.queryParams, this);
    private readonly resetSearch = this.feedback.operation('reset search criteria', () => this.resetCriteria());
    private readonly resetConditions = this.feedback.operation('reset condition criteria', () => this.resetCriteria());
    private readonly resetEmpty = this.feedback.operation('reset empty results', () => this.resetCriteria());

    initialize(): void {
        void this.query.activate();
    }

    render(): CapillaryUiChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Work Queue"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Work Queue"><Placeholder/></Panel>;
        if (view.fetchState === "error" && !view.value) return <Panel island header="Work Queue">
            <Placeholder/>
            <p className="muted">{String(view.error ?? "The work queue could not be loaded.")}</p>
            <Button label="Retry" command={this.feedback.refresh}/>
        </Panel>;
        if (!view.value) return <Panel island header="Work Queue"><Placeholder/></Panel>;

        const v = view.value;
        const rows = v.rows as readonly Row[];
        const detail = v.detail;
        // Phase and project types share one checkbox namespace; dedupe by value
        // so a shared value cannot produce duplicate keys on one emitter.
        const affinities = [...new Map([
            ...(b.value.choices.phaseTypes ?? []),
            ...(b.value.choices.projectTypes ?? []),
        ].map(a => [a.value, a] as const)).values()];
        this.affinityKeys = affinities.map(a => affinityKey(a.value));

        return <>
            <RouteQuery name="project" codec={stringRouteQueryCodec} valueEmitter={this.state.field("project")} defaultValue=""/>
            <RouteQuery name="sort" codec={stringRouteQueryCodec} valueEmitter={this.state.field("sort")} defaultValue=""/>
            <RouteQuery name="search" codec={stringRouteQueryCodec} valueEmitter={this.state.field("search")} defaultValue=""/>
            {CONDITIONS.map(c => <RouteQuery
                key={c.value}
                name={c.value}
                codec={stringRouteQueryCodec}
                valueEmitter={this.state.field(c.value)}
                defaultValue="neutral"
            />)}
            {affinities.map(a => <RouteQuery
                key={a.value}
                name={affinityQueryName(a.value)}
                codec={stringRouteQueryCodec}
                valueEmitter={this.state.field(affinityKey(a.value))}
                defaultValue="neutral"
            />)}
            <SplitView className="queue-view cap-size-flexible" primarySize="16rem" primaryLabel="Work queue filters" secondaryLabel="Queue items">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Work Queue">
                    <SidebarToolbar>
                        <Toolbar label="Queue search">
                            <Textbox busy={this.feedback.busyFor("search")}
                                label="Search"
                                placeholder="Filter phases…"
                                valueEmitter={this.state.field("search") as any}
                            />
                            <Button label="Reset"
                                command={this.resetSearch}
                            />
                        </Toolbar>
                    </SidebarToolbar>
                    <OptionsBox header="Conditions">
                        <OptionGroup label="Phase conditions">
                            <OptionGroupHeaderEnd>
                                <Button label="Reset"
                                    command={this.resetConditions}
                                />
                            </OptionGroupHeaderEnd>
                            {CONDITIONS.map(c => <QuadCheckbox busy={this.feedback.busyFor(c.value)}
                                key={c.value}
                                label={c.label}
                                valueEmitter={this.state.field(c.value) as any}
                            />)}
                        </OptionGroup>
                        <OptionGroup label="Type affinities">
                            {affinities.map(a => <TriCheckbox busy={this.feedback.busyFor(affinityKey(a.value))}
                                key={a.value}
                                label={a.label}
                                valueEmitter={this.state.field(affinityKey(a.value)) as any}
                            />)}
                        </OptionGroup>
                        <Dropdown busy={this.feedback.busyFor("project")}
                            label="Project scope"
                            options={[{value: "", label: "All projects"}, ...(b.value.choices.projects ?? [])]}
                            valueEmitter={this.state.field("project") as any}
                        />
                    </OptionsBox>
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Matching Phases">
                    <PanelToolbar>
                        <Toolbar label="Queue results">
                            <Button icon="refresh" ariaLabel="Refresh results" appearance="subtle" command={this.feedback.refresh}/>
                            <span className="result-count">{v.total} phases</span>
                            <Dropdown busy={this.feedback.busyFor("sort")}
                                label="Order by"
                                options={[
                                    {value: "", label: "Urgency"},
                                    {value: "variance:desc", label: "Schedule variance"},
                                    {value: "openIssues:desc", label: "Open issues"},
                                ]}
                                valueEmitter={this.state.field("sort") as any}
                            />
                        </Toolbar>
                    </PanelToolbar>
                    {view.fetchState === "error" ? <p role="alert">{String(view.error ?? "The results could not be refreshed.")}</p> : null}
                    {rows.length === 0
                        ? <>
                            <Placeholder/>
                            <p className="muted">No phases match the current criteria. Required or denied conditions may have eliminated every result.</p>
                            <Button label="Reset criteria" command={this.resetEmpty}/>
                        </>
                        : <ListView busy={this.feedback.dataBusy()} selectionBusy={this.feedback.busyFor("selected", "phase")}
                            label="Queue items"
                            items={rows}
                            itemKey="id"
                            renderItem={r => <span className="queue-item">
                                <RouteLink to={withRouteQuery(routeTarget(routes.projects), {project: String(r.projectId ?? ""), scope: String(r.scopeId ?? ""), tab: "summary"})}>
                                    {r.name}
                                </RouteLink>
                                {r.openIssues ? <span className="queue-item-issues">{Number(r.openIssues)} issues</span> : null}
                                {Number(r.variance) > 0 ? <span className="queue-item-variance">+{r.variance}d</span> : null}
                                {r.progress != null ? <ProgressBar
                                    label={`${r.name} progress`}
                                    value={Number(r.progress)}
                                    valueText={`${Math.round(Number(r.progress))}%`}
                                /> : null}
                            </span>}
                            selectedItemEmitter={this.state.selection}
                        />
                    }
                </Panel>
                {detail && <Panel island allocation="natural" header={detail.title}>
                    <DescriptionList label="Phase detail">
                        {detail.fields.map(f => <DescriptionItem
                            key={f.label}
                            term={f.label}
                            value={f.format ? formatValue(f.value, f.format) : String(f.value)}
                        />)}
                    </DescriptionList>
                </Panel>}
            </SplitSecondary>
            </SplitView>
        </>;
    }

    private resetCriteria(): void {
        for (const c of CONDITIONS) this.state.field(c.value).set("neutral");
        for (const key of this.affinityKeys) this.state.field(key).set("neutral");
        this.state.field("search").set("");
        this.state.field("project").set("");
    }
}
