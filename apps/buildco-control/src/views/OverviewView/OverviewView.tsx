import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, Layout, InfoPanel, InfoField, ListView, Panel, PanelToolbar,
    Dropdown, Button, RouteLink, Placeholder,
    routeTarget, routeParameter, withRouteQuery,
} from "@sylwellsoftware/fray";
import type {Row} from "../../api/ScenarioApi.ts";
import {screens, routes, issueIdParam} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue} from "../shared.tsx";

export class OverviewView extends Component {
    static dependencies = [
        Layout, InfoPanel, InfoField, ListView, Panel, PanelToolbar,
        Dropdown, Button, RouteLink, Placeholder,
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
        if (view.fetchState === "error" || !view.value) return <Panel island header="Overview"><Placeholder/></Panel>;

        const v = view.value;
        const attention = (v.attention ?? []) as readonly Row[];

        return <Layout className="overview-view fray-size-flexible" vertical>
            <InfoPanel title="Portfolio Summary" label="Portfolio metrics" allocation="natural">
                {v.metrics.map(m => <InfoField
                    key={m.label}
                    label={m.label}
                    value={m.note ?? formatValue(m.value, m.format)}
                />)}
            </InfoPanel>
            <Panel island allocation="flexible" header="Attention Items">
                <PanelToolbar>
                    <Dropdown
                        label="Scope"
                        options={[
                            {value: "all", label: "All"},
                            {value: "active", label: "Active"},
                            {value: "risk", label: "At Risk"},
                        ]}
                        valueEmitter={this.state.field("scope") as any}
                    />
                    <Button
                        label="Refresh"
                        onClick={() => void this.query.refresh()}
                    />
                </PanelToolbar>
                {attention.length === 0
                    ? <Placeholder/>
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
                                : <RouteLink to={withRouteQuery(routeTarget(routes.projects), {project: String(r.projectId ?? r.id), tab: "summary"})}>
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
