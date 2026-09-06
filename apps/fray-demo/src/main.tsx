import {DerivedEmitter, Emitter} from '@sylwellsoftware/glue'
import {Button, Checkbox, Component, DataTable, DescriptionItem, DescriptionList, Dialog, Dropdown, FilterMode, FilterPanel, Panel, Placeholder, ProgressBar, QuadCheckbox, RadioButton, RadioGroup, Sidebar, SplitView, TabPanel, TableHeader, TableHeaderCell, Textbox, Toggle, Toolbar, TriCheckbox, createBrowserRouter, createFrayRuntime, createHashNavigation, createLocalTableDataSource, defineRoute, live} from '@sylwellsoftware/fray'
import type {FilterModeValue, TableFilters, TableSort} from '@sylwellsoftware/fray'
import baseStylesheet from '../../../packages/fray/themes/base.css?url&no-inline'
import colorsStylesheet from '../../../packages/fray/colors/iceblue/colors.css?url&no-inline'
import themeStylesheet from '../../../packages/fray/themes/shiny/theme.css?url&no-inline'
import './style-lab.css'

type Scope = 'all' | 'north-plant' | 'warehouse' | 'south-plant'
type WorkArea = 'portfolio' | 'register' | 'change' | 'analysis'
type StatusFocus = 'all' | 'planned' | 'active' | 'completed'

interface Change extends Record<string, unknown> {
    readonly id: string
    readonly title: string
    readonly site: Exclude<Scope, 'all'>
    readonly statusFocus: Exclude<StatusFocus, 'all'>
    readonly risk: 'Critical' | 'High' | 'Medium' | 'Low'
    readonly status: string
    readonly summary: string
}

type RiskFocus = 'all' | Change['risk']

const changes: readonly Change[] = [
    {
        id: 'CR-104',
        title: 'Emergency lighting renewal',
        site: 'north-plant',
        statusFocus: 'active',
        risk: 'Critical',
        status: 'Ready for review',
        summary: 'Replace emergency luminaires before the winter maintenance window.',
    },
    {
        id: 'CR-118',
        title: 'Packaging-line guard upgrade',
        site: 'north-plant',
        statusFocus: 'planned',
        risk: 'High',
        status: 'Planned',
        summary: 'Install the approved interlocked guard during the next production stop.',
    },
    {
        id: 'CR-203',
        title: 'Warehouse racking inspection',
        site: 'warehouse',
        statusFocus: 'active',
        risk: 'Medium',
        status: 'In assessment',
        summary: 'Confirm remedial work after the annual racking inspection.',
    },
    {
        id: 'CR-221',
        title: 'Boiler-control procedure review',
        site: 'south-plant',
        statusFocus: 'completed',
        risk: 'Low',
        status: 'Awaiting owner',
        summary: 'Update the isolation procedure before the next contractor visit.',
    },
]

const scopes: ReadonlyArray<{readonly id: Scope; readonly label: string}> = [
    {id: 'all', label: 'All sites'},
    {id: 'north-plant', label: 'North Plant'},
    {id: 'warehouse', label: 'Warehouse'},
    {id: 'south-plant', label: 'South Plant'},
]

const advancedRiskModes = [
    ['☐', FilterMode.Neutral],
    ['✓', FilterMode.Prefer],
    ['+', FilterMode.Require],
    ['×', FilterMode.Deny],
] as const

const meridianRoutes = {
    portfolio: defineRoute('meridian-portfolio', 'portfolio'),
    register: defineRoute('meridian-register', 'register'),
    change: defineRoute('meridian-change', 'change'),
    analysis: defineRoute('meridian-analysis', 'analysis'),
}

