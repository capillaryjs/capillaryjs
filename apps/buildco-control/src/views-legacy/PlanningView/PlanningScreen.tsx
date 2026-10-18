import type {CapillaryUiChild} from "@capillaryjs/capillary-ui";
import {Panel, Toolbar} from "@capillaryjs/capillary-ui";
import type {ViewResult} from "../../api/ScenarioApi.ts";
import {options, ScreenView} from "../shared/ScreenView.tsx";
import {RangeFilter} from "../shared/RangeFilter.tsx";

export class PlanningScreen extends ScreenView {
    static override dependencies = [RangeFilter]

    protected renderContent(result?: ViewResult): CapillaryUiChild {
        return (
            <div className="cap-layout-vertical cap-size-flexible">
                <Panel island allocation="natural">
                    <Toolbar label="Planning filters">
                        {this.text("focus", "Focus date", "date")}
                        {this.project()}
                        {this.select("view", "View", options(["upcoming", "delayed", "blocked", "all"]), false)}
                        <RangeFilter label="Horizon" unit="days" valueEmitter={this.field("horizon")} min={7} max={180} step={1}/>
                        {this.check("critical", "Critical / at-risk only")}
                    </Toolbar>
                </Panel>
                <Panel island allocation="flexible" header={<h2>Phase schedule</h2>}>
                    {this.table(["name", "project", "status", "progress", "start", "finish", "forecast", "variance"], result)}
                    {this.selected(result)}
                </Panel>
            </div>
        );
    }
}
