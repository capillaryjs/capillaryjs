import {DerivedEmitter, Emitter} from '@sylwellsoftware/glue'

import {FilterMode, createLocalTableDataSource} from '@sylwellsoftware/fray'
import type {
    CivilDate,
    DateTimeValue,
    FilterModeValue,
    FilterValue,
    Key,
    TableDataSource,
    TableFilters,
    TableSort,
    TimeString,
} from '@sylwellsoftware/fray'
import {
    SeriesBuilder,
    createBlockSelection,
    createSplitSelection,
    filterByHidden,
    staticCriterion,
} from '@sylwellsoftware/fray-visualization'
import type {
    BlockSelectionModel,
    CategoryColors,
    GroupingCriterion,
    HistoryShape,
    LineGraphRange,
    SplitSelectionModel,
} from '@sylwellsoftware/fray-visualization'

import {historyRangeEnd, historyRangeStart, serviceOwners, services} from './data.js'
import type {
    ActiveState,
    AttentionFocus,
    FormSubmission,
    LayoutVariant,
    OwnerFocus,
    ServiceOwner,
    ServiceRecord,
    ServiceStatus,
    ServiceTier,
} from './types.js'

export interface GridCriterionOption {
    readonly value: string
    readonly label: string
    readonly matches: (service: ServiceRecord) => boolean
}

/** Semantic criteria offered by the data-grid FilterPanel. */
export const gridCriterionOptions: readonly GridCriterionOption[] = Object.freeze([
    {
        value: 'critical',
        label: 'Critical tier',
        matches: (service) => service.tier === 'Critical',
    },
    {
        value: 'attention',
        label: 'Needs attention',
        matches: (service) => service.status === 'Attention',
    },
    {
        value: 'external',
        label: 'Payments owned',
        matches: (service) => service.owner === 'Payments',
    },
    {
        value: 'europe',
        label: 'European region',
        matches: (service) => service.region === 'EU',
    },
])

const historyRange: LineGraphRange = {
    minX: historyRangeStart,
    maxX: historyRangeEnd,
}

const statusCategories = [
    {key: 'ready', label: 'Ready', color: '#148f77'},
    {key: 'review', label: 'Review', color: '#b7950b'},
    {key: 'attention', label: 'Attention', color: '#b03a2e'},
] as const

const ownerCategoryColors: readonly CategoryColors[] = [
    ['#eaf2f8', '#85c1e9', '#2874a6'],
    ['#e8f8f5', '#76d7c4', '#148f77'],
    ['#f4ecf7', '#bb8fce', '#7d3c98'],
    ['#fbeee6', '#f0b27a', '#b9770e'],
]

/** Central reactive model for the component gallery. */
export class GalleryModel {
    readonly layoutVariant = new Emitter<LayoutVariant>('shell', {
        owner: this,
        purpose: 'layout variant',
    })
    readonly activePage = new Emitter<Key | null>('data-grid', {
        owner: this,
        purpose: 'active gallery page',
    })
    readonly themeSelection = new Emitter('shiny', {
        owner: this,
        purpose: 'theme selection',
    })
    readonly colorSelection = new Emitter('iceblue', {
        owner: this,
        purpose: 'color selection',
    })
    readonly lastAction = new Emitter('Gallery ready', {
        owner: this,
        purpose: 'status message',
    })

    /** Unfiltered service catalog shared by every page. */
    readonly serviceCatalog = new Emitter<readonly ServiceRecord[]>(services, {
        owner: this,
        purpose: 'service catalog',
    })

