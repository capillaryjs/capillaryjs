import type {FrayChild, Key} from "@sylwellsoftware/fray";
import {
    Component, ListView, Panel, Sidebar, SidebarToolbar, SplitPrimary, SplitSecondary, SplitView,
    Dropdown, Button, RouteLink, RouteOutlet, Placeholder, routeTarget, routeParameter, withRouteQuery,
} from "@sylwellsoftware/fray";
import {
    BlockGraph, CategoryHidePanel, SplitSelectionPanel,
    derivedCriterion, createBlockSelection, createSplitSelection, filterByHidden,
} from "@sylwellsoftware/fray-visualization";
import type {GroupingCriterion} from "@sylwellsoftware/fray-visualization";
import {DerivedEmitter, Emitter} from "@sylwellsoftware/glue";
import type {ReadableEmitter} from "@sylwellsoftware/glue";
import type {Row} from "../../api/ScenarioApi.ts";
import {human} from "../../api/ScenarioApi.ts";
import {screens, routes, issuesSegment, issueIdParam} from "../../app/routing.ts";
import {buildco, revision, bootstrap} from "../../app/services.ts";
import {formatValue} from "../shared.tsx";
import {IssueReportView} from "../IssueReportView/IssueReportView.tsx";

const palette: readonly (readonly [string, string, string])[] = [
    ['#194d84', '#2f76bd', '#6eaae5'],
    ['#006c62', '#099b8d', '#52c9bd'],
    ['#446615', '#6a9925', '#a5ca6f'],
    ['#7a1717', '#b72c2c', '#e47676'],
    ['#744300', '#b56c0c', '#e6ad5d'],
    ['#493371', '#7958aa', '#b398d7'],
    ['#006076', '#078da8', '#69c6d8'],
    ['#68421c', '#a76f32', '#deb079'],
];

function colorForKey(key: string): readonly [string, string, string] {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    return palette[Math.abs(hash) % palette.length]!;
}

const unmatchedColors: readonly [string, string, string] = ['#666666', '#999999', '#cccccc'];

function createCriteria(items$: ReadableEmitter<readonly Row[]>): readonly GroupingCriterion<Row>[] {
    return Object.freeze([
        derivedCriterion<Row>({
            key: 'project',
            label: 'Project',
            source$: items$,
            extractKeys: (row) => {
                const v = row.project ?? row.projectId;
                return v ? String(v) : null;
            },
            describe: (key) => ({label: human(key), colors: colorForKey(key)}),
            unmatched: {key: '__none__', label: 'Unmatched', colors: unmatchedColors},
        }),
        derivedCriterion<Row>({
            key: 'status',
            label: 'Status',
            source$: items$,
            extractKeys: (row) => {
                const v = row.status;
                return v ? String(v) : null;
            },
            describe: (key) => ({label: human(key), colors: colorForKey(key)}),
            unmatched: {key: '__none__', label: 'Unmatched', colors: unmatchedColors},
        }),
        derivedCriterion<Row>({
            key: 'cause',
            label: 'Cause',
            source$: items$,
            extractKeys: (row) => {
                const v = row.cause;
                return v ? String(v) : null;
            },
            describe: (key) => ({label: human(key), colors: colorForKey(key)}),
            unmatched: {key: '__none__', label: 'Unmatched', colors: unmatchedColors},
        }),
        derivedCriterion<Row>({
            key: 'type',
            label: 'Type',
            source$: items$,
            extractKeys: (row) => {
                const v = (row as Record<string, unknown>).type ?? (row as Record<string, unknown>).impactType;
                return v ? String(v) : null;
            },
            describe: (key) => ({label: human(key), colors: colorForKey(key)}),
            unmatched: {key: '__none__', label: 'Unmatched', colors: unmatchedColors},
        }),
    ]);
}

export class IssueAnalysisView extends Component {
    static dependencies = [
        ListView, Panel, Sidebar, SidebarToolbar, SplitView,
        Dropdown, Button, RouteLink, RouteOutlet, Placeholder,
        BlockGraph, CategoryHidePanel, SplitSelectionPanel,
        IssueReportView,
    ];

