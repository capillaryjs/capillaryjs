import {DerivedEmitter, Emitter, FetchState} from '@sylwellsoftware/glue'
import {
    FilterMode,
    createLocalTableDataSource,
} from '@sylwellsoftware/fray'
import type {
    FilterModeValue,
    TableFilters,
    TableSort,
} from '@sylwellsoftware/fray'
import {
    SeriesBuilder,
    createBlockSelection,
    createSplitSelection,
    filterByHidden,
    staticCriterion,
} from '@sylwellsoftware/fray-visualization'
import type {
    GroupingCriterion,
    HistoryShape,
    LineGraphRange,
} from '@sylwellsoftware/fray-visualization'
import {changes} from './data.js'
import type {
    AttentionFilter,
    Change,
    ChangeRisk,
    DemoFetchState,
    PlanningHorizon,
    RiskFilterMap,
    RiskFocus,
    Scope,
    ScopeTreeKey,
    StatusFocus,
    WorkArea,
} from './types.js'

const horizonAnchor = Date.parse('2026-09-06T00:00:00Z')

const scopeByTreeKey: Readonly<Record<ScopeTreeKey, Scope>> = {
    all: 'all',
    'north-plant': 'north-plant',
    assembly: 'north-plant',
    packaging: 'north-plant',
    warehouse: 'warehouse',
    'south-plant': 'south-plant',
}

export class MeridianModel {
    readonly sourceChanges = new Emitter<readonly Change[], Error>(changes, {
        owner: this,
        purpose: 'Meridian source changes and demo fetch state',
    })
    readonly selectedScope = new Emitter<Scope>('all', {
        owner: this,
        purpose: 'Meridian organisational scope',
    })
    readonly selectedScopeKey = new Emitter<string | number | null>('all', {
        owner: this,
        purpose: 'Meridian selected organizational tree node',
    })
    readonly expandedScopeKeys = new Emitter<Array<string | number>>([
        'all',
        'north-plant',
    ], {
        owner: this,
        purpose: 'Meridian expanded organizational tree nodes',
    })
    readonly themeSelection = new Emitter('shiny', {
        owner: this,
        purpose: 'Meridian theme stylesheet selection',
    })
    readonly colorSelection = new Emitter('iceblue', {
        owner: this,
        purpose: 'Meridian color stylesheet selection',
    })
    readonly selectedChange = new Emitter<Change | null>(changes[0] ?? null, {
        owner: this,
        purpose: 'Meridian selected visible change',
    })
    readonly activeArea = new Emitter<WorkArea>('portfolio', {
        owner: this,
        purpose: 'Meridian active work area',
    })
    readonly statusFocus = new Emitter<StatusFocus>('all', {
        owner: this,
        purpose: 'Meridian change status focus',
    })
    readonly planningHorizon = new Emitter<PlanningHorizon>('90', {
        owner: this,
        purpose: 'Meridian portfolio planning horizon',
    })
    readonly registerSearch = new Emitter('', {
        owner: this,
        purpose: 'Meridian change register search',
    })
    readonly riskFocus = new Emitter<RiskFocus>('all', {
        owner: this,
        purpose: 'Meridian change register risk focus',
    })
    readonly attentionOnly = new Emitter<AttentionFilter>('all', {
        owner: this,
        purpose: 'Meridian attention-only filter',
    })
    readonly supplierFocus = new Emitter<FilterModeValue>(FilterMode.Prefer, {
        owner: this,
        purpose: 'Meridian supplier involvement preference',
    })
    readonly completedFocus = new Emitter<FilterModeValue>(FilterMode.Neutral, {
        owner: this,
        purpose: 'Meridian completed-change preference',
    })
    readonly safetyFocus = new Emitter<FilterModeValue>(FilterMode.Neutral, {
        owner: this,
        purpose: 'Meridian safety-impact filter',
    })
    readonly advancedRiskFilters = new Emitter<RiskFilterMap>(new Map(), {
        owner: this,
        purpose: 'Meridian advanced risk filters',
    })
    readonly advancedRiskFiltersOpen = new Emitter(false, {
        owner: this,
        purpose: 'Meridian advanced risk filters visibility',
    })
    readonly registerSort = new Emitter<TableSort | null>(null, {
        owner: this,
        purpose: 'Meridian register-only table sort',
    })
    readonly registerFilters = new Emitter<TableFilters>({}, {
        owner: this,
        purpose: 'Meridian register-only table filters',
    })
    readonly demoFetchState = new Emitter<DemoFetchState>('automatic', {
        owner: this,
        purpose: 'Review harness fetch-state override',
    })
    readonly forceDisabled = new Emitter(false, {
        owner: this,
        purpose: 'Review harness disabled override',
    })
    readonly forceRequired = new Emitter(false, {
        owner: this,
        purpose: 'Review harness required override',
    })
    readonly panelDisabled = new Emitter(false, {
        owner: this,
        purpose: 'Panel review disabled state',
    })
    readonly statusFocusError = new Emitter<string | null>(null, {
        owner: this,
        purpose: 'Toggle review error state',
    })
    readonly clearScopeDialogOpen = new Emitter(false, {
        owner: this,
        purpose: 'Meridian clear-scope confirmation',
    })
    readonly refreshing = new Emitter(false, {
        owner: this,
        purpose: 'Meridian real refresh activity',
    })
    readonly lastAction = new Emitter('Application ready', {
        owner: this,
        purpose: 'Review harness reactive consequence summary',
    })
    readonly historyStacked = new Emitter(false, {
        owner: this,
        purpose: 'Meridian history stacked-area presentation',
    })
    readonly historySmooth = new Emitter(false, {
        owner: this,
        purpose: 'Meridian history curve presentation',
    })