class RestartLab extends Component {
    static override dependencies = [Button, Checkbox, DataTable, DescriptionItem, DescriptionList, Dialog, Dropdown, FilterPanel, Panel, Placeholder, ProgressBar, QuadCheckbox, RadioButton, RadioGroup, Sidebar, SplitView, TabPanel, TableHeader, TableHeaderCell, Textbox, Toggle, Toolbar, TriCheckbox]
    static override css = ''

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
    readonly registerSearch = new Emitter('', {
        owner: this,
        purpose: 'Meridian change register search',
    })
    readonly riskFocus = new Emitter<RiskFocus>('all', {
        owner: this,
        purpose: 'Meridian change register risk focus',
    })
    readonly attentionFocus = new Emitter<FilterModeValue>(FilterMode.Prefer, {
        owner: this,
        purpose: 'Meridian change register active-change preference',
    })
    readonly completedFocus = new Emitter<FilterModeValue>(FilterMode.Deny, {
        owner: this,
        purpose: 'Meridian change register completed-change filter',
    })
    readonly criticalRiskFocus = new Emitter<FilterModeValue>(FilterMode.Require, {
        owner: this,
        purpose: 'Meridian change register critical-risk preference',
    })
    readonly advancedRiskFilters = new Emitter<ReadonlyMap<string, FilterModeValue>>(new Map(), {
        owner: this,
        purpose: 'Meridian advanced risk filters',
    })
    readonly advancedRiskFiltersOpen = new Emitter(false, {
        owner: this,
        purpose: 'Meridian advanced risk filters visibility',
    })
    readonly registerSort = new Emitter<TableSort | null>(null, {
        owner: this,
        purpose: 'Meridian change register table sort',
    })
    readonly registerFilters = new Emitter<TableFilters>({}, {
        owner: this,
        purpose: 'Meridian change register table filters',
    })
    readonly statusFocusDisabled = new Emitter(false, {
        owner: this,
        purpose: 'Toggle review disabled state',
    })
    readonly statusFocusRequired = new Emitter(false, {
        owner: this,
        purpose: 'Toggle review required state',
    })
    readonly statusFocusError = new Emitter<string | null>(null, {
        owner: this,
        purpose: 'Toggle review error state',
    })
    readonly clearScopeDialogOpen = new Emitter(false, {
        owner: this,
        purpose: 'Meridian clear scope filters confirmation dialog',
    })
    readonly panelDisabled = new Emitter(false, {
        owner: this,
        purpose: 'Panel review disabled state',
    })
    readonly attentionQueueLoading = new Emitter(false, {
        owner: this,
        purpose: 'Meridian attention queue refresh state',
    })
    private attentionQueueRefreshTimer: ReturnType<typeof setTimeout> | null = null
    readonly scopedChanges = new DerivedEmitter(
        [this.selectedScope, this.statusFocus, this.registerSearch, this.riskFocus, this.attentionFocus, this.completedFocus, this.criticalRiskFocus, this.advancedRiskFilters] as const,
        ([scope, statusFocus, search, riskFocus, attentionFocus, completedFocus, criticalRiskFocus, advancedRiskFilters]) => changes.filter((change) =>
            (scope === 'all' || change.site === scope)
            && (statusFocus === 'all' || change.statusFocus === statusFocus)
            && matchesRegisterSearch(change, search)
            && (riskFocus === 'all' || change.risk === riskFocus)
            && (attentionFocus !== FilterMode.Deny || change.statusFocus === 'completed')
            && (completedFocus !== FilterMode.Deny || change.statusFocus !== 'completed')
            && (criticalRiskFocus !== FilterMode.Deny || change.risk !== 'Critical')
            && (criticalRiskFocus !== FilterMode.Require || change.risk === 'Critical')
            && matchesAdvancedRiskFilters(change, advancedRiskFilters))
            .sort((left, right) => (attentionFocus === FilterMode.Prefer
                ? Number(right.statusFocus !== 'completed') - Number(left.statusFocus !== 'completed') : 0)
                || (criticalRiskFocus === FilterMode.Prefer
                    ? Number(right.risk === 'Critical') - Number(left.risk === 'Critical') : 0)
                || compareAdvancedRiskPreference(left, right, advancedRiskFilters)),
        {owner: this, purpose: 'Meridian changes in scope, status focus, search, risk, attention, and advanced risk filters'},
    )
    readonly changeTable = createLocalTableDataSource<Change>({
        data: this.scopedChanges,
        sortEmitter: this.registerSort,
        filtersEmitter: this.registerFilters,
        owner: this,
    })
    readonly visibleChanges = new DerivedEmitter(
        [this.changeTable.query] as const,
        ([rows]) => rows ?? [],
        {owner: this, purpose: 'Meridian visible table changes'},
    )
    initialize(): void {
        this.onCleanup(this.visibleChanges.subscribe(({value}) => {
            const selected = this.selectedChange.get()
            const retained = selected == null
                ? null
                : value.find((change) => change.id === selected.id) ?? null
            const next = retained ?? value[0] ?? null
            if (!Object.is(next, selected)) {
                this.selectedChange.set(next, 'selected change reconciled with visible changes')
            }
        }, {emitCurrent: true}))
    }

