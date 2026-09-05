import {
    Component,
    Checkbox,
    ColorPicker,
    Label,
    Panel,
    Sidebar,
    SplitView,
    TabLine,
    ThemePicker,
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
type CheckboxState = 'off' | 'on'
type ThemeState = 'shiny' | 'java' | 'minimal'

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
    readonly themeState = new Emitter<ThemeState>('shiny', {purpose: 'Meridian presentation theme'})
    readonly colorState = new Emitter('iceblue', {purpose: 'Meridian presentation palette'})
    readonly registerFilterLabel = new Emitter('Search the change register', {purpose: 'Meridian Register filter label'})
    readonly registerSearchDraft = new Emitter('', {purpose: 'Meridian Register search draft'})
    readonly forceDisabledState = new Emitter<CheckboxState>('off', {purpose: 'Meridian force disabled harness'})
    readonly forceRequiredState = new Emitter<CheckboxState>('off', {purpose: 'Meridian force required harness'})
    readonly includeCompletedState = new Emitter<'exclude' | 'include'>('exclude', {purpose: 'Meridian completed-change preference'})
    readonly selectedScope = new Emitter<Scope>('all', {purpose: 'Meridian selected scope'})
    readonly statusFocus = new Emitter<'all' | ChangeStatus>('all', {purpose: 'Meridian change status focus'})
    readonly selectedChangeId = new Emitter<string | null>(null, {purpose: 'Meridian selected change'})
    readonly forceDisabled = new DerivedEmitter(
        [this.forceDisabledState] as const,
        ([state]) => state === 'on',
        {purpose: 'Meridian effective forced disabled state'},
    )
    readonly forceRequired = new DerivedEmitter(
        [this.forceRequiredState] as const,
        ([state]) => state === 'on',
        {purpose: 'Meridian effective forced required state'},
    )
    readonly visibleChanges = new DerivedEmitter(
        [this.selectedScope, this.statusFocus, this.includeCompletedState] as const,
        ([scope, statusFocus, includeCompleted]) => changes.filter((change) =>
            (scope === 'all' || change.site === scope)
            && (statusFocus === 'all' || change.status === statusFocus)
            && (includeCompleted === 'include' || change.status !== 'completed')),
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
        const forceDisabled = this.read(this.forceDisabled)
        const registerSearchDraft = this.read(this.registerSearchDraft)
        return (
            <main class="style-lab">
                <header>
                    <p class="eyebrow">Fray · Meridian Change Office</p>
                    <h1>Label review</h1>
                    <p>
                        Deterministic Meridian surfaces for the CSS overhaul.
                        The Register filter form begins with a native field and
                        a Fray Label before its Textbox replacement.
                    </p>
                    <div class="appearance-harness">
                        <ThemePicker
                            id="meridian-theme"
                            label="Theme"
                            valueEmitter={this.themeState}
                            disabled={live(this.forceDisabled)}
                        />
                        <ColorPicker
                            id="meridian-color"
                            label="Palette"
                            valueEmitter={this.colorState}
                            disabled={live(this.forceDisabled)}
                        />
                    </div>
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
                                disabled={live(this.forceDisabled)}
                            />
                            <Checkbox
                                id="include-completed"
                                label="Include completed changes"
                                symbols={[['', 'exclude'], ['✓', 'include']]}
                                valueEmitter={this.includeCompletedState}
                                disabled={live(this.forceDisabled)}
                                required={live(this.forceRequired)}
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
                                    <form class="register-filter" onSubmit={(event: Event) => event.preventDefault()}>
                                        <Label
                                            htmlFor="register-search"
                                            text={live(this.registerFilterLabel)}
                                        />
                                        <input
                                            id="register-search"
                                            type="search"
                                            value={registerSearchDraft}
                                            placeholder="Search by title or change ID"
                                            disabled={forceDisabled}
                                            onInput={(event: Event) => this.registerSearchDraft.set(
                                                (event.currentTarget as HTMLInputElement).value,
                                                'Meridian Register search draft changed',
                                            )}
                                        />
                                    </form>
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
                        <section class="harness-availability" aria-label="Harness availability controls">
                            <Checkbox
                                id="force-disabled"
                                label="Force disabled"
                                symbols={[['', 'off'], ['✓', 'on']]}
                                valueEmitter={this.forceDisabledState}
                            />
                            <Checkbox
                                id="force-required"
                                label="Force required"
                                symbols={[['', 'off'], ['✓', 'on']]}
                                valueEmitter={this.forceRequiredState}
                            />
                        </section>
                        <Panel
                            id="harness"
                            header="Demo harness"
                            toolbar={<span class="panel-toolbar-note">Availability harness</span>}
                            disabled={live(this.forceDisabled)}
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
                                disabled={live(this.forceDisabled)}
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
