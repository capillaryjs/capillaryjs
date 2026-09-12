import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, ListView, Panel, PanelToolbar, Sidebar, SidebarToolbar,
    SplitPrimary, SplitSecondary, SplitView,
    OptionsPanel, OptionGroup, OptionGroupHeaderEnd, GroupPanel,
    QuadCheckbox, TriCheckbox, Dropdown, Textbox, Button,
    DescriptionList, DescriptionItem, ProgressBar, RouteLink, Placeholder,
} from "@sylwellsoftware/fray";
import type {Row} from "../../api/ScenarioApi.ts";
import {CONDITIONS} from "../../api/ScenarioApi.ts";
import {screens, routes} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue} from "../shared.tsx";
import {routeTarget, withRouteQuery} from "@sylwellsoftware/fray";

export class QueueView extends Component {
    static dependencies = [
        ListView, Panel, PanelToolbar, Sidebar, SidebarToolbar, SplitView,
        OptionsPanel, OptionGroup, OptionGroupHeaderEnd, GroupPanel,
        QuadCheckbox, TriCheckbox, Dropdown, Textbox, Button,
        DescriptionList, DescriptionItem, ProgressBar, RouteLink, Placeholder,
    ];

    private state = screens.queue;
    private query = buildco.view("queue", {params: this.state.params, revision}, {owner: this});

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Work Queue"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Work Queue"><Placeholder/></Panel>;
        if (view.fetchState === "error" || !view.value) return <Panel island header="Work Queue"><Placeholder/></Panel>;

        const v = view.value;
        const rows = v.rows as readonly Row[];
        const detail = v.detail;

        return <SplitView className="queue-view fray-size-flexible" primarySize="16rem" primaryLabel="Work queue filters" secondaryLabel="Queue items">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Work Queue">
                    <SidebarToolbar>
                        <Textbox
                            label="Search"
                            placeholder="Filter phases…"
                            valueEmitter={this.state.field("search") as any}
                        />
                        <Button
                            label="Reset"
                            onClick={() => {
                                for (const c of CONDITIONS) this.state.field(c.value).set("neutral" as any);
                                this.state.field("search").set("");
                            }}
                        />
                    </SidebarToolbar>
                    <OptionsPanel header="Conditions">
                        <GroupPanel header="Health conditions">
                            <OptionGroup label="Phase conditions">
                                <OptionGroupHeaderEnd>
                                    <Button
                                        label="Reset"
                                        onClick={() => {
                                            for (const c of CONDITIONS) this.state.field(c.value).set("neutral" as any);
                                        }}
                                    />
                                </OptionGroupHeaderEnd>
                                {CONDITIONS.map(c => <QuadCheckbox
                                    key={c.value}
                                    label={c.label}
                                    valueEmitter={this.state.field(c.value) as any}
                                />)}
                            </OptionGroup>
                        </GroupPanel>
                        <GroupPanel header="Affinities">
                            <OptionGroup label="Trade affinities">
                                <TriCheckbox label="Electrical" valueEmitter={this.state.field("trade") as any}/>
                                <TriCheckbox label="Finishes" valueEmitter={this.state.field("trade") as any}/>
                                <TriCheckbox label="Renovation" valueEmitter={this.state.field("trade") as any}/>
                            </OptionGroup>
                        </GroupPanel>
                        <Dropdown
                            label="Project scope"
                            options={[
                                {value: "", label: "All projects"},
                            ]}
                            valueEmitter={this.state.field("project") as any}
                        />
                    </OptionsPanel>
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Matching Phases">
                    <PanelToolbar>
                        <span className="result-count">{rows.length} phases</span>
                        <Dropdown
                            label="Order by"
                            options={[
                                {value: "priority", label: "Priority"},
                                {value: "variance", label: "Schedule variance"},
                                {value: "issues", label: "Open issues"},
                            ]}
                            valueEmitter={this.state.field("ordering") as any}
                        />
                    </PanelToolbar>
                    {rows.length === 0
                        ? <Placeholder/>
                        : <ListView
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
        </SplitView>;
    }
}