    // Data grid page
    readonly gridSearch = new Emitter('', {owner: this, purpose: 'grid search'})
    readonly gridOwner = new Emitter<OwnerFocus>('all', {
        owner: this,
        purpose: 'grid owner focus',
    })
    readonly gridAttention = new Emitter<AttentionFocus>('all', {
        owner: this,
        purpose: 'grid attention focus',
    })
    readonly gridReadyOnly = new Emitter(false, {
        owner: this,
        purpose: 'grid ready-only flag',
    })
    readonly gridCriteria = new Emitter<ReadonlyMap<FilterValue, FilterModeValue>>(
        new Map(),
        {owner: this, purpose: 'grid semantic criteria'},
    )
    readonly gridSort = new Emitter<TableSort | null>(null, {
        owner: this,
        purpose: 'grid sort',
    })
    readonly gridFilters = new Emitter<TableFilters>({}, {
        owner: this,
        purpose: 'grid column filters',
    })
    readonly gridSelection = new Emitter<ServiceRecord | null>(services[0] ?? null, {
        owner: this,
        purpose: 'grid selection',
    })
    readonly gridRows: DerivedEmitter<readonly ServiceRecord[], readonly [
        typeof this.serviceCatalog,
        typeof this.gridSearch,
        typeof this.gridOwner,
        typeof this.gridAttention,
        typeof this.gridReadyOnly,
        typeof this.gridCriteria,
    ]>
    readonly gridTable: TableDataSource<ServiceRecord>

    // Explorer page
    readonly explorerScope = new Emitter<string>('all', {
        owner: this,
        purpose: 'explorer scope',
    })
    readonly treeSelectedKey = new Emitter<string | number | null>('all', {
        owner: this,
        purpose: 'explorer tree selection',
    })
    readonly treeExpandedKeys = new Emitter<(string | number)[]>(['all'], {
        owner: this,
        purpose: 'explorer tree expansion',
    })
    readonly explorerStacked = new Emitter(false, {
        owner: this,
        purpose: 'explorer stacked history',
    })
    readonly explorerSmooth = new Emitter(true, {
        owner: this,
        purpose: 'explorer smooth curves',
    })
    readonly explorerRows: DerivedEmitter<readonly ServiceRecord[], readonly [
        typeof this.serviceCatalog,
        typeof this.explorerScope,
    ]>
    readonly explorerShapes: DerivedEmitter<readonly HistoryShape[], readonly [
        typeof this.explorerRows,
    ]>
    readonly explorerRange = new Emitter<LineGraphRange>(historyRange, {
        owner: this,
        purpose: 'explorer history range',
    })

    // Directory page
    readonly directorySelection = new Emitter<ServiceRecord | null>(
        services[0] ?? null,
        {owner: this, purpose: 'directory selection'},
    )
    readonly directoryRows: DerivedEmitter<readonly ServiceRecord[], readonly [
        typeof this.serviceCatalog,
        typeof this.directorySelection,
    ]>
    readonly directoryTable: TableDataSource<ServiceRecord>
    readonly directoryDialogOpen = new Emitter(false, {
        owner: this,
        purpose: 'directory dialog',
    })

    // Analytics page
    readonly groupingCriteria: readonly GroupingCriterion<ServiceRecord>[]
    readonly visibleServices: DerivedEmitter<readonly ServiceRecord[]>
    readonly splitSelection: SplitSelectionModel<ServiceRecord>
    readonly blockSelection: BlockSelectionModel<ServiceRecord>
    readonly analyticsStacked = new Emitter(true, {
        owner: this,
        purpose: 'analytics stacked history',
    })
    readonly analyticsSmooth = new Emitter(true, {
        owner: this,
        purpose: 'analytics smooth curves',
    })
    readonly analyticsShapes: DerivedEmitter<readonly HistoryShape[], readonly [
        typeof this.visibleServices,
    ]>
    readonly analyticsRange = new Emitter<LineGraphRange>(historyRange, {
        owner: this,
        purpose: 'analytics history range',
    })

