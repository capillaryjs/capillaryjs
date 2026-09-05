import {
    Component,
    Panel,
    Sidebar,
    SplitView,
    TabLine,
    Toggle,
    createFrayRuntime,
    live,
} from '@sylwellsoftware/fray'
import {DerivedEmitter, Emitter} from '@sylwellsoftware/glue'
import '../../../packages/fray/styles/structural.css'
import '../../../packages/fray/colors/iceblue/colors.css'
import '../../../packages/fray/themes/shiny/theme.css'
import './style-lab.css'

type Scope = 'all' | 'north-plant' | 'south-plant' | 'warehouse'
type ChangeStatus = 'planned' | 'active' | 'completed'
type DemoFetchState = 'automatic' | 'initial' | 'loading' | 'ready' | 'error'

type Change = {
    readonly id: string
    readonly title: string
    readonly site: Exclude<Scope, 'all'>
    readonly risk: 'Critical' | 'High' | 'Medium' | 'Low'
    readonly status: ChangeStatus
}

const changes: readonly Change[] = [
    {id: 'CR-104', title: 'Emergency lighting renewal', site: 'north-plant', risk: 'Critical', status: 'active'},
    {id: 'CR-118', title: 'Packaging-line guard upgrade', site: 'north-plant', risk: 'High', status: 'planned'},
    {id: 'CR-203', title: 'Warehouse racking inspection', site: 'warehouse', risk: 'Medium', status: 'completed'},
    {id: 'CR-221', title: 'Boiler-control procedure review', site: 'south-plant', risk: 'Low', status: 'planned'},
]

const scopeLabels: Record<Scope, string> = {
    all: 'All sites',
    'north-plant': 'North Plant',
    'south-plant': 'South Plant',
    warehouse: 'Warehouse',
}

class DemoApp extends Component {
    readonly activeTab = new Emitter<'portfolio' | 'register' | 'change' | 'analysis' | null>('portfolio', {purpose: 'Meridian active work area'})
    readonly demoFetchState = new Emitter<DemoFetchState>('automatic', {purpose: 'Meridian demo fetch-state harness'})
    readonly selectedScope = new Emitter<Scope>('all', {purpose: 'Meridian selected scope'})
    readonly statusFocus = new Emitter<'all' | ChangeStatus>('all', {purpose: 'Meridian change status focus'})
    readonly selectedChangeId = new Emitter<string | null>(null, {purpose: 'Meridian selected change'})
    readonly panelDisabled = new Emitter(false, {purpose: 'Panel review disabled state'})
    readonly visibleChanges = new DerivedEmitter(
        [this.selectedScope, this.statusFocus] as const,
        ([scope, statusFocus]) => changes.filter((change) =>
            (scope === 'all' || change.site === scope)
            && (statusFocus === 'all' || change.status === statusFocus)),
        {purpose: 'Meridian visible changes'},
    )
    readonly currentChange = new DerivedEmitter(
        [this.visibleChanges, this.selectedChangeId] as const,
        ([visibleChanges, selectedChangeId]) => visibleChanges.find((change) => change.id === selectedChangeId)
            ?? visibleChanges[0]
            ?? null,
        {purpose: 'Meridian current change'},
    )

