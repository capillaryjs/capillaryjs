import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, Panel, PanelToolbar, DescriptionList, DescriptionItem, InfoPanel, InfoField,
    Button, Dialog, DialogActions, Textbox, Dropdown, DateTimePicker, Label,
    RouteLink, RouteValue, Placeholder, routeTarget,
} from "@sylwellsoftware/fray";
import {Emitter, DerivedEmitter} from "@sylwellsoftware/glue";
import type {Row} from "../../api/ScenarioApi.ts";
import {screens, routes, issueIdParam} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue, renderRows} from "../shared.tsx";

export class IssueReportView extends Component {
    static dependencies = [
        Panel, PanelToolbar, DescriptionList, DescriptionItem, InfoPanel, InfoField,
        Button, Dialog, DialogActions, Textbox, Dropdown, DateTimePicker, Label,
        RouteLink, RouteValue, Placeholder,
    ];

    private state = screens["issue-analysis"];
    private readonly issueId = new Emitter<string | null>(null, {owner: this, purpose: 'issue id from route'});
    private readonly params = new DerivedEmitter(
        [this.issueId, this.state.params] as const,
        ([id, params]) => ({...params, selected: id ?? ""}),
        {owner: this, purpose: 'issue report params'},
    );
    private query = buildco.view("issue-analysis", {params: this.params, revision}, {owner: this});
    private readonly dialogOpen = new Emitter<boolean>(false, {owner: this, purpose: "issue dialog open"});

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        return <>
            <RouteValue route={issueIdParam} valueEmitter={this.issueId}/>
            {(() => {
                if (!b.value) return <Panel island header="Issue Report"><Placeholder/></Panel>;
                if (view.fetchState === "loading" && !view.value) return <Panel island header="Issue Report"><Placeholder/></Panel>;
                if (view.fetchState === "error" || !view.value) return <Panel island header="Issue Report"><Placeholder/></Panel>;

                const v = view.value;
                const detail = v.detail;
                if (!detail) return <Panel island header="Issue Report">
                    <Placeholder/>
                    <RouteLink to={routeTarget(routes["issue-analysis"])}>Back to Issue Analysis</RouteLink>
                </Panel>;

                return <Panel className="issue-report-view fray-size-flexible" island header={detail.title}>
                    <PanelToolbar>
                        <Button
                            label="Edit"
                            onClick={() => this.dialogOpen.set(true)}
                        />
                        <Button
                            label="Resolve"
                            onClick={() => this.dialogOpen.set(true)}
                        />
                        <RouteLink to={routeTarget(routes["issue-analysis"])}>Back to analysis</RouteLink>
                    </PanelToolbar>
                    <InfoPanel title="Issue Summary" label="Issue details">
                        {detail.fields.map(f => <InfoField
                            key={f.label}
                            label={f.label}
                            value={f.format ? formatValue(f.value, f.format) : String(f.value)}
                        />)}
                    </InfoPanel>
                    <DescriptionList>
                        {detail.fields.map(f => <DescriptionItem
                            key={f.label}
                            term={f.label}
                        >
                            {f.format ? formatValue(f.value, f.format) : String(f.value)}
                        </DescriptionItem>)}
                    </DescriptionList>
                    {detail.sections.map(section => <Panel
                        key={section.title}
                        allocation="natural"
                        header={section.title}
                    >
                        {renderRows(section.rows as readonly Row[])}
                    </Panel>)}
                    <Dialog
                        title="Edit Issue"
                        openEmitter={this.dialogOpen}
                        onClose={() => this.dialogOpen.set(false)}
                    >
                        <Textbox label="Title" defaultValue={detail.title}/>
                        <Label text="Description"/>
                        <textarea
                            className="fray-textbox"
                            defaultValue={String(detail.record?.description ?? "")}
                            rows={4}
                        />
                        <Dropdown
                            label="Severity"
                            options={[
                                {value: "low", label: "Low"},
                                {value: "medium", label: "Medium"},
                                {value: "high", label: "High"},
                                {value: "critical", label: "Critical"},
                            ]}
                            defaultValue={String(detail.record?.severity ?? "medium")}
                        />
                        <Dropdown
                            label="Assignee"
                            options={[
                                {value: "", label: "Unassigned"},
                                {value: "person-1", label: "Person 1"},
                                {value: "person-2", label: "Person 2"},
                                {value: "person-3", label: "Person 3"},
                            ]}
                            defaultValue={String(detail.record?.assigneeId ?? "")}
                        />
                        <DateTimePicker label="Due date and time"/>
                        <DialogActions>
                            <Button
                                label="Save"
                                onClick={() => {
                                    this.dialogOpen.set(false);
                                }}
                            />
                            <Button
                                label="Cancel"
                                onClick={() => this.dialogOpen.set(false)}
                            />
                        </DialogActions>
                    </Dialog>
                </Panel>;
            })()}
        </>;
    }
}