    render() {
        return <main class="style-lab">
            <header class="meridian-masthead">
                <p class="eyebrow">Meridian Change Office</p>
                <h1>Operational change management</h1>
                <p>Review and coordinate operational changes across the organisation.</p>
            </header>

            <div class="meridian-shell">
                {this.renderScope()}

                <section class="meridian-workspace" aria-label="Change management work area">
                    <TabPanel
                        id="meridian-work-area"
                        label="Change management work areas"
                        valueEmitter={this.activeArea}
                        tabs={[
                            {id: 'portfolio', label: 'Portfolio', route: meridianRoutes.portfolio, content: this.renderPortfolio()},
                            {id: 'register', label: 'Register', route: meridianRoutes.register, content: this.renderRegister()},
                            {id: 'change', label: 'Change', route: meridianRoutes.change, content: this.renderChange()},
                            {id: 'analysis', label: 'Analysis', disabled: true, route: meridianRoutes.analysis, content: this.renderAnalysis()},
                        ]}
                    />
                </section>
            </div>

            <section class="demo-harness" aria-labelledby="review-harness-heading">
                <h2 id="review-harness-heading">Review harness</h2>
                <label>
                    <input type="checkbox" bind:checked={this.panelDisabled} />
                    Render the Portfolio summary as unavailable
                </label>
                <label>
                    <input type="checkbox" bind:checked={this.statusFocusDisabled} />
                    Disable the live status focus
                </label>
                <label>
                    <input type="checkbox" bind:checked={this.statusFocusRequired} />
                    Mark the live status focus as required
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={this.read(this.statusFocusError) != null}
                        onChange={(event: Event) => this.statusFocusError.set(
                            (event.currentTarget as HTMLInputElement).checked
                                ? 'Choose a status focus before continuing.'
                                : null,
                            'Toggle review error changed',
                        )}
                    />
                    Show a status-focus error
                </label>
                <Checkbox
                    label="Needs attention only (disabled review)"
                    value="all"
                    disabled={true}
                    symbols={[
                        ['☐', 'all'],
                        ['✓', 'attention'],
                    ]}
                />
                <RadioButton
                    label="Unavailable scope (disabled review)"
                    name="scope-review"
                    value="unavailable"
                    checked={true}
                    disabled={true}
                />
            </section>
        </main>
    }