    // Forms page
    readonly formName = new Emitter('Atlas gateway', {
        owner: this,
        purpose: 'form name',
    })
    readonly formOwner = new Emitter<ServiceOwner>('Platform', {
        owner: this,
        purpose: 'form owner',
    })
    readonly formTier = new Emitter<ServiceTier>('Standard', {
        owner: this,
        purpose: 'form tier',
    })
    readonly formStatus = new Emitter<ServiceStatus>('Ready', {
        owner: this,
        purpose: 'form status',
    })
    readonly formActive = new Emitter<ActiveState>('active', {
        owner: this,
        purpose: 'form active state',
    })
    readonly formSemantics = new Emitter<FilterModeValue>(FilterMode.Neutral, {
        owner: this,
        purpose: 'form tri-state semantics',
    })
    readonly formApproval = new Emitter<FilterModeValue>(FilterMode.Neutral, {
        owner: this,
        purpose: 'form quad-state approval',
    })
    readonly formDate = new Emitter<CivilDate | null>('2026-09-12', {
        owner: this,
        purpose: 'form launch date',
    })
    readonly formTime = new Emitter<TimeString | null>('09:30', {
        owner: this,
        purpose: 'form window',
    })
    readonly formDateTime = new Emitter<DateTimeValue | null>(null, {
        owner: this,
        purpose: 'form maintenance slot',
    })
    readonly formProgress = new Emitter(65, {
        owner: this,
        purpose: 'form readiness',
    })
    readonly formCanSubmit = new Emitter(false, {
        owner: this,
        purpose: 'form submit consent',
    })
    readonly formDisabled = new Emitter(false, {
        owner: this,
        purpose: 'form disabled state',
    })
    readonly formRequired = new Emitter(false, {
        owner: this,
        purpose: 'form required state',
    })
    readonly formErrorFlag = new Emitter(false, {
        owner: this,
        purpose: 'form error flag',
    })
    readonly formError: DerivedEmitter<string | null, readonly [
        typeof this.formErrorFlag,
    ]>
    readonly formSubmitBlocked: DerivedEmitter<boolean, readonly [
        typeof this.formCanSubmit,
    ]>
    readonly formDialogOpen = new Emitter(false, {
        owner: this,
        purpose: 'form dialog',
    })
    readonly submissions = new Emitter<readonly FormSubmission[]>([], {
        owner: this,
        purpose: 'form submissions',
    })
    readonly submissionsTable: TableDataSource<FormSubmission>

    constructor() {
        this.gridRows = new DerivedEmitter(
            [
                this.serviceCatalog,
                this.gridSearch,
                this.gridOwner,
                this.gridAttention,
                this.gridReadyOnly,
                this.gridCriteria,
            ] as const,
            ([rows, search, owner, attention, readyOnly, criteria]) =>
                filterServices(rows, search, owner, attention, readyOnly, criteria),
            {owner: this, purpose: 'filtered service rows'},
        )
        this.gridTable = createLocalTableDataSource<ServiceRecord>({
            data: this.gridRows,
            sortEmitter: this.gridSort,
            filtersEmitter: this.gridFilters,
            owner: this,
        })

        this.explorerRows = new DerivedEmitter(
            [this.serviceCatalog, this.explorerScope] as const,
            ([rows, scope]) => scope === 'all'
                ? rows
                : scope.startsWith('SVC-')
                    ? rows.filter((row) => row.id === scope)
                    : rows.filter((row) => row.owner === scope),
            {owner: this, purpose: 'explorer rows'},
        )
        this.explorerShapes = new DerivedEmitter(
            [this.explorerRows] as const,
            ([rows]) => buildHistoryShapes(rows),
            {owner: this, purpose: 'explorer history'},
        )

        this.directoryRows = new DerivedEmitter(
            [this.serviceCatalog, this.directorySelection] as const,
            ([rows, selected]) => selected == null
                ? rows
                : rows.filter((row) => row.owner === selected.owner),
            {owner: this, purpose: 'directory rows'},
        )
        this.directoryTable = createLocalTableDataSource<ServiceRecord>({
            data: this.directoryRows,
            owner: this,
        })

        this.groupingCriteria = createServiceCriteria()
        this.visibleServices = filterByHidden(this.serviceCatalog, this.groupingCriteria)
        this.splitSelection = createSplitSelection(this.groupingCriteria, {
            active: ['status', 'owner'],
            presets: [
                {key: 'status-owner', label: 'Status → Owner', active: ['status', 'owner']},
                {key: 'owner-region', label: 'Owner → Region', active: ['owner', 'region']},
                {key: 'tier', label: 'Tier only', active: ['tier']},
            ],
        })
        this.blockSelection = createBlockSelection(
            this.visibleServices,
            this.splitSelection.activeSplits$,
            {rootLabel: 'Services', readabilityThreshold: 0.3},
        )
        this.analyticsShapes = new DerivedEmitter(
            [this.visibleServices] as const,
            ([rows]) => buildHistoryShapes(rows),
            {owner: this, purpose: 'analytics history'},
        )

        this.formError = new DerivedEmitter(
            [this.formErrorFlag] as const,
            ([flag]): string | null => flag ? 'Name is required' : null,
            {owner: this, purpose: 'form error'},
        )
        this.formSubmitBlocked = new DerivedEmitter(
            [this.formCanSubmit] as const,
            ([canSubmit]) => !canSubmit,
            {owner: this, purpose: 'submit blocked'},
        )
        this.submissionsTable = createLocalTableDataSource<FormSubmission>({
            data: this.submissions,
            owner: this,
        })
    }

