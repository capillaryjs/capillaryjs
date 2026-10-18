import type {CapillaryUiChild} from "@capillaryjs/capillary-ui";
import {Panel, Toolbar} from "@capillaryjs/capillary-ui";
import type {ViewResult} from "../../api/ScenarioApi.ts";
import {Metrics} from "../shared/ViewComponents.tsx";
import {Analytics} from "./Analytics.tsx";
import {options, ScreenView} from "../shared/ScreenView.tsx";
import {RangeFilter} from "../shared/RangeFilter.tsx";

export class AnalyticsScreen extends ScreenView {
    static override dependencies = [RangeFilter]

    protected renderContent(result?: ViewResult): CapillaryUiChild {
        const trends = this.field("tab").get() === "trends";

        return (
            <Panel island allocation="flexible">
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
                                <RangeFilter label="History" unit="days" valueEmitter={this.field("days")} min={14} max={365} step={7}/>
                            )}
                        </Toolbar>

                        <Metrics items={result?.metrics ?? []}/>
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
