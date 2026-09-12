import type {DateTimeValue, FrayChild} from "@sylwellsoftware/fray";
import {
    Component, Panel, PanelToolbar, DescriptionList, DescriptionItem, InfoPanel, InfoField,
    Button, Dialog, DialogActions, Textbox, Dropdown, DateTimePicker, Label,
    RouteLink, RouteValue, RouteQuery, Placeholder, Toolbar, live, routeTarget, stringRouteQueryCodec,
} from "@sylwellsoftware/fray";
import {Emitter, DerivedEmitter} from "@sylwellsoftware/glue";
import type {Row} from "../../api/ScenarioApi.ts";
import {human} from "../../api/ScenarioApi.ts";
import {screens, routes, issueIdParam} from "../../app/routing.ts";
import {buildco, revision, bootstrap, mutate} from "../../app/services.ts";
import {formatValue, renderRows} from "../shared.tsx";

const severities = ["low", "medium", "high", "critical"].map(value => ({value, label: human(value)}));

export class IssueReportView extends Component {
    static dependencies = [
        Panel, PanelToolbar, DescriptionList, DescriptionItem, InfoPanel, InfoField,
        Button, Dialog, DialogActions, Textbox, Dropdown, DateTimePicker, Label,
        RouteLink, RouteValue, RouteQuery, Placeholder, Toolbar,
    ];