    clearGridFilters(): void {
        this.gridSearch.set('', 'grid filters cleared')
        this.gridOwner.set('all', 'grid filters cleared')
        this.gridAttention.set('all', 'grid filters cleared')
        this.gridReadyOnly.set(false, 'grid filters cleared')
        this.gridCriteria.set(new Map(), 'grid filters cleared')
        this.lastAction.set('Grid filters cleared', 'grid filters cleared')
    }

    selectExplorerScope(scope: string): void {
        this.explorerScope.set(scope, 'explorer scope selected')
        const selected = services.find((service) => service.id === scope)
        this.lastAction.set(
            selected != null ? `Explorer: ${selected.name}` : `Explorer scope: ${scope}`,
            'explorer scope selected',
        )
    }

    adjustProgress(delta: number): void {
        const next = Math.min(100, Math.max(0, this.formProgress.get() + delta))
        this.formProgress.set(next, 'progress adjusted')
    }

    submitForm(): void {
        const submission: FormSubmission = {
            id: `SUB-${String(this.submissions.get().length + 1).padStart(3, '0')}`,
            name: this.formName.get() || 'Unnamed service',
            owner: this.formOwner.get(),
            tier: this.formTier.get(),
            status: this.formStatus.get(),
            readiness: this.formProgress.get(),
            submitted: this.formDate.get() ?? 'unscheduled',
        }
        this.submissions.set([...this.submissions.get(), submission], 'form submitted')
        this.lastAction.set(`Submitted ${submission.id}`, 'form submitted')
    }

    dispose(): void {
        this.gridTable.dispose()
        this.directoryTable.dispose()
        this.submissionsTable.dispose()
        this.blockSelection.dispose()
        this.splitSelection.dispose()
        this.visibleServices.dispose()
        for (const criterion of this.groupingCriteria) criterion.dispose()
        const emitters = [
            this.layoutVariant,
            this.activePage,
            this.themeSelection,
            this.colorSelection,
            this.lastAction,
            this.serviceCatalog,
            this.gridSearch,
            this.gridOwner,
            this.gridAttention,
            this.gridReadyOnly,
            this.gridCriteria,
            this.gridSort,
            this.gridFilters,
            this.gridSelection,
            this.gridRows,
            this.explorerScope,
            this.treeSelectedKey,
            this.treeExpandedKeys,
            this.explorerStacked,
            this.explorerSmooth,
            this.explorerRows,
            this.explorerShapes,
            this.explorerRange,
            this.directorySelection,
            this.directoryRows,
            this.directoryDialogOpen,
            this.analyticsStacked,
            this.analyticsSmooth,
            this.analyticsShapes,
            this.analyticsRange,
            this.formName,
            this.formOwner,
            this.formTier,
            this.formStatus,
            this.formActive,
            this.formSemantics,
            this.formApproval,
            this.formDate,
            this.formTime,
            this.formDateTime,
            this.formProgress,
            this.formCanSubmit,
            this.formDisabled,
            this.formRequired,
            this.formErrorFlag,
            this.formError,
            this.formSubmitBlocked,
            this.formDialogOpen,
            this.submissions,
        ]
        for (const emitter of emitters) emitter.dispose()
    }
}

function filterServices(
    rows: readonly ServiceRecord[],
    search: string,
    owner: OwnerFocus,
    attention: AttentionFocus,
    readyOnly: boolean,
    criteria: ReadonlyMap<FilterValue, FilterModeValue>,
): readonly ServiceRecord[] {
    const query = search.trim().toLowerCase()
    return rows.filter((service) => {
        if (owner !== 'all' && service.owner !== owner) return false
        if (attention === 'attention' && service.status === 'Ready') return false
        if (readyOnly && service.status !== 'Ready') return false
        if (query !== ''
            && !`${service.id} ${service.name}`.toLowerCase().includes(query)) {
            return false
        }
        return permitsCriteria(service, criteria)
    })
}