    private state = screens["issue-analysis"];
    private query = buildco.view("issue-analysis", {params: this.state.params, revision}, {owner: this});
    private readonly issueReportActive = new Emitter<Key | null>(null, {owner: this, purpose: 'issue report route active'});

    private items$ = new DerivedEmitter(
        [this.query] as const,
        ([result]) => Object.freeze([...((result as {rows?: readonly Row[]})?.rows ?? [])]) as readonly Row[],
        {owner: this, purpose: 'issue analysis items'},
    );

    private criteria = createCriteria(this.items$);
    private splitSelection = createSplitSelection(this.criteria, {
        active: ['project', 'status', 'cause'],
    });
    private filteredItems$ = filterByHidden(this.items$, this.criteria);
    private blockSelection = createBlockSelection(
        this.filteredItems$,
        this.splitSelection.activeSplits$,
        {rootLabel: 'All records', readabilityThreshold: 0.008},
    );

    initialize(): void {
        void this.query.activate();
    }

    onDestroy(): void {
        this.blockSelection.dispose();
        this.splitSelection.dispose();
        for (const criterion of this.criteria) criterion.dispose();
    }

    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        const view = this.snapshot(this.query);

        if (!b.value) return <Panel island header="Issue Analysis"><Placeholder/></Panel>;
        if (view.fetchState === "loading" && !view.value) return <Panel island header="Issue Analysis"><Placeholder/></Panel>;
        if (view.fetchState === "error" || !view.value) return <Panel island header="Issue Analysis"><Placeholder/></Panel>;

        const reportActive = this.snapshot(this.issueReportActive).value === "issues";
        if (reportActive) {
            return <RouteOutlet
                className="issue-analysis-view fray-size-flexible"
                mountPolicy="active-only"
                activeViewEmitter={this.issueReportActive}
                views={[
                    {id: "issues", route: issuesSegment, content: <IssueReportView/>},
                ]}
            />;
        }

        const subject = this.state.tab.get() ?? "issues";
        const isDelay = subject === "delays";
        const selectedItems = this.snapshot(this.blockSelection.selectedItems$).value;

        return <SplitView className="issue-analysis-view fray-size-flexible" primarySize="16rem" primaryLabel="Analysis controls" secondaryLabel="Issue distribution">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Issue Analysis">
                    <SidebarToolbar>
                        <Dropdown
                            label="Subject"
                            options={[
                                {value: "issues", label: "Issues"},
                                {value: "delays", label: "Delays"},
                            ]}
                            valueEmitter={this.state.field("tab") as any}
                        />
                        <Button
                            label="Reset"
                            onClick={() => {
                                this.blockSelection.clear();
                                for (const criterion of this.criteria) criterion.setAllVisible(true);
                            }}
                        />
                    </SidebarToolbar>
                    <SplitSelectionPanel
                        model={this.splitSelection}
                        label="Distribution groups"
                    />
                    <CategoryHidePanel
                        items$={this.items$}
                        criteria={this.criteria}
                        label="Visible categories"
                    />
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Distribution">
                    <BlockGraph
                        model={this.blockSelection}
                        label="Record distribution"
                        emptyMessage="No records match the current subject."
                    />
                    <ListView
                        label="Records in selected block"
                        items={selectedItems}
                        itemKey="id"
                        renderItem={r => {
                            const link = isDelay
                                ? <RouteLink to={withRouteQuery(routeTarget(routes.projects), {project: String(r.projectId ?? ""), phase: String(r.phaseId ?? ""), tab: r.phaseId ? "phases" : "summary"})}>
                                    {r.name}
                                </RouteLink>
                                : <RouteLink to={routeTarget(routes["issue-analysis"], issuesSegment, routeParameter(issueIdParam, String(r.id)))}>
                                    {r.name}
                                </RouteLink>;
                            return <span className="issue-item">
                                {link}
                                {r.status ? <span className="issue-item-status">{human(r.status)}</span> : null}
                                {r.cost != null && Number(r.cost) > 0 ? <span className="issue-item-cost">{formatValue(Number(r.cost), "money")}</span> : null}
                            </span>;
                        }}
                    />
                </Panel>
            </SplitSecondary>
        </SplitView>;
    }
}