    readonly visibleChanges = new DerivedEmitter(
        [
            this.sourceChanges,
            this.selectedScope,
            this.statusFocus,
            this.planningHorizon,
            this.registerSearch,
            this.riskFocus,
            this.attentionOnly,
            this.supplierFocus,
            this.completedFocus,
            this.safetyFocus,
            this.advancedRiskFilters,
        ] as const,
        ([
            source,
            scope,
            status,
            horizon,
            search,
            risk,
            attentionOnly,
            supplier,
            completed,
            safety,
            advancedRisks,
        ]) => source.filter((change) =>
            (scope === 'all' || change.site === scope)
            && (status === 'all' || change.statusFocus === status)
            && fallsWithinHorizon(change, horizon)
            && matchesSearch(change, search)
            && (risk === 'all' || change.risk === risk)
            && (attentionOnly === 'all' || needsAttention(change))
            && permitsBooleanMode(change.supplierInvolvement, supplier)
            && permitsCompletedMode(change, completed)
            && permitsBooleanMode(change.safetyImpact, safety)
            && matchesAdvancedRisks(change, advancedRisks))
            .sort((left, right) =>
                comparePreference(left.supplierInvolvement, right.supplierInvolvement, supplier)
                || comparePreference(
                    left.statusFocus === 'completed',
                    right.statusFocus === 'completed',
                    completed,
                )
                || comparePreference(left.safetyImpact, right.safetyImpact, safety)
                || compareAdvancedRiskPreference(left, right, advancedRisks)),
        {
            owner: this,
            purpose: 'Meridian globally visible changes',
        },
    )
    readonly attentionChanges = new DerivedEmitter(
        [this.visibleChanges] as const,
        ([visible]) => visible.filter(needsAttention),
        {owner: this, purpose: 'Meridian attention queue'},
    )
    readonly groupingCriteria: readonly GroupingCriterion<Change>[] = createGroupingCriteria()
    readonly visualizationChanges = filterByHidden(this.visibleChanges, this.groupingCriteria)
    readonly splitSelection = createSplitSelection(this.groupingCriteria, {
        active: ['risk', 'lifecycle', 'site'],
        presets: [
            {key: 'risk-lifecycle', label: 'Risk → lifecycle', active: ['risk', 'lifecycle']},
            {key: 'site-type', label: 'Site → type', active: ['site', 'type']},
            {key: 'safety-supplier', label: 'Safety → supplier', active: ['safety', 'supplier']},
        ],
    })
    readonly blockSelection = createBlockSelection(
        this.visualizationChanges,
        this.splitSelection.activeSplits$,
        {rootLabel: 'Visible changes', readabilityThreshold: 0.008},
    )
    readonly historyRange = new DerivedEmitter<
        LineGraphRange,
        readonly [typeof this.planningHorizon]
    >(
        [this.planningHorizon] as const,
        ([horizon]) => ({
            minX: '2026-08-01',
            maxX: addDays('2026-09-06', Number(horizon)),
        }),
        {owner: this, purpose: 'Meridian history range from planning horizon'},
    )
    readonly historyShapes = new DerivedEmitter<
        readonly HistoryShape[],
        readonly [typeof this.visualizationChanges]
    >(
        [this.visualizationChanges] as const,
        ([visible]) => buildHistoryShapes(visible),
        {owner: this, purpose: 'Meridian in-flight risk history'},
    )
    readonly changeTable = createLocalTableDataSource<Change>({
        data: this.visibleChanges,
        sortEmitter: this.registerSort,
        filtersEmitter: this.registerFilters,
        owner: this,
    })

