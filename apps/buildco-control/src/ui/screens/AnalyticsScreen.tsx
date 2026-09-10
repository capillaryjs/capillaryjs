import { Panel, Toolbar } from "@sylwellsoftware/fray";
import type { FrayChild } from "@sylwellsoftware/fray";
import type { ViewResult } from "../../app/contract.ts";
import { Metrics } from "../shared.tsx";
import { Analytics } from "../visuals.tsx";
import { ScreenView, options } from "./base.tsx";

export class AnalyticsScreen extends ScreenView {
  protected renderContent(result?: ViewResult): FrayChild {
    const trends = this.field("tab").get() === "trends";

    return (
      <Panel island>
        {this.tabs(
          [
            ["distribution", "Distribution"],
            ["trends", "Trends"],
          ],
          <>
            <Toolbar label="Analytics filters">
              {this.project()}
              {trends ? (
                this.select("metric", "Metric group", options(["progress", "labour", "materials", "quality", "schedule", "cost"]), false)
              ) : (
                this.select("subject", "Subject", options(["phases", "labour", "materials", "issues", "delays"]), false)
              )}

              {trends && (
                <label className="range-control">
                  History · {this.read(this.field("days"))} days
                  <input
                    aria-label="History window"
                    type="range"
                    min="14"
                    max="365"
                    step="7"
                    value={this.field("days").get()}
                    onInput={(e: Event) => this.field("days").set((e.target as HTMLInputElement).value)}
                  />
                </label>
              )}
            </Toolbar>

            <Metrics items={result?.metrics ?? []} />
            <Analytics
              key={trends ? "trends" : this.field("subject").get()}
              source={this.result}
              trends={trends}
            />
          </>,
        )}
      </Panel>
    );
  }
}
