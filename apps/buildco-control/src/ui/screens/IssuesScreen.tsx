import type {FrayChild} from "@sylwellsoftware/fray";
import {Button, Panel, Toolbar} from "@sylwellsoftware/fray";
import type {ViewResult} from "../../app/contract.ts";
import {bootstrap} from "../session.ts";
import {DetailView, Metrics} from "../shared.tsx";
import {editor, RecordEditor} from "../editor.tsx";
import {options, ScreenView} from "./base.tsx";

export class IssuesScreen extends ScreenView {
    protected renderContent(result?: ViewResult): FrayChild {
        const delay = this.field("tab").get() === "delays";
        const b = this.read(bootstrap);

        const statusOptions = delay
            ? ["active", "ended", "cancelled"]
            : ["open", "investigating", "planned", "inResolution", "resolved", "closed"];

        const causeOptions = delay
            ? [
                "personnelAbsence",
                "materialShortage",
                "lateDelivery",
                "issue",
                "weather",
                "equipmentFailure",
                "prerequisite",
                "accessRestriction",
                "permitRegulatory",
                "clientHold",
                "other",
            ]
            : [
                "supplier",
                "materialQuality",
                "workmanship",
                "workerMistake",
                "design",
                "planning",
                "coordination",
                "equipment",
                "weather",
                "clientChange",
                "regulatory",
                "transportDamage",
                "unknown",
            ];

        const tableFields = delay
            ? ["name", "project", "phase", "status", "cause", "date", "duration", "impact", "hours", "cost"]
            : ["name", "project", "status", "severity", "cause", "person", "due", "estimate", "cost"];

        return (
            <div className="fray-layout-vertical fray-size-flexible">
                <Panel island allocation="flexible">
                    <Metrics items={result?.metrics ?? []}/>
                    {this.tabs(
                        [["issues", "Issues"], ["delays", "Delays"]],
                        <>
                            <Toolbar label="Issue and delay filters">
                                {this.project()}
                                {this.text("search", delay ? "Delays" : "Issues")}
                                {this.select("status", "Status", options(statusOptions))}
                                {!delay && this.select("severity", "Severity", options(["low", "medium", "high", "critical"]))}
                                <Button
                                    label={delay ? "+ Report delay" : "+ Report issue"}
                                    onClick={() => editor.set({
                                        kind: delay ? "delay" : "issue",
                                        action: "create",
                                        projectId: this.field("project").get()
                                    })}
                                />
                            </Toolbar>

                            <details className="advanced-filters">
                                <summary>Advanced filters · cause, location, attribution & cost</summary>
                                <div className="filter-grid">
                                    {this.select("scope", "Scopes", result?.options?.scopes ?? [])}
                                    {this.select("phase", "Phases", result?.options?.phases ?? [])}
                                    {this.select("cause", "Causes", options(causeOptions))}

                                    {!delay && (
                                        <>
                                            {this.select("type", "Issue types", options(["defect", "quality", "safety", "supply", "design", "coordination", "damage", "other"]))}
                                            {this.select("person", "Assigned people", b?.choices.people ?? [])}
                                            {this.select("supplier", "Suppliers", b?.choices.suppliers ?? [])}
                                            {this.select("material", "Materials", b?.choices.materials ?? [])}
                                            {this.text("due", "Due on or before", "date")}
                                            {this.select("costView", "Cost view", [{
                                                value: "overEstimate",
                                                label: "Actual exceeds estimate"
                                            }])}
                                        </>
                                    )}

                                    {this.text("minCost", "Minimum actual cost", "number")}
                                    {this.text("maxCost", "Maximum actual cost", "number")}
                                </div>
                            </details>

                            {this.table(tableFields, result)}

                            {result?.detail ? (
                                <DetailView
                                    detail={result.detail}
                                    actions={
                                        <Toolbar label="Record actions">
                                            <Button
                                                label="Edit record"
                                                onClick={() => editor.set({
                                                    kind: delay ? "delay" : "issue",
                                                    action: "edit",
                                                    row: result.detail!.record
                                                })}
                                            />
                                            <Button
                                                label={delay ? "End delay" : "Resolve issue"}
                                                disabled={["ended", "resolved", "closed"].includes(String(result.detail.record?.status))}
                                                onClick={() => editor.set({
                                                    kind: delay ? "delay" : "issue",
                                                    action: "resolve",
                                                    row: result.detail!.record
                                                })}
                                            />
                                        </Toolbar>
                                    }
                                />
                            ) : (
                                this.selected(result)
                            )}
                        </>,
                    )}
                </Panel>
                <RecordEditor/>
            </div>
        );
    }
}