    private refreshTimer: ReturnType<typeof setTimeout> | null = null
    private readonly stopSelectionReconciliation: () => void
    private readonly stopScopeReconciliation: () => void

    constructor() {
        this.stopScopeReconciliation = this.selectedScope.subscribe(({value}) => {
            const selectedKey = this.selectedScopeKey.get()
            if (isScopeTreeKey(selectedKey) && scopeByTreeKey[selectedKey] === value) return
            this.selectedScopeKey.set(value, 'tree selection reconciled with scope')
        }, {emitCurrent: false})
        this.stopSelectionReconciliation = this.visibleChanges.subscribe(({value}) => {
            const selected = this.selectedChange.get()
            const retained = selected == null
                ? null
                : value.find((change) => change.id === selected.id) ?? null
            const next = retained ?? value[0] ?? null
            if (!Object.is(next, selected)) {
                this.selectedChange.set(next, 'selection reconciled with global filters')
            }
        }, {emitCurrent: true})
    }

    setDemoFetchState(mode: DemoFetchState): void {
        this.demoFetchState.set(mode, 'demo fetch state changed')
        this.applyDemoFetchState(mode)
        this.note(`Fetch-state override → ${mode}`)
    }

    replaceAdvancedRiskFilters(filters: ReadonlyMap<string | number, FilterModeValue>): void {
        const next = new Map<ChangeRisk, FilterModeValue>()
        for (const [value, state] of filters) {
            if (typeof value === 'string' && isChangeRisk(value)) next.set(value, state)
        }
        this.advancedRiskFilters.set(next, 'advanced risk filters changed')
        this.note('Advanced risk policy changed')
    }

    selectScopeNode(key: ScopeTreeKey, scope: Scope): void {
        this.selectedScopeKey.set(key, 'organizational tree node selected')
        this.selectedScope.set(scope, 'organizational scope selected')
        this.note(`Scope → ${scope}`)
    }

    clearScopeFilters(): void {
        this.selectedScope.set('all', 'scope filters cleared')
        this.statusFocus.set('all', 'scope filters cleared')
        this.clearScopeDialogOpen.set(false, 'scope filters cleared')
        this.note('Scope and status filters cleared')
    }

    clearRegisterFilters(): void {
        this.registerSearch.set('', 'register filters cleared')
        this.riskFocus.set('all', 'register filters cleared')
        this.attentionOnly.set('all', 'register filters cleared')
        this.supplierFocus.set(FilterMode.Neutral, 'register filters cleared')
        this.completedFocus.set(FilterMode.Neutral, 'register filters cleared')
        this.safetyFocus.set(FilterMode.Neutral, 'register filters cleared')
        this.advancedRiskFilters.set(new Map(), 'register filters cleared')
        this.registerFilters.set({}, 'register filters cleared')
        this.registerSort.set(null, 'register filters cleared')
        this.note('Register filters and table state cleared')
    }

    selectNextCritical(): void {
        const critical = this.visibleChanges.get().filter((change) => change.risk === 'Critical')
        if (critical.length === 0) {
            this.note('No critical change is visible')
            return
        }
        const currentIndex = critical.findIndex((change) =>
            change.id === this.selectedChange.get()?.id)
        const next = critical[(currentIndex + 1) % critical.length]!
        this.selectedChange.set(next, 'next critical change selected')
        this.note(`Selected ${next.id}`)
    }