    private renderScope() {
        const selectedScope = this.read(this.selectedScope)
        return <Sidebar
            className="meridian-scope"
            header="Scope"
            toolbar={<Toolbar label="Scope filters">
                <p class="native-toolbar">Changes in this scope appear in every work area.</p>
                <Button
                    label="Clear scope filters"
                    onClick={() => this.clearScopeDialogOpen.set(true, 'scope filter clear requested')}
                />
                <Toggle
                    label="Status focus"
                    valueEmitter={this.statusFocus}
                    disabled={live(this.statusFocusDisabled)}
                    required={live(this.statusFocusRequired)}
                    error={live(this.statusFocusError)}
                    options={[
                        ['all', 'All'],
                        ['planned', 'Planned'],
                        ['active', 'Active'],
                        ['completed', 'Completed'],
                    ]}
                />
            </Toolbar>}
        >
            <>
                <nav aria-label="Organisational scope">
                    <RadioGroup
                        ariaLabel="Organisational scope"
                        valueEmitter={this.selectedScope}
                        options={scopes.map(({id, label}) => [id, label] as const)}
                        onChange={(scope) => this.selectedScope.set(scope, 'scope selected')}
                    />
                </nav>
                <Dialog
                    title="Clear scope filters?"
                    description="This resets the selected site and status focus in every work area."
                    valueEmitter={this.clearScopeDialogOpen}
                    actions={<Button
                        label="Clear filters"
                        onClick={() => this.clearScopeFilters()}
                    />}
                />
            </>
        </Sidebar>
    }

    private clearScopeFilters(): void {
        this.selectedScope.set('all', 'scope filters cleared')
        this.statusFocus.set('all', 'scope filters cleared')
        this.clearScopeDialogOpen.set(false, 'scope filters cleared')
    }

    private renderPortfolio() {
        const visibleChanges = this.read(this.visibleChanges)
        const currentChange = this.read(this.selectedChange)
        const attentionQueueLoading = this.read(this.attentionQueueLoading)
        const criticalCount = visibleChanges.filter((change) => change.risk === 'Critical').length
        const completedCount = visibleChanges.filter((change) => change.statusFocus === 'completed').length
        const attentionChanges = visibleChanges.filter((change) =>
            change.statusFocus !== 'completed' && change.risk !== 'Low')
        const completionMaximum = Math.max(visibleChanges.length, 1)
        const completionText = visibleChanges.length === 0
            ? 'No changes in scope'
            : `${completedCount} of ${visibleChanges.length} completed`
        return <div class="work-area portfolio-area">
            <header class="work-area-heading">
                <p class="eyebrow">Portfolio</p>
                <h2>Current change portfolio</h2>
            </header>
            <div class="portfolio-grid">
                <Panel header="Portfolio summary" disabled={live(this.panelDisabled)}>
                    <p><strong>{visibleChanges.length}</strong> change requests in scope</p>
                    <p>{criticalCount === 0 ? 'No critical changes require attention.' : `${criticalCount} critical change requires attention.`}</p>
                    <ProgressBar
                        label={`Completed changes: ${completionText}`}
                        value={completedCount}
                        max={completionMaximum}
                        valueText={completionText}
                    />
                </Panel>
                <Panel header="Current selection">
                    {currentChange == null
                        ? <p>No changes match the selected scope.</p>
                        : <>
                            <p><strong>{currentChange.id}</strong> · {currentChange.title}</p>
                            <p>{currentChange.status}</p>
                        </>}
                </Panel>
                <Panel
                    header="Attention queue"
                    toolbar={<Button
                        label="Refresh queue"
                        busy={attentionQueueLoading}
                        busyLabel="Refreshing queue"
                        onClick={() => this.refreshAttentionQueue()}
                    />}
                >
                    {attentionQueueLoading ? <>
                        <p role="status">Refreshing attention queue…</p>
                        <ul class="attention-queue" aria-hidden="true">
                            <li><Placeholder width={88} /></li>
                            <li><Placeholder width={62} /></li>
                            <li><Placeholder width={76} /></li>
                        </ul>
                    </> : attentionChanges.length === 0
                        ? <p>No changes currently need attention.</p>
                        : <ul class="attention-queue">
                            {attentionChanges.map((change) => <li key={change.id}>
                                <strong>{change.id}</strong> · {change.title}
                            </li>)}
                        </ul>}
                </Panel>
            </div>
        </div>
    }

