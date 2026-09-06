import {DerivedEmitter, Emitter} from '@sylwellsoftware/glue'
import {Button, Checkbox, Component, Dropdown, Panel, ProgressBar, RadioButton, Sidebar, SplitView, TabLine, Textbox, Toggle, Toolbar, createFrayRuntime, live} from '@sylwellsoftware/fray'
import baseStylesheet from '../../../packages/fray/themes/base.css?url&no-inline'
import colorsStylesheet from '../../../packages/fray/colors/iceblue/colors.css?url&no-inline'
import themeStylesheet from '../../../packages/fray/themes/shiny/theme.css?url&no-inline'
import './style-lab.css'

type Scope = 'all' | 'north-plant' | 'warehouse' | 'south-plant'
type WorkArea = 'portfolio' | 'register' | 'change' | 'analysis'
type StatusFocus = 'all' | 'planned' | 'active' | 'completed'

interface Change {
    readonly id: string
    readonly title: string
    readonly site: Exclude<Scope, 'all'>
    readonly statusFocus: Exclude<StatusFocus, 'all'>
    readonly risk: 'Critical' | 'High' | 'Medium' | 'Low'
    readonly status: string
    readonly summary: string
}

type RiskFocus = 'all' | Change['risk']
type AttentionFocus = 'all' | 'attention'

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

class RestartLab extends Component {
    static override dependencies = [Button, Checkbox, Dropdown, Panel, ProgressBar, RadioButton, Sidebar, SplitView, TabLine, Textbox, Toggle, Toolbar]
    static override css = ''

