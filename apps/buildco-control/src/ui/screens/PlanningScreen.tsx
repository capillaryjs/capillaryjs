import { Panel, Toolbar } from "@sylwellsoftware/fray";
import type { FrayChild } from "@sylwellsoftware/fray";
import type { ViewResult } from "../../app/contract.ts";
import { ScreenView, options } from "./base.tsx";

export class PlanningScreen extends ScreenView {
  protected renderContent(result?: ViewResult): FrayChild {
    return (
      <>
        <Panel island>
          <Toolbar label="Planning filters">
            {this.text("focus", "Focus date", "date")}
            {this.project()}
            {this.select("view", "View", options(["upcoming", "delayed", "blocked", "all"]), false)}
            <label className="range-control">
              Horizon · {this.read(this.field("horizon"))} days
              <input
                aria-label="Planning horizon"
                type="range"
                min="7"
                max="180"
                step="1"
                value={this.field("horizon").get()}
                onInput={(e: Event) => this.field("horizon").set((e.target as HTMLInputElement).value)}
              />
            </label>
            {this.check("critical", "Critical / at-risk only")}
          </Toolbar>
        </Panel>
        <Panel island header={<h2>Phase schedule</h2>}>
          {this.table(["name", "project", "status", "progress", "start", "finish", "forecast", "variance"], result)}
          {this.selected(result)}
        </Panel>
      </>
    );
  }
}
