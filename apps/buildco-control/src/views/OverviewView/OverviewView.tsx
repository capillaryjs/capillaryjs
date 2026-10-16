import {ViewFeedback, viewParameters} from "../ViewFeedback.js";
import type {CapillaryUiChild} from "@capillaryjs/capillary-ui";
import {
    Component, Layout, InfoPanel, InfoField, Panel, PanelToolbar,
    Dropdown, Button, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    routeTarget, routeParameter, stringRouteQueryCodec, withRouteQuery,
} from "@capillaryjs/capillary-ui";
import type {Row} from "../../api/ScenarioApi.ts";
import {screens, routes, issueIdParam} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue} from "../shared.tsx";

export class OverviewView extends Component {
    static dependencies = [
        Layout, InfoPanel, InfoField, Panel, PanelToolbar,
        Dropdown, Button, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.overview;
    private readonly retrievalParams = viewParameters(this.state.params, ["sort"], this);
    private query = buildco.view("overview", {params: this.retrievalParams, revision}, {owner: this});
    private readonly feedback = new ViewFeedback(this.query, this.retrievalParams, this);

    initialize(): void {
        void this.query.activate();
    }

    render(): CapillaryUiChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Overview"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Overview"><Placeholder/></Panel>;
        if (view.fetchState === "error" && !view.value) return <Panel island header="Overview">
            <Placeholder/>
            <p className="muted">{String(view.error ?? "The overview could not be loaded.")}</p>
            <Button label="Retry" command={this.feedback.refresh}/>
        </Panel>;
        if (!view.value) return <Panel island header="Overview"><Placeholder/></Panel>;

        const v = view.value;
        const sort = this.read(this.state.field("sort"));
        const attention = [...((v.attention ?? []) as readonly Row[])].sort((a, b) => {
            switch (sort) {
                case "issues": return Number(b.openIssues ?? 0) - Number(a.openIssues ?? 0);
                case "variance": return Number(b.variance ?? 0) - Number(a.variance ?? 0);
                case "progress": return Number(a.progress ?? 0) - Number(b.progress ?? 0);
                default: return 0;
            }
        });

        return <Layout className="overview-view cap-size-flexible" horizontal>
            <RouteQuery name="scope" codec={stringRouteQueryCodec} valueEmitter={this.state.field("scope")} defaultValue="all"/>
            <RouteQuery name="sort" codec={stringRouteQueryCodec} valueEmitter={this.state.field("sort")} defaultValue=""/>
            <InfoPanel island className="overview-summary" title="Portfolio Summary" label="Portfolio metrics">
                {v.metrics.map(m => m.format === "percent"
                    ? <InfoField key={m.label} label={m.label}>
                        <ProgressBar
                            label={m.label}
                            value={Number(m.value)}
                            valueText={formatValue(m.value, m.format)}
                        />
                    </InfoField>
                    : <InfoField
                        key={m.label}
                        label={m.label}
                        value={m.note ?? formatValue(m.value, m.format)}
                    />)}
            </InfoPanel>
            <Panel island allocation="flexible" header="Attention Items">
                <PanelToolbar>
                    <Toolbar label="Attention controls">
                    <Dropdown busy={this.feedback.busyFor("scope")}
                        label="Scope"
                        options={[
                            {value: "all", label: "All"},
                            {value: "active", label: "Active"},
                            {value: "risk", label: "At Risk"},
                        ]}
                        valueEmitter={this.state.field("scope") as any}
                    />
                    <Dropdown busy={this.feedback.busyFor("sort")}
                        label="Order"
                        options={[
                            {value: "", label: "Urgency"},
                            {value: "issues", label: "Open issues"},
                            {value: "variance", label: "Schedule variance"},
                            {value: "progress", label: "Least progress"},
                        ]}
                        valueEmitter={this.state.field("sort") as any}
                    />
                    <Button icon="refresh" ariaLabel="Refresh" appearance="subtle"
                        command={this.feedback.refresh}
                    />
                    </Toolbar>
                </PanelToolbar>
                {view.fetchState === "error" ? <p role="alert">{String(view.error ?? "The results could not be refreshed.")}</p> : null}
                {attention.length === 0
                    ? <p className="muted">No portfolio items currently require attention.</p>
                    : <ul className="attention-list cap-working" aria-label="Attention items" aria-busy={view.fetchState === 'loading' ? 'true' : null}
                        data-cap-busy-visible={this.presentBusy(view.fetchState === 'loading') ? '' : null}>
                        {attention.map(r => {
                            const isIssue = r.id?.startsWith("issue-");
                            const link = isIssue
                                ? <RouteLink to={routeTarget(routes["issue-report"], routeParameter(issueIdParam, String(r.id)))}>
                                    {r.name}
                                </RouteLink>
                                : <RouteLink to={withRouteQuery(routeTarget(routes.projects), {project: String(r.projectId ?? ""), scope: String(r.scopeId ?? ""), phase: String(r.id), tab: "summary"})}>
                                    {r.name}
                                </RouteLink>;
                            return <li key={String(r.id)} className="attention-item">
                                {link}
                                {r.openIssues != null ? <span className="attention-detail">{Number(r.openIssues)} issues</span> : null}
                                {r.date ? <span className="attention-date">{r.date}</span> : null}
                            </li>;
                        })}
                    </ul>
                }
            </Panel>
        </Layout>;
    }
}