    render() {
        const scope = this.read(this.selectedScope)
        const visibleChanges = this.read(this.visibleChanges)
        const currentChange = this.read(this.currentChange)
        const activeTab = this.read(this.activeTab)
        const demoFetchState = this.read(this.demoFetchState)
        return (
            <main class="style-lab">
                <header>
                    <p class="eyebrow">Fray · Meridian Change Office</p>
                    <h1>Toggle review</h1>
                    <p>
                        Deterministic Meridian surfaces for the CSS overhaul.
                        Toggle now drives the harness state and a live portfolio
                        status focus without introducing server-owned controls.
                    </p>
                </header>
                <TabLine
                    label="Meridian work areas"
                    activeTabEmitter={this.activeTab}
                    tabs={[
                        {id: 'portfolio', label: 'Portfolio'},
                        {id: 'register', label: 'Register'},
                        {id: 'change', label: 'Change'},
                        {id: 'analysis', label: 'Analysis', disabled: true},
                    ]}
                />
                <div class="meridian-workspace">
                    <Sidebar
                        id="scope"
                        class="meridian-scope"
                        header="Scope"
                        toolbar={<p class="sidebar-toolbar-note">Organisation coverage</p>}
                    >
                        <p class="scope-intro">Choose the part of Meridian affected by this review.</p>
                        <div class="scope-sites" role="group" aria-label="Sites">
                            {(Object.entries(scopeLabels) as [Scope, string][]).map(([value, label]) =>
                                <button
                                    type="button"
                                    aria-pressed={scope === value}
                                    onClick={() => this.selectedScope.set(value)}
                                >
                                    {label}
                                </button>)}
                        </div>
                        <p class="scope-selection">
                            <strong>{scopeLabels[scope]}</strong> currently exposes {visibleChanges.length} change
                            {visibleChanges.length === 1 ? '' : 's'} for the portfolio review.
                        </p>
                        <p class="scope-notes">
                            Scope applies throughout the Meridian Change Office: portfolio attention,
                            register rows, selected-change detail, and later analysis stay aligned to the
                            same organisational boundary. The deliberately longer guidance confirms that
                            native content remains readable inside the Sidebar's own scrolling region.
                        </p>
                    </Sidebar>
                    <div class="meridian-content">
                        {activeTab === 'portfolio' ? <Panel id="portfolio" header="Portfolio summary">
                            <p><strong>{visibleChanges.length}</strong> visible changes in {scopeLabels[scope]}.</p>
                            <Toggle
                                id="status-focus"
                                label="Change status"
                                options={[
                                    ['all', 'All'],
                                    ['planned', 'Planned'],
                                    ['active', 'Active'],
                                    ['completed', 'Completed'],
                                ]}
                                valueEmitter={this.statusFocus}
                            />
                            <p class="long-copy">
                                This deliberately long deterministic explanation checks that Panel content
                                remains readable when a portfolio summary needs more than a single line.
                            </p>
                        </Panel> : null}
                        {activeTab === 'register' ? <div id="register">
                            <SplitView
                                class="meridian-register"
                                primarySize="minmax(0, 0.9fr)"
                                primaryLabel="Change register"
                                secondaryLabel="Selected change preview"
                                primary={<Panel header="Change register">
                                    <p class="register-intro">Visible changes in {scopeLabels[scope]}.</p>
                                    <div class="register-list" role="group" aria-label="Visible changes">
                                        {visibleChanges.map((change) =>
                                            <button
                                                type="button"
                                                aria-pressed={currentChange?.id === change.id}
                                                onClick={() => this.selectedChangeId.set(change.id)}
                                            >
                                                <strong>{change.id}</strong> {change.title}
                                            </button>)}
                                    </div>
                                </Panel>}
                                secondary={<Panel id="selection" header="Selected change" orientation="horizontal">
                                {currentChange == null
                                    ? <p>No change is visible in this scope.</p>
                                    : <>
                                        <p><strong>{currentChange.id}</strong></p>
                                        <p>{currentChange.title}</p>
                                        <p>{currentChange.risk} risk</p>
                                        <p>{currentChange.status} status</p>
                                    </>}
                                </Panel>}
                            />
                        </div> : null}
                        {activeTab === 'change' ? <Panel id="change" header="Selected change">
                            <p>{currentChange == null ? 'No change is visible in this scope.' : `${currentChange.id}: ${currentChange.title}`}</p>
                        </Panel> : null}
                        <section class="panel-state-control" aria-label="Panel state control">
                            <label>
                                <input type="checkbox" bind:checked={this.panelDisabled}/>
                                <span>Show disabled Panel state</span>
                            </label>
                        </section>
                        <Panel
                            id="harness"
                            header="Demo harness"
                            toolbar={<span class="panel-toolbar-note">Panel state only</span>}
                            disabled={live(this.panelDisabled)}
                        >
                            <Toggle
                                id="fetch-state"
                                label="Demo fetch state"
                                options={[
                                    ['automatic', 'Automatic'],
                                    ['initial', 'Initial'],
                                    ['loading', 'Loading'],
                                    ['ready', 'Ready'],
                                    ['error', 'Error'],
                                ]}
                                valueEmitter={this.demoFetchState}
                            />
                            <p>
                                Harness mode: <strong>{demoFetchState}</strong>. Selected scope:
                                {' '}{scopeLabels[scope]}. The state control remains outside this region.
                            </p>
                        </Panel>
                    </div>
                </div>
            </main>
        )
    }
}

const runtime = createFrayRuntime()
runtime.mount(runtime.create(DemoApp), document.querySelector('#app')!)