    private state = screens["issue-report"];
    private readonly issueId = new Emitter<string | null>(null, {owner: this, purpose: 'issue id from route'});
    private readonly params = new DerivedEmitter(
        [this.issueId, this.state.params] as const,
        ([id, params]) => ({...params, issueId: id ?? ""}),
        {owner: this, purpose: 'issue report params'},
    );
    private query = buildco.view("issue-report", {params: this.params, revision}, {owner: this});
    private readonly dialogOpen = new Emitter<boolean>(false, {owner: this, purpose: "issue dialog open"});
    private readonly dialogMode = new Emitter<"edit" | "resolve">("edit", {owner: this, purpose: "issue dialog mode"});
    private readonly dialogError = new Emitter<string>("", {owner: this, purpose: "issue dialog error"});
    private readonly draft = {
        title: new Emitter<string>("", {owner: this, purpose: "issue draft title"}),
        description: new Emitter<string>("", {owner: this, purpose: "issue draft description"}),
        severity: new Emitter<string>("medium", {owner: this, purpose: "issue draft severity"}),
        person: new Emitter<string>("", {owner: this, purpose: "issue draft assignee"}),
        due: new Emitter<DateTimeValue | null>(null, {owner: this, purpose: "issue draft due"}),
    };

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);
        const busy = this.read(mutate.isRunning);
        const mode = this.read(this.dialogMode);
        const error = this.read(this.dialogError);

        const v = view.value;
        const detail = v?.detail;
        const issueOptions = (v?.rows ?? []).map(r => ({value: String(r.id), label: String(r.name)}));
        if (detail && !issueOptions.some(o => o.value === detail.id)) {
            issueOptions.unshift({value: String(detail.id), label: String(detail.title)});
        }

        return <>
            <RouteValue route={issueIdParam} valueEmitter={this.issueId}/>
            <RouteQuery name="from" codec={stringRouteQueryCodec} valueEmitter={this.state.field("from")} defaultValue=""/>
            <Panel className="issue-report-view fray-size-flexible" island header={detail ? detail.title : "Issue Report"}>
                <PanelToolbar>
                    <Toolbar label="Issue actions">
                        <Dropdown
                            label="Issue"
                            placeholder="Select an issue…"
                            required
                            options={issueOptions}
                            valueEmitter={this.issueId as any}
                        />
                        <Button
                            label="Edit"
                            disabled={!detail || busy}
                            onClick={() => this.openDialog("edit")}
                        />
                        <Button
                            label="Resolve"
                            disabled={!detail || busy}
                            onClick={() => this.openDialog("resolve")}
                        />
                        <RouteLink to={routeTarget(routes["issue-analysis"])}>Back to analysis</RouteLink>
                    </Toolbar>
                </PanelToolbar>
                {!b.value || (view.fetchState === "loading" && !v) ? <Placeholder/>
                    : view.fetchState === "error" && !v ? <>
                        <Placeholder/>
                        <p className="muted">{String(view.error ?? "The issue report could not be loaded.")}</p>
                    </>
                    : !detail ? <>
                        <Placeholder/>
                        <p className="muted">{v?.notice ?? "Select an issue above to view its report."}</p>
                    </>
                    : <>
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
                    </>}
                {detail ? <Dialog
                    title={mode === "resolve" ? "Resolve issue" : "Edit issue"}
                    valueEmitter={this.dialogOpen}
                    onClose={() => this.dialogOpen.set(false)}
                >
                    {error ? <p role="alert" className="muted">{error}</p> : null}
                    {mode === "resolve"
                        ? <p>Mark “{detail.title}” as resolved on {b.value?.metadata.anchorDate}?</p>
                        : <>
                            <Textbox label="Title" valueEmitter={this.draft.title} disabled={busy} required/>
                            <Label text="Description"/>
                            <textarea
                                className="fray-textbox"
                                key={String(detail.id)}
                                defaultValue={String(detail.record?.description ?? "")}
                                rows={4}
                                disabled={busy}
                                onInput={event => this.draft.description.set((event.currentTarget as HTMLTextAreaElement).value)}
                            />
                            <Dropdown
                                label="Severity"
                                options={severities}
                                valueEmitter={this.draft.severity}
                                disabled={busy}
                            />
                            <Dropdown
                                label="Assignee"
                                options={[{value: "", label: "Unassigned"}, ...(b.value?.choices.people ?? [])]}
                                valueEmitter={this.draft.person}
                                disabled={busy}
                            />
                            <DateTimePicker label="Due date and time" valueEmitter={this.draft.due} disabled={busy}/>
                        </>}
                    <DialogActions>
                        <Button label="Cancel" disabled={busy} onClick={() => this.dialogOpen.set(false)}/>
                        <Button
                            label={mode === "resolve" ? "Resolve issue" : "Save"}
                            busy={live(mutate.isRunning)}
                            disabled={busy}
                            onClick={() => void this.save()}
                        />
                    </DialogActions>
                </Dialog> : null}
            </Panel>
        </>;
    }

    private openDialog(mode: "edit" | "resolve"): void {
        const detail = this.query.get()?.detail;
        if (!detail) return;
        this.dialogMode.set(mode);
        this.dialogError.set("");
        const record = (detail.record ?? {}) as Row;
        this.draft.title.set(String(detail.title));
        this.draft.description.set(String(record.description ?? ""));
        this.draft.severity.set(String(record.severity ?? "medium"));
        this.draft.person.set(String(record.assignedToId ?? ""));
        this.draft.due.set(record.due ? {date: String(record.due), time: null} : null);
        this.dialogOpen.set(true);
    }

    private async save(): Promise<void> {
        const detail = this.query.get()?.detail;
        if (!detail) return;
        const mode = this.dialogMode.get();
        const result = await mutate.run(mode === "resolve"
            ? {kind: "issue", action: "resolve", id: String(detail.id)}
            : {
                kind: "issue",
                action: "edit",
                id: String(detail.id),
                title: this.draft.title.get(),
                description: this.draft.description.get(),
                severity: this.draft.severity.get(),
                personId: this.draft.person.get() || undefined,
                dueDate: this.draft.due.get()?.date ?? undefined,
            });
        if (result) {
            this.dialogOpen.set(false);
            this.dialogError.set("");
        } else {
            const failure = mutate.getError();
            this.dialogError.set(failure instanceof Error ? failure.message : "The command failed. Please try again.");
        }
    }
}