    refreshData(): void {
        if (this.refreshTimer != null) return
        this.refreshing.set(true, 'refresh requested')
        this.sourceChanges.setWithState(
            this.sourceChanges.get(),
            FetchState.Loading,
            null,
            'refresh requested',
        )
        this.note('Refreshing the shared change population')
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null
            this.refreshing.set(false, 'refresh completed')
            this.applyDemoFetchState(this.demoFetchState.get())
            this.note('Shared change population refreshed')
        }, 900)
    }

    note(message: string): void {
        this.lastAction.set(message, 'reactive consequence recorded')
    }

    dispose(): void {
        if (this.refreshTimer != null) clearTimeout(this.refreshTimer)
        this.stopScopeReconciliation()
        this.stopSelectionReconciliation()
        this.changeTable.dispose()
        this.blockSelection.dispose()
        this.splitSelection.dispose()
        this.historyShapes.dispose()
        this.historyRange.dispose()
        this.visualizationChanges.dispose()
        for (const criterion of this.groupingCriteria) criterion.dispose()
        this.attentionChanges.dispose()
        this.visibleChanges.dispose()
        for (const emitter of [
            this.sourceChanges,
            this.selectedScope,
            this.selectedScopeKey,
            this.expandedScopeKeys,
            this.themeSelection,
            this.colorSelection,
            this.selectedChange,
            this.activeArea,
            this.statusFocus,
            this.planningHorizon,
            this.registerSearch,
            this.riskFocus,
            this.attentionOnly,
            this.supplierFocus,
            this.completedFocus,
            this.safetyFocus,
            this.advancedRiskFilters,
            this.advancedRiskFiltersOpen,
            this.registerSort,
            this.registerFilters,
            this.demoFetchState,
            this.forceDisabled,
            this.forceRequired,
            this.panelDisabled,
            this.statusFocusError,
            this.clearScopeDialogOpen,
            this.refreshing,
            this.lastAction,
            this.historyStacked,
            this.historySmooth,
        ]) emitter.dispose()
    }

    private applyDemoFetchState(mode: DemoFetchState): void {
        const retained = mode === 'initial' ? [] : this.sourceChanges.get()
        if (mode === 'initial') {
            this.sourceChanges.setWithState(retained, FetchState.Initial, null, 'forced initial')
        } else if (mode === 'loading') {
            this.sourceChanges.setWithState(retained, FetchState.Loading, null, 'forced loading')
        } else if (mode === 'error') {
            this.sourceChanges.setWithState(
                retained,
                FetchState.Error,
                new Error('Review harness forced a data error.'),
                'forced error',
            )
        } else {
            this.sourceChanges.setWithState(changes, FetchState.Ready, null, 'ready data restored')
        }
    }
}

function fallsWithinHorizon(change: Change, horizon: PlanningHorizon): boolean {
    const maximum = horizonAnchor + Number(horizon) * 24 * 60 * 60 * 1000
    return Date.parse(`${change.plannedStart}T00:00:00Z`) <= maximum
}

function matchesSearch(change: Change, search: string): boolean {
    const normalized = search.trim().toLocaleLowerCase()
    return normalized.length === 0 || [change.id, change.title, change.summary, change.owner]
        .some((value) => value.toLocaleLowerCase().includes(normalized))
}

function needsAttention(change: Change): boolean {
    return change.statusFocus !== 'completed' && change.risk !== 'Low'
}

function permitsBooleanMode(matches: boolean, mode: FilterModeValue): boolean {
    if (mode === FilterMode.Deny) return !matches
    if (mode === FilterMode.Require) return matches
    return true
}

function permitsCompletedMode(change: Change, mode: FilterModeValue): boolean {
    return permitsBooleanMode(change.statusFocus === 'completed', mode)
}

function matchesAdvancedRisks(change: Change, filters: RiskFilterMap): boolean {
    const state = filters.get(change.risk) ?? FilterMode.Neutral
    if (state === FilterMode.Deny) return false
    const hasRequired = [...filters.values()].some((value) => value === FilterMode.Require)
    return !hasRequired || state === FilterMode.Require
}

function comparePreference(left: boolean, right: boolean, mode: FilterModeValue): number {
    return mode === FilterMode.Prefer ? Number(right) - Number(left) : 0
}

function compareAdvancedRiskPreference(
    left: Change,
    right: Change,
    filters: RiskFilterMap,
): number {
    return Number(filters.get(right.risk) === FilterMode.Prefer)
        - Number(filters.get(left.risk) === FilterMode.Prefer)
}

function isChangeRisk(value: string): value is ChangeRisk {
    return changes.some((change) => change.risk === value)
}

function isScopeTreeKey(value: string | number | null): value is ScopeTreeKey {
    return typeof value === 'string' && value in scopeByTreeKey
}

