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
    StatusFocus,
    WorkArea,
} from './types.js'

const horizonAnchor = Date.parse('2026-09-06T00:00:00Z')

export class MeridianModel {
    readonly sourceChanges = new Emitter<readonly Change[], Error>(changes, {
        owner: this,
        purpose: 'Meridian source changes and demo fetch state',
    })
    readonly selectedScope = new Emitter<Scope>('all', {
        owner: this,
        purpose: 'Meridian organisational scope',
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
    readonly changeTable = createLocalTableDataSource<Change>({
        data: this.visibleChanges,
        sortEmitter: this.registerSort,
        filtersEmitter: this.registerFilters,
        owner: this,
    })

    private refreshTimer: ReturnType<typeof setTimeout> | null = null
    private readonly stopSelectionReconciliation: () => void

    constructor() {
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
        this.stopSelectionReconciliation()
        this.changeTable.dispose()
        this.attentionChanges.dispose()
        this.visibleChanges.dispose()
        for (const emitter of [
            this.sourceChanges,
            this.selectedScope,
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