    readonly selectedScope = new Emitter<Scope>('all', {
        owner: this,
        purpose: 'Meridian organisational scope',
    })
    readonly selectedChangeId = new Emitter<string | null>('CR-104', {
        owner: this,
        purpose: 'Meridian selected change',
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
    readonly attentionFocus = new Emitter<AttentionFocus>('all', {
        owner: this,
        purpose: 'Meridian change register attention focus',
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
    readonly panelDisabled = new Emitter(false, {
        owner: this,
        purpose: 'Panel review disabled state',
    })
    readonly visibleChanges = new DerivedEmitter(
        [this.selectedScope, this.statusFocus, this.registerSearch, this.riskFocus, this.attentionFocus] as const,
        ([scope, statusFocus, search, riskFocus, attentionFocus]) => changes.filter((change) =>
            (scope === 'all' || change.site === scope)
            && (statusFocus === 'all' || change.statusFocus === statusFocus)
            && matchesRegisterSearch(change, search)
            && (riskFocus === 'all' || change.risk === riskFocus)
            && (attentionFocus === 'all' || change.statusFocus !== 'completed')),
        {owner: this, purpose: 'Meridian changes in scope, status focus, search, risk, and attention focus'},
    )
    readonly currentChange = new DerivedEmitter(
        [this.visibleChanges, this.selectedChangeId] as const,
        ([visibleChanges, selectedChangeId]) =>
            visibleChanges.find((change) => change.id === selectedChangeId) ?? visibleChanges[0] ?? null,
        {owner: this, purpose: 'Meridian selected visible change'},
    )

    render() {
        const activeArea = this.read(this.activeArea)
        return <main class="style-lab">
            <header class="meridian-masthead">
                <p class="eyebrow">Meridian Change Office</p>
                <h1>Operational change management</h1>
                <p>Review and coordinate operational changes across the organisation.</p>
            </header>

            <div class="meridian-shell">
                {this.renderScope()}

                <section class="meridian-workspace" aria-label="Change management work area">
                    <TabLine
                        baseId="meridian-work-area"
                        label="Change management work areas"
                        valueEmitter={this.activeArea}
                        tabs={[
                            {id: 'portfolio', label: 'Portfolio'},
                            {id: 'register', label: 'Register'},
                            {id: 'change', label: 'Change'},
                            {id: 'analysis', label: 'Analysis', disabled: true},
                        ]}
                    />
                    <section
                        id="meridian-work-area-panel-portfolio"
                        role="tabpanel"
                        aria-labelledby="meridian-work-area-tab-portfolio"
                        hidden={activeArea !== 'portfolio'}
                    >{this.renderPortfolio()}</section>
                    <section
                        id="meridian-work-area-panel-register"
                        role="tabpanel"
                        aria-labelledby="meridian-work-area-tab-register"
                        hidden={activeArea !== 'register'}
                    >{this.renderRegister()}</section>
                    <section
                        id="meridian-work-area-panel-change"
                        role="tabpanel"
                        aria-labelledby="meridian-work-area-tab-change"
                        hidden={activeArea !== 'change'}
                    >{this.renderChange()}</section>
                    <section
                        id="meridian-work-area-panel-analysis"
                        role="tabpanel"
                        aria-labelledby="meridian-work-area-tab-analysis"
                        hidden={activeArea !== 'analysis'}
                    >{this.renderAnalysis()}</section>
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
                <Button label="Clear scope filters" onClick={() => this.clearScopeFilters()} />
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
            <nav aria-label="Organisational scope">
                <ul class="scope-list">
                    {scopes.map((scope) => <li key={scope.id}><RadioButton
                        name="meridian-scope"
                        value={scope.id}
                        label={scope.label}
                        checked={selectedScope === scope.id}
                        onChange={(checked) => {
                            if (checked) this.selectedScope.set(scope.id, 'scope selected')
                        }}
                    /></li>)}
                </ul>
            </nav>
        </Sidebar>
    }

    private clearScopeFilters(): void {
        this.selectedScope.set('all', 'scope filters cleared')
        this.statusFocus.set('all', 'scope filters cleared')
    }

    private renderPortfolio() {
        const visibleChanges = this.read(this.visibleChanges)
        const currentChange = this.read(this.currentChange)
        const criticalCount = visibleChanges.filter((change) => change.risk === 'Critical').length
        const completedCount = visibleChanges.filter((change) => change.statusFocus === 'completed').length
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
            </div>
        </div>
    }

    private renderRegister() {
        const visibleChanges = this.read(this.visibleChanges)
        const currentChange = this.read(this.currentChange)
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
            <Checkbox
                label="Needs attention only"
                valueEmitter={this.attentionFocus}
                symbols={[
                    ['☐', 'all'],
                    ['✓', 'attention'],
                ]}
            />
            <SplitView
                className="meridian-register"
                primarySize="40%"
                primaryLabel="Change register"
                secondaryLabel="Selected change preview"
                primary={<nav aria-label="Changes in selected scope">
                    <ul class="change-register">
                        {visibleChanges.map((change) => <li key={change.id}><button
                            type="button"
                            aria-pressed={currentChange?.id === change.id}
                            onClick={() => this.selectedChangeId.set(change.id, 'change selected')}
                        >{change.id} · {change.title}</button></li>)}
                    </ul>
                </nav>}
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

    private renderChange() {
        const currentChange = this.read(this.currentChange)
        return <div class="work-area change-area">
            <header class="work-area-heading">
                <p class="eyebrow">Change</p>
                <h2>Change details</h2>
            </header>
            <Panel header="Selected change">
                {currentChange == null ? <p>Select a scope containing a change to continue.</p> : <>
                    <p><strong>{currentChange.id}</strong> · {currentChange.title}</p>
                    <dl class="change-facts">
                        <div><dt>Risk</dt><dd>{currentChange.risk}</dd></div>
                        <div><dt>Status</dt><dd>{currentChange.status}</dd></div>
                        <div><dt>Site</dt><dd>{scopeLabel(currentChange.site)}</dd></div>
                    </dl>
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
        this.currentChange.dispose()
        this.visibleChanges.dispose()
        this.statusFocusError.dispose()
        this.statusFocusRequired.dispose()
        this.statusFocusDisabled.dispose()
        this.statusFocus.dispose()
        this.attentionFocus.dispose()
        this.riskFocus.dispose()
        this.registerSearch.dispose()
        this.panelDisabled.dispose()
        this.activeArea.dispose()
        this.selectedChangeId.dispose()
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

const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) throw new Error('Fray style lab requires #app')

void start(root)

async function start(target: HTMLElement): Promise<void> {
    await loadStylesheet('base', baseStylesheet)
    const runtime = createFrayRuntime()
    runtime.registerStyles(RestartLab).injectStyles(document)
    await loadStylesheet('colors', colorsStylesheet)
    await loadStylesheet('theme', themeStylesheet)
    runtime.mount(runtime.create(RestartLab), target)
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