const riskColors = {
    Critical: ['#9d1f91', '#c43cb5', '#db3ddb'],
    High: ['#b70909', '#ee0505', '#ff4040'],
    Medium: ['#cc6900', '#ff9100', '#ffa800'],
    Low: ['#258a00', '#29bd00', '#55d000'],
} as const

function createGroupingCriteria(): readonly GroupingCriterion<Change>[] {
    return Object.freeze([
        staticCriterion<Change>({
            key: 'risk',
            label: 'Risk',
            categories: (['Critical', 'High', 'Medium', 'Low'] as const).map((risk) => ({
                key: risk.toLocaleLowerCase(),
                label: risk,
                colors: riskColors[risk],
                predicate: (change) => change.risk === risk,
            })),
        }),
        staticCriterion<Change>({
            key: 'lifecycle',
            label: 'Lifecycle',
            categories: [
                category('planned', 'Planned', ['#194d84', '#2f76bd', '#6eaae5'],
                    (change) => change.statusFocus === 'planned'),
                category('active', 'Active', ['#006c62', '#099b8d', '#52c9bd'],
                    (change) => change.statusFocus === 'active'),
                category('completed', 'Completed', ['#446615', '#6a9925', '#a5ca6f'],
                    (change) => change.statusFocus === 'completed'),
            ],
        }),
        staticCriterion<Change>({
            key: 'site',
            label: 'Site',
            categories: [
                category('north-plant', 'North Plant', ['#006076', '#078da8', '#69c6d8'],
                    (change) => change.site === 'north-plant'),
                category('warehouse', 'Warehouse', ['#68421c', '#a76f32', '#deb079'],
                    (change) => change.site === 'warehouse'),
                category('south-plant', 'South Plant', ['#493371', '#7958aa', '#b398d7'],
                    (change) => change.site === 'south-plant'),
            ],
        }),
        staticCriterion<Change>({
            key: 'type',
            label: 'Work type',
            categories: ([
                ['Safety', ['#7a1717', '#b72c2c', '#e47676']],
                ['Machinery', ['#744300', '#b56c0c', '#e6ad5d']],
                ['Facilities', ['#2e5a19', '#4f8e32', '#8bc16f']],
                ['Procedure', ['#164e64', '#277a98', '#71b5cc']],
                ['Organisation', ['#44306b', '#7151a1', '#aa91cf']],
                ['Digital', ['#1f3d78', '#3868b0', '#7ba2dd']],
                ['Utilities', ['#6d6513', '#9c9224', '#d2ca75']],
                ['Compliance', ['#6e285b', '#a34887', '#d68abb']],
            ] as const).map(([type, colors]) => category(
                type.toLocaleLowerCase(),
                type,
                colors,
                (change) => change.type === type,
            )),
        }),
        staticCriterion<Change>({
            key: 'supplier',
            label: 'Supplier',
            categories: [
                category('external', 'External supplier', ['#78530c', '#b68219', '#e6bd61'],
                    (change) => change.supplierInvolvement),
                category('internal', 'Internal team', ['#165b63', '#278b96', '#73c0c7'],
                    (change) => !change.supplierInvolvement),
            ],
        }),
        staticCriterion<Change>({
            key: 'safety',
            label: 'Safety impact',
            categories: [
                category('safety', 'Safety impact', ['#781f2d', '#b3374a', '#e37f8f'],
                    (change) => change.safetyImpact),
                category('operational', 'Operational only', ['#245678', '#3c83b2', '#82b8d8'],
                    (change) => !change.safetyImpact),
            ],
        }),
    ])
}

function category(
    key: string,
    label: string,
    colors: readonly [string, string, string],
    predicate: (change: Change) => boolean,
) {
    return {key, label, colors, predicate}
}

function buildHistoryShapes(items: readonly Change[]): readonly HistoryShape[] {
    const builder = new SeriesBuilder((['Critical', 'High', 'Medium', 'Low'] as const)
        .map((risk) => ({
            key: risk.toLocaleLowerCase(),
            label: risk,
            color: riskColors[risk][1],
        })))
    for (const change of items) {
        const key = change.risk.toLocaleLowerCase()
        builder.addOne(change.plannedStart, key)
        builder.removeOne(change.plannedCompletion, key)
    }
    return builder.buildCumulative()
}

function addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
}
