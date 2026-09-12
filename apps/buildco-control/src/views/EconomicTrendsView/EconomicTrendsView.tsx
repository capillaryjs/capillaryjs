import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Component, Layout, Panel, PanelToolbar, Dropdown, DatePicker, RadioGroup, Toggle,
    RouteQuery, Placeholder, Toolbar, stringRouteQueryCodec,
} from "@sylwellsoftware/fray";
import {LineGraph} from "@sylwellsoftware/fray-visualization";
import type {HistoryShape} from "@sylwellsoftware/fray-visualization";
import {Emitter} from "@sylwellsoftware/glue";
import {screens} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";

export class EconomicTrendsView extends Component {
    static dependencies = [
        Layout, Panel, PanelToolbar, Dropdown, DatePicker, RadioGroup, Toggle,
        RouteQuery, LineGraph, Placeholder, Toolbar,
    ];

    private state = screens["economic-trends"];
    private query = buildco.view("economic-trends", {params: this.state.params, revision}, {owner: this});

    private readonly stacked = this.state.field("stacked").map(v => v === "true");
    private readonly smooth = this.state.field("smooth").map(v => v !== "false");
    private readonly shapes = new Emitter<readonly HistoryShape[]>([], {owner: this, purpose: "chart shapes"});
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
        if (this.shapes.get() !== series) this.shapes.set(series);

        return <Layout className="economic-trends-view fray-size-flexible" vertical>
            <RouteQuery name="project" codec={stringRouteQueryCodec} valueEmitter={this.state.field("project")} defaultValue=""/>
            <RouteQuery name="metric" codec={stringRouteQueryCodec} valueEmitter={this.state.field("metric")} defaultValue="progress"/>
            <RouteQuery name="from" codec={stringRouteQueryCodec} valueEmitter={this.state.field("from")} defaultValue=""/>
            <RouteQuery name="stacked" codec={stringRouteQueryCodec} valueEmitter={this.state.field("stacked")} defaultValue="false"/>
            <RouteQuery name="smooth" codec={stringRouteQueryCodec} valueEmitter={this.state.field("smooth")} defaultValue="true"/>
            <Panel island allocation="flexible" header="Economic Trends">
                <PanelToolbar>
                    <Toolbar label="Trend controls">
                    <Dropdown
                        label="Project"
                        options={[{value: "", label: "All projects"}, ...(b.value.choices.projects ?? [])]}
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
                    </Toolbar>
                </PanelToolbar>
                <LineGraph
                    label={v.chartLabel ?? "Economic trends"}
                    shapes$={this.shapes}
                    stacked$={this.stacked}
                    smooth$={this.smooth}
                    range$={this.rangeEmitter}
                    emptyMessage="No trend data available for the selected project and metric."
                />
                {v.notice && <p className="muted chart-notice">{v.notice}</p>}
            </Panel>
        </Layout>;
    }
}
