import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, Layout, Panel, PanelToolbar, Dropdown, DatePicker, RadioGroup, Toggle,
    Placeholder,
} from "@sylwellsoftware/fray";
import {LineGraph} from "@sylwellsoftware/fray-visualization";
import type {HistoryShape} from "@sylwellsoftware/fray-visualization";
import {Emitter} from "@sylwellsoftware/glue";
import {screens} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";

export class EconomicTrendsView extends Component {
    static dependencies = [
        Layout, Panel, PanelToolbar, Dropdown, DatePicker, RadioGroup, Toggle,
        LineGraph, Placeholder,
    ];

    private state = screens["economic-trends"];
    private query = buildco.view("economic-trends", {params: this.state.params, revision}, {owner: this});

    private readonly stackedEmitter = new Emitter<boolean>(false, {owner: this, purpose: "stacked"});
    private readonly smoothEmitter = new Emitter<boolean>(true, {owner: this, purpose: "smooth"});
    private readonly rangeEmitter = new Emitter<{minX?: string; maxX?: string; minY?: number; maxY?: number}>({}, {owner: this, purpose: "range"});

    initialize(): void {
        void this.query.activate();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Economic Trends"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Economic Trends"><Placeholder/></Panel>;
        if (view.fetchState === "error" || !view.value) return <Panel island header="Economic Trends"><Placeholder/></Panel>;

        const v = view.value;
        const series = (v.series ?? []) as readonly HistoryShape[];
        const shapesEmitter = new Emitter<readonly HistoryShape[]>(series, {owner: this, purpose: "chart shapes"});

        return <Layout className="economic-trends-view fray-size-flexible" vertical>
            <Panel island allocation="flexible" header="Economic Trends">
                <PanelToolbar>
                    <Dropdown
                        label="Project"
                        options={[{value: "", label: "All projects"}]}
                        valueEmitter={this.state.field("project") as any}
                    />
                    <Dropdown
                        label="Metric"
                        options={[
                            {value: "progress", label: "Progress"},
                            {value: "labour", label: "Labour"},
                            {value: "materials", label: "Materials"},
                            {value: "schedule", label: "Schedule"},
                            {value: "cost", label: "Cost"},
                            {value: "quality", label: "Quality"},
                        ]}
                        valueEmitter={this.state.field("metric") as any}
                    />
                    <DatePicker
                        label="From"
                        valueEmitter={this.state.field("from") as any}
                    />
                    <RadioGroup
                        label="Chart mode"
                        options={[
                            ["false", "Individual lines"],
                            ["true", "Stacked area"],
                        ]}
                        valueEmitter={this.state.field("stacked") as any}
                    />
                    <Toggle
                        label="Rendering"
                        options={[
                            ["true", "Smooth"],
                            ["false", "Step"],
                        ]}
                        valueEmitter={this.state.field("smooth") as any}
                    />
                </PanelToolbar>
                <LineGraph
                    label={v.chartLabel ?? "Economic trends"}
                    shapes$={shapesEmitter}
                    stacked$={this.stackedEmitter}
                    smooth$={this.smoothEmitter}
                    range$={this.rangeEmitter}
                    emptyMessage="No trend data available for the selected project and metric."
                />
                {v.notice && <p className="muted chart-notice">{v.notice}</p>}
            </Panel>
        </Layout>;
    }
}
