import {
    Component,
    Panel,
    Sidebar,
    SplitView,
    createFrayRuntime,
    live,
} from '@sylwellsoftware/fray'
import {DerivedEmitter, Emitter} from '@sylwellsoftware/glue'
import '../../../packages/fray/styles/structural.css'
import '../../../packages/fray/colors/iceblue/colors.css'
import '../../../packages/fray/themes/shiny/theme.css'
import './style-lab.css'

type Scope = 'all' | 'north-plant' | 'south-plant' | 'warehouse'

type Change = {
    readonly id: string
    readonly title: string
    readonly site: Exclude<Scope, 'all'>
    readonly risk: 'Critical' | 'High' | 'Medium' | 'Low'
}

const changes: readonly Change[] = [
    {id: 'CR-104', title: 'Emergency lighting renewal', site: 'north-plant', risk: 'Critical'},
    {id: 'CR-118', title: 'Packaging-line guard upgrade', site: 'north-plant', risk: 'High'},
    {id: 'CR-203', title: 'Warehouse racking inspection', site: 'warehouse', risk: 'Medium'},
    {id: 'CR-221', title: 'Boiler-control procedure review', site: 'south-plant', risk: 'Low'},
]

const scopeLabels: Record<Scope, string> = {
    all: 'All sites',
    'north-plant': 'North Plant',
    'south-plant': 'South Plant',
    warehouse: 'Warehouse',
}

class DemoApp extends Component {
    readonly selectedScope = new Emitter<Scope>('all', {purpose: 'Meridian selected scope'})
    readonly selectedChangeId = new Emitter<string | null>(null, {purpose: 'Meridian selected change'})
    readonly panelDisabled = new Emitter(false, {purpose: 'Panel review disabled state'})
    readonly visibleChanges = new DerivedEmitter(
        [this.selectedScope] as const,
        ([scope]) => scope === 'all' ? changes : changes.filter((change) => change.site === scope),
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
        return (
            <main class="style-lab">
                <header>
                    <p class="eyebrow">Fray · Meridian Change Office</p>
                    <h1>SplitView review</h1>
                    <p>
                        Deterministic Meridian surfaces for the CSS overhaul.
                        The Register now keeps its native change list and
                        selected-change preview in one explicit two-pane layout.
                    </p>
                </header>
                <nav aria-label="Style-lab sections">
                    <a href="#portfolio">Portfolio</a>
                    <a href="#register">Register</a>
                    <a href="#harness">Harness</a>
                </nav>
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
                        <Panel id="portfolio" header="Portfolio summary">
                            <p><strong>{visibleChanges.length}</strong> visible changes in {scopeLabels[scope]}.</p>
                            <p class="long-copy">
                                This deliberately long deterministic explanation checks that Panel content
                                remains readable when a portfolio summary needs more than a single line.
                            </p>
                        </Panel>
                        <div id="register">
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
                                    </>}
                                </Panel>}
                            />
                        </div>
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
                            <p>Selected scope: {scopeLabels[scope]}. The state control remains outside this region.</p>
                        </Panel>
                    </div>
                </div>
            </main>
        )
    }
}

const runtime = createFrayRuntime()
runtime.mount(runtime.create(DemoApp), document.querySelector('#app')!)