    private refreshAttentionQueue(): void {
        if (this.attentionQueueRefreshTimer != null) return
        this.attentionQueueLoading.set(true, 'attention queue refresh requested')
        this.attentionQueueRefreshTimer = setTimeout(() => {
            this.attentionQueueRefreshTimer = null
            this.attentionQueueLoading.set(false, 'attention queue refresh completed')
        }, 900)
    }

    private renderRegister() {
        const currentChange = this.read(this.selectedChange)
        return <div class="work-area register-area">
            <header class="work-area-heading">
                <p class="eyebrow">Register</p>
                <h2>Change register</h2>
            </header>
            <Textbox
                label="Search changes"
                type="search"
                placeholder="ID, title, or summary"
                autoComplete="off"
                inputMode="search"
                valueEmitter={this.registerSearch}
            />
            <Dropdown
                label="Risk focus"
                valueEmitter={this.riskFocus}
                options={[
                    {value: 'all', label: 'All risks'},
                    {value: 'Critical', label: 'Critical'},
                    {value: 'High', label: 'High'},
                    {value: 'Medium', label: 'Medium'},
                    {value: 'Low', label: 'Low'},
                ]}
            />
            <TriCheckbox label="Prioritise active changes" valueEmitter={this.attentionFocus} />
            <TriCheckbox label="Completed changes" valueEmitter={this.completedFocus} />
            <QuadCheckbox label="Critical-risk changes" valueEmitter={this.criticalRiskFocus} />
            <section class="advanced-risk-filter" aria-label="Advanced risk filters">
                <Button
                    label="Advanced risk filters"
                    pressed={this.read(this.advancedRiskFiltersOpen)}
                    onClick={() => this.advancedRiskFiltersOpen.set(
                        !this.advancedRiskFiltersOpen.get(),
                        'advanced risk filters visibility changed',
                    )}
                />
                {this.read(this.advancedRiskFiltersOpen)
                    ? <FilterPanel
                        label="Advanced risk filters"
                        options={['Low', 'Medium', 'High', 'Critical']}
                        filters={this.read(this.advancedRiskFilters)}
                        filterModes={advancedRiskModes}
                        onChange={(filters) => this.replaceAdvancedRiskFilters(filters)}
                    />
                    : null}
            </section>
            <SplitView
                className="meridian-register"
                primarySize="40%"
                primaryLabel="Change register"
                secondaryLabel="Selected change preview"
                primary={<DataTable
                    dataSource={this.changeTable}
                    rowKey="id"
                    caption="Changes in selected scope"
                    selectedItemEmitter={this.selectedChange}
                    columns={[
                        {field: 'id', label: 'ID', sortable: true},
                        {field: 'title', label: 'Change', sortable: true},
                        {
                            field: 'risk',
                            label: 'Risk',
                            sortable: true,
                            filterOptions: ['Low', 'Medium', 'High', 'Critical'],
                        },
                        {field: 'status', label: 'Status'},
                    ]}
                />}
                secondary={<Panel header="Selected change preview">
                    {currentChange == null ? <p>No change selected.</p> : <>
                        <p><strong>{currentChange.id}</strong> · {currentChange.title}</p>
                        <p>{currentChange.summary}</p>
                        <p>{currentChange.risk} risk · {currentChange.status}</p>
                    </>}
                </Panel>}
            />
        </div>
    }

    private replaceAdvancedRiskFilters(
        filters: ReadonlyMap<string | number, FilterModeValue>,
    ): void {
        const next = new Map<string, FilterModeValue>()
        for (const [value, state] of filters) {
            if (typeof value === 'string' && isChangeRisk(value)) next.set(value, state)
        }
        this.advancedRiskFilters.set(next, 'advanced risk filters changed')
    }

