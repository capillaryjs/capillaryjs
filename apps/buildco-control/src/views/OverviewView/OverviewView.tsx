import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, Layout, InfoPanel, InfoField, ListView, Panel, PanelToolbar,
    Dropdown, Button, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    routeTarget, routeParameter, stringRouteQueryCodec, withRouteQuery,
} from "@sylwellsoftware/fray";
import type {Row} from "../../api/ScenarioApi.ts";
import {screens, routes, issueIdParam} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue} from "../shared.tsx";

export class OverviewView extends Component {
    static dependencies = [
        Layout, InfoPanel, InfoField, ListView, Panel, PanelToolbar,
        Dropdown, Button, ProgressBar, RouteLink, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens.overview;
    private query = buildco.view("overview", {params: this.state.params, revision}, {owner: this});

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Overview"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Overview"><Placeholder/></Panel>;
        if (view.fetchState === "error" && !view.value) return <Panel island header="Overview">
            <Placeholder/>
            <p className="muted">{String(view.error ?? "The overview could not be loaded.")}</p>
            <Button label="Retry" onClick={() => void this.query.refresh()}/>
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

        return <Layout className="overview-view fray-size-flexible" horizontal>
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
                    <Dropdown
                        label="Scope"
                        options={[
                            {value: "all", label: "All"},
                            {value: "active", label: "Active"},
                            {value: "risk", label: "At Risk"},
                        ]}
                        valueEmitter={this.state.field("scope") as any}
                    />
                    <Dropdown
                        label="Order"
                        options={[
                            {value: "", label: "Urgency"},
                            {value: "issues", label: "Open issues"},
                            {value: "variance", label: "Schedule variance"},
                            {value: "progress", label: "Least progress"},
                        ]}
                        valueEmitter={this.state.field("sort") as any}
                    />
                    <Button
                        label="Refresh"
                        onClick={() => void this.query.refresh()}
                    />
                    </Toolbar>
                </PanelToolbar>
                {attention.length === 0
                    ? <p className="muted">No portfolio items currently require attention.</p>
                    : <ListView
                        label="Attention items"
                        items={attention}
                        itemKey="id"
                        renderItem={r => {
                            const isIssue = r.id?.startsWith("issue-");
                            const link = isIssue
                                ? <RouteLink to={routeTarget(routes["issue-report"], routeParameter(issueIdParam, String(r.id)))}>
                                    {r.name}
                                </RouteLink>
                                : <RouteLink to={withRouteQuery(routeTarget(routes.projects), {project: String(r.projectId ?? ""), scope: String(r.scopeId ?? ""), phase: String(r.id), tab: "summary"})}>
                                    {r.name}
                                </RouteLink>;
                            return <span className="attention-item">
                                {link}
                                {r.openIssues != null ? <span className="attention-detail">{Number(r.openIssues)} issues</span> : null}
                                {r.date ? <span className="attention-date">{r.date}</span> : null}
                            </span>;
                        }}
                    />
                }
            </Panel>
        </Layout>;
    }
}
