import type {FrayChild} from "@sylwellsoftware/fray";
import {Button, Panel, Sidebar, SplitView, Textbox, TreeView} from "@sylwellsoftware/fray";
import type {ViewResult} from "../../api/ScenarioApi.ts";
import {bootstrap} from "../../app/session.ts";
import {Metrics, Status} from "../shared/ViewComponents.tsx";
import {ScreenView} from "../shared/ScreenView.tsx";

export class ProjectsScreen extends ScreenView {
    protected onInit(): void {
        if (!this.state.field("project").get()) {
            this.state.field("project").set(
                bootstrap.get()?.projects.find(p => p.status === "active")?.id ??
                bootstrap.get()?.projects[0]?.id ??
                "",
            );
        }

        this.onCleanup(
            bootstrap.subscribe(
                ({value}) => {
                    if (value && !this.state.field("project").get()) {
                        this.state.field("project").set(
                            value.projects.find(p => p.status === "active")?.id ??
                            value.projects[0]?.id ??
                            "",
                        );
                    }
                },
                {emitCurrent: false},
            ),
        );
    }

    protected renderContent(result?: ViewResult): FrayChild {
        const tab = this.field("tab").get();

        const tableFields =
            tab === "reports"
                ? ["name", "date", "progress", "status", "forecast"]
                : tab === "budget"
                    ? [
                        "name",
                        "budget",
                        "cost",
                        "costVariance",
                        "hours",
                        "budgetHours",
                        "headcount",
                        "plannedHeadcount",
                        "shortage",
                    ]
                    : ["name", "status", "progress", "start", "forecast", "variance"];

        return (
            <SplitView
                primarySize="270px"
                primaryLabel="Project structure"
                secondaryLabel="Scope detail"
                primary={
                    <Sidebar island allocation="flexible" ariaLabel="Project structure"
                             header={<h2>Project structure</h2>}>
                        {this.select("project", "Project", this.read(bootstrap)?.choices.projects ?? [], false)}
                        <Textbox
                            label="Find a scope"
                            valueEmitter={this.treeSearch}
                            placeholder="Building, floor, room…"
                        />
                        <Button
                            label="Whole project"
                            onClick={() => {
                                this.state.scope.set(null);
                                this.field("scope").set("");
                                this.field("phase").set("");
                            }}
                        />
                        <TreeView
                            nodes={this.tree}
                            selectedKeyEmitter={this.state.scope}
                            expandedKeysEmitter={this.state.expanded}
                            label="Physical project hierarchy"
                        />
                    </Sidebar>
                }
                secondary={
                    <Panel island allocation="flexible">
                        <Metrics items={result?.metrics ?? []}/>
                        {this.tabs(
                            [
                                ["summary", "Summary"],
                                ["phases", "Phases"],
                                ["budget", "Budget & resources"],
                                ["reports", "Reports"],
                            ],
                            <>
                                {tab === "summary" ? (
                                    <>
                                        {this.selected(result)}
                                        <h2>Milestones</h2>
                                        <div className="milestones">
                                            {(result?.milestones ?? []).map(row => (
                                                <div className="milestone" key={row.id}>
                                                    <div>
                                                        <strong>{row.name}</strong>
                                                        <Status value={row.status}/>
                                                    </div>
                                                    <span>Baseline {row.date} · Forecast {String(row.forecast)}</span>
                                                    {row.critical && <small>Critical milestone</small>}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {this.text("search", "Phases")}
                                        {this.table(tableFields, result)}
                                        {this.selected(result)}
                                    </>
                                )}
                            </>,
                        )}
                    </Panel>
                }
            />
        );
    }
}
