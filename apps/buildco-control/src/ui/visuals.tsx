import type {ComponentProps, FrayChild} from "@sylwellsoftware/fray";
import {Button, Checkbox, Component, ListView, Toolbar} from "@sylwellsoftware/fray";
import type {ReadableEmitter} from "@sylwellsoftware/glue";
import {DerivedEmitter, Emitter} from "@sylwellsoftware/glue";
import type {LineGraphRange} from "@sylwellsoftware/fray-visualization";
import {
    BlockGraph,
    CategoryHidePanel,
    createBlockSelection,
    createSplitSelection,
    derivedCriterion,
    filterByHidden,
    LineGraph,
    SplitSelectionPanel
} from "@sylwellsoftware/fray-visualization";
import type {Row, ViewResult} from "../app/contract.ts";
import {RecordCard} from "./shared.tsx";
import {openProject} from "./session.ts";

const costScale = (value?: ViewResult): number => value?.chartUnit === "DKK" && (value.series ?? []).some(s => Object.values(s.values).some(v => Math.abs(v) >= 1_000_000)) ? 1_000_000 : 1;

export class Analytics extends Component<ComponentProps & {
    source: ReadableEmitter<ViewResult | undefined>;
    trends: boolean
}> {
    private items = new DerivedEmitter([this.props.source] as const, ([value]) => value?.chartItems ?? []);
    private series = new DerivedEmitter([this.props.source] as const, ([value]) => (value?.series ?? []).map(series => ({
        ...series,
        values: Object.fromEntries(Object.entries(series.values).map(([date, n]) => [date, n / costScale(value)]))
    })));
    private range = new DerivedEmitter([this.props.source] as const, ([value]): LineGraphRange => {
        const dates = [...new Set((value?.series ?? []).flatMap(s => Object.keys(s.values)))].sort();
        return dates.length ? {minX: dates[0]!, maxX: dates.at(-1)!} : {};
    });
    private criteria = ["project", "category", "classification"].map(key => derivedCriterion<Row>({
        key,
        label: key === "classification" ? "Status / severity" : key === "project" ? "Project" : "Category",
        source$: this.items,
        extractKeys: row => String(row[key] || "Unclassified"),
        describe: label => {
            const hue = [...label].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 0);
            return {label, colors: [`hsl(${hue} 30% 27%)`, `hsl(${hue} 30% 52%)`, `hsl(${hue} 34% 86%)`]};
        }
    }));
    private filtered = filterByHidden(this.items, this.criteria);
    private splits = createSplitSelection(this.criteria, {
        active: ["project", "classification"], presets: [
            {key: "portfolio", label: "Portfolio health", active: ["project", "classification"]},
            {key: "category", label: "Category first", active: ["category", "project"]},
            {key: "status", label: "Status first", active: ["classification", "category"]},
        ]
    });
    private block = createBlockSelection(this.filtered, this.splits.activeSplits$, {
        rootLabel: "All records",
        readabilityThreshold: 0.012
    });
    private page = new Emitter(0);
    private selected = new DerivedEmitter([this.block.selectedItems$, this.page] as const, ([items, page]) => items.slice(page * 30, (page + 1) * 30));
    private smooth = new Emitter("off");
    private stack = new Emitter("off");
    private smoothValue = this.smooth.map(v => v === "on");
    private stackValue = this.stack.map(v => v === "on");

    initialize(): void {
        for (const owned of [this.items, this.series, this.range, this.filtered, this.splits, this.block, this.page, this.selected, this.smooth, this.stack, this.smoothValue, this.stackValue, ...this.criteria]) this.onCleanup(() => owned.dispose());
        this.onCleanup(this.block.selectedPath$.subscribe(() => this.page.set(0), {emitCurrent: false}));
    }

    render(): FrayChild {
        const source = this.read(this.props.source);
        const unit = costScale(source) > 1 ? "million DKK" : source?.chartUnit ?? "—";
        if (this.props.trends) return <div className="trends">
            <div className="section-heading">
                <div><h2>{source?.chartLabel ?? "History"}</h2><p className="muted">{source?.notice} Units: {unit}.</p>
                </div>
                <Toolbar label="Chart display"><Checkbox label="Smooth lines" valueEmitter={this.smooth}
                                                         symbols={[["☐", "off"], ["✓", "on"]]}/><Checkbox
                    label="Stack series" valueEmitter={this.stack} symbols={[["☐", "off"], ["✓", "on"]]}/></Toolbar>
            </div>
            {this.read(this.stack) === "on" &&
                <p className="fetch-notice">Stacked display adds series together. Some metrics overlap; the top edge is
                    not a total.</p>}
            <LineGraph shapes$={this.series} smooth$={this.smoothValue} stacked$={this.stackValue} range$={this.range}
                       label={source?.chartLabel ?? "Operational history"}
                       formatValue={v => `${v.toLocaleString("en-GB", {maximumFractionDigits: costScale(source) > 1 ? 3 : 1})} ${unit}`}/>
        </div>;
        const count = this.read(this.block.selectedItems$).length, page = this.read(this.page),
            block = this.read(this.block.selectedBlock$);
        return <div className="distribution">
            <div className="analytics-controls">
                <details open>
                    <summary>Visible categories</summary>
                    <CategoryHidePanel items$={this.items} criteria={this.criteria}/></details>
                <details open>
                    <summary>Grouping & split order</summary>
                    <SplitSelectionPanel model={this.splits}/></details>
            </div>
            <div className="graph-area"><h2>Record distribution</h2><p className="muted">Area represents record count.
                Select a block to inspect the underlying records.</p><BlockGraph model={this.block}
                                                                                 label="Operational record distribution"/>
                <div className="section-heading"><h2>{block ? block.label : "Selected records"} <span
                    className="count">{count.toLocaleString()}</span></h2><Button label="Clear selection"
                                                                                  onClick={() => this.block.clear()}/>
                </div>
                {!block && <p className="selection-hint">Select a block above to see its records here.</p>}
                <ListView items={this.selected} itemKey="id" label="Selected chart records"
                          renderItem={row => <div><RecordCard row={row} compact/><Button label="Open context ↗"
                                                                                         onClick={() => openProject(row)}/>
                          </div>}/>
                {count > 30 && <div className="pager">
                    <span>{page * 30 + 1}–{Math.min(count, (page + 1) * 30)} of {count.toLocaleString()}</span><Button
                    label="Previous records" disabled={page === 0} onClick={() => this.page.set(page - 1)}/><Button
                    label="Next records" disabled={(page + 1) * 30 >= count} onClick={() => this.page.set(page + 1)}/>
                </div>}
            </div>
        </div>;
    }
}
