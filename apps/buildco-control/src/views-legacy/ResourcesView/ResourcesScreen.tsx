import type {FrayChild} from "@sylwellsoftware/fray";
import {ListView, Panel, RadioGroup, Toolbar, TriCheckbox} from "@sylwellsoftware/fray";
import type {ViewResult} from "../../api/ScenarioApi.ts";
import {bootstrap} from "../../app/services.ts";
import {Metrics, RecordCard} from "../shared/ViewComponents.tsx";
import {options, ScreenView} from "../shared/ScreenView.tsx";

export class ResourcesScreen extends ScreenView {
    protected renderContent(result?: ViewResult): FrayChild {
        const tab = this.field("tab").get();
        const b = this.read(bootstrap);

        const tableFields =
            tab === "labour"
                ? ["name", "project", "phase", "date", "reason", "hours", "overtime", "cost"]
                : ["name", "project", "status", "unit", "planned", "ordered", "delivered", "used", "available", "due", "cost"];

        return (
            <Panel island allocation="flexible">
                <Metrics items={result?.metrics ?? []}/>
                {this.tabs(
                    [
                        ["people", "People"],
                        ["labour", "Labour"],
                        ["materials", "Materials"],
                    ],
                    <>
                        <Toolbar label="Resource filters">
                            {this.project()}
                            {this.text("search", "Resources")}
                            {tab === "people" ? (
                                <>
                                    {this.select("trade", "Trades", b?.choices.trades ?? [])}
                                    {this.select("availability", "Availability", options(["available", "assigned", "absent"]))}
                                    <RadioGroup
                                        label="Order people by"
                                        valueEmitter={this.field("group")}
                                        options={[
                                            ["name", "Name"],
                                            ["type", "Trade"],
                                            ["status", "Availability"],
                                        ]}
                                    />
                                </>
                            ) : tab === "labour" ? (
                                <>
                                    {this.text("from", "From", "date")}
                                    {this.text("to", "To", "date")}
                                    {this.select(
                                        "reason",
                                        "Activity reasons",
                                        options(["plannedWork", "rework", "defectResolution", "changeWork", "standby", "other"]),
                                    )}
                                    <TriCheckbox
                                        valueEmitter={this.semanticField("overtime")}
                                        label="Overtime only"
                                    />
                                </>
                            ) : (
                                this.select("material", "Materials", b?.choices.materials ?? [])
                            )}
                        </Toolbar>

                        {tab === "people" ? (
                            <>
                                <ListView
                                    items={this.rows}
                                    itemKey="id"
                                    label="People"
                                    selectedItemEmitter={this.state.selection}
                                    renderItem={row => <RecordCard row={row}/>}
                                />
                                {this.pager(result)}
                            </>
                        ) : (
                            this.table(tableFields, result)
                        )}
                        {this.selected(result)}
                    </>,
                )}
            </Panel>
        );
    }
}