    private renderChange() {
        const currentChange = this.read(this.selectedChange)
        return <div class="work-area change-area">
            <header class="work-area-heading">
                <p class="eyebrow">Change</p>
                <h2>Change details</h2>
            </header>
            <Panel header="Selected change">
                {currentChange == null ? <p>Select a scope containing a change to continue.</p> : <>
                    <p><strong>{currentChange.id}</strong> · {currentChange.title}</p>
                    <DescriptionList class="change-facts" label="Change facts">
                        <DescriptionItem term="Risk" value={currentChange.risk} />
                        <DescriptionItem term="Status" value={currentChange.status} />
                        <DescriptionItem term="Site" value={scopeLabel(currentChange.site)} />
                    </DescriptionList>
                    <p>{currentChange.summary}</p>
                </>}
            </Panel>
        </div>
    }

    private renderAnalysis() {
        return <div class="work-area analysis-area">
            <header class="work-area-heading">
                <p class="eyebrow">Analysis</p>
                <h2>Analysis is not available in this slice</h2>
            </header>
            <p>Its tab remains disabled until the analysis components are introduced.</p>
        </div>
    }

    onDestroy(): void {
        if (this.attentionQueueRefreshTimer != null) clearTimeout(this.attentionQueueRefreshTimer)
        this.visibleChanges.dispose()
        this.changeTable.dispose()
        this.scopedChanges.dispose()
        this.statusFocusError.dispose()
        this.statusFocusRequired.dispose()
        this.statusFocusDisabled.dispose()
        this.clearScopeDialogOpen.dispose()
        this.statusFocus.dispose()
        this.attentionFocus.dispose()
        this.completedFocus.dispose()
        this.criticalRiskFocus.dispose()
        this.advancedRiskFilters.dispose()
        this.advancedRiskFiltersOpen.dispose()
        this.registerSort.dispose()
        this.registerFilters.dispose()
        this.riskFocus.dispose()
        this.registerSearch.dispose()
        this.attentionQueueLoading.dispose()
        this.panelDisabled.dispose()
        this.activeArea.dispose()
        this.selectedChange.dispose()
        this.selectedScope.dispose()
    }
}

function scopeLabel(scope: Scope): string {
    return scopes.find((candidate) => candidate.id === scope)?.label ?? scope
}

function matchesRegisterSearch(change: Change, search: string): boolean {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return normalizedSearch.length === 0 || [change.id, change.title, change.summary]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
}

function isChangeRisk(value: string): value is Change['risk'] {
    return changes.some((change) => change.risk === value)
}

function matchesAdvancedRiskFilters(
    change: Change,
    filters: ReadonlyMap<string, FilterModeValue>,
): boolean {
    const state = filters.get(change.risk) ?? FilterMode.Neutral
    if (state === FilterMode.Deny) return false
    const hasRequiredRisk = [...filters.values()].some((value) => value === FilterMode.Require)
    return !hasRequiredRisk || state === FilterMode.Require
}

function compareAdvancedRiskPreference(
    left: Change,
    right: Change,
    filters: ReadonlyMap<string, FilterModeValue>,
): number {
    return Number(filters.get(right.risk) === FilterMode.Prefer)
        - Number(filters.get(left.risk) === FilterMode.Prefer)
}

const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) throw new Error('Fray style lab requires #app')

void start(root)

async function start(target: HTMLElement): Promise<void> {
    await loadStylesheet('base', baseStylesheet)
    const router = createBrowserRouter({adapter: createHashNavigation(window)})
    const runtime = createFrayRuntime({router})
    runtime.registerStyles(RestartLab).injectStyles(document)
    await loadStylesheet('colors', colorsStylesheet)
    await loadStylesheet('theme', themeStylesheet)
    const lab = runtime.mount(runtime.create(RestartLab), target)
    addEventListener('pagehide', () => {
        lab.destroy()
        router.dispose()
    }, {once: true})
}

function loadStylesheet(kind: 'base' | 'colors' | 'theme', href: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.dataset.frayStylesheet = kind
        link.addEventListener('load', () => resolve(), {once: true})
        link.addEventListener('error', () => reject(new Error(
            `Fray style lab could not load ${kind} stylesheet: ${href}`,
        )), {once: true})
        document.head.append(link)
    })
}