function permitsCriteria(
    service: ServiceRecord,
    criteria: ReadonlyMap<FilterValue, FilterModeValue>,
): boolean {
    const options = new Map(gridCriterionOptions.map((option) => [option.value, option]))
    let required = 0
    let requiredMatched = 0
    let preferred = 0
    let preferredMatched = 0
    for (const [value, mode] of criteria) {
        const option = options.get(String(value))
        if (option == null) continue
        const matched = option.matches(service)
        if (mode === FilterMode.Deny && matched) return false
        if (mode === FilterMode.Require) {
            required += 1
            if (matched) requiredMatched += 1
        }
        if (mode === FilterMode.Prefer) {
            preferred += 1
            if (matched) preferredMatched += 1
        }
    }
    if (requiredMatched < required) return false
    if (preferred > 0 && preferredMatched === 0) return false
    return true
}

function buildHistoryShapes(rows: readonly ServiceRecord[]): readonly HistoryShape[] {
    const builder = new SeriesBuilder(statusCategories)
    for (const service of rows) {
        const key = service.status.toLowerCase()
        const load = Math.max(1, service.incidents)
        builder.add(service.updated, key, load)
        builder.add(service.resolved, key, -load)
    }
    return builder.buildCumulative()
}

function createServiceCriteria(): readonly GroupingCriterion<ServiceRecord>[] {
    return Object.freeze([
        staticCriterion<ServiceRecord>({
            key: 'status',
            label: 'Status',
            categories: [
                {
                    key: 'ready',
                    label: 'Ready',
                    colors: ['#e8f6f3', '#73c6b6', '#148f77'],
                    predicate: (service) => service.status === 'Ready',
                },
                {
                    key: 'review',
                    label: 'Review',
                    colors: ['#fef9e7', '#f7dc6f', '#b7950b'],
                    predicate: (service) => service.status === 'Review',
                },
                {
                    key: 'attention',
                    label: 'Attention',
                    colors: ['#fdedec', '#f1948a', '#b03a2e'],
                    predicate: (service) => service.status === 'Attention',
                },
            ],
        }),
        staticCriterion<ServiceRecord>({
            key: 'owner',
            label: 'Owner',
            categories: serviceOwners.map((owner, index) => ({
                key: owner.toLowerCase(),
                label: owner,
                colors: ownerCategoryColors[index]!,
                predicate: (service) => service.owner === owner,
            })),
        }),
        staticCriterion<ServiceRecord>({
            key: 'region',
            label: 'Region',
            categories: [
                {
                    key: 'eu',
                    label: 'EU',
                    colors: ['#eafaf1', '#7dcea0', '#1e8449'],
                    predicate: (service) => service.region === 'EU',
                },
                {
                    key: 'us',
                    label: 'US',
                    colors: ['#ebf5fb', '#85c1e9', '#2e86c1'],
                    predicate: (service) => service.region === 'US',
                },
                {
                    key: 'apac',
                    label: 'APAC',
                    colors: ['#fef5e7', '#f8c471', '#b9770e'],
                    predicate: (service) => service.region === 'APAC',
                },
            ],
        }),
        staticCriterion<ServiceRecord>({
            key: 'tier',
            label: 'Tier',
            categories: [
                {
                    key: 'critical',
                    label: 'Critical',
                    colors: ['#fdedec', '#ec7063', '#922b21'],
                    predicate: (service) => service.tier === 'Critical',
                },
                {
                    key: 'standard',
                    label: 'Standard',
                    colors: ['#eaf2f8', '#85c1e9', '#2874a6'],
                    predicate: (service) => service.tier === 'Standard',
                },
                {
                    key: 'experimental',
                    label: 'Experimental',
                    colors: ['#f4ecf7', '#bb8fce', '#7d3c98'],
                    predicate: (service) => service.tier === 'Experimental',
                },
            ],
        }),
    ])
}
