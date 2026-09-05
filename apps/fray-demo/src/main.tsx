import {
    Component,
    Panel,
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
    readonly panelDisabled = new Emitter(false, {purpose: 'Panel review disabled state'})
    readonly visibleChanges = new DerivedEmitter(
        [this.selectedScope] as const,
        ([scope]) => scope === 'all' ? changes : changes.filter((change) => change.site === scope),
        {purpose: 'Meridian visible changes'},
    )
    readonly currentChange = new DerivedEmitter(
        [this.visibleChanges] as const,
        ([visibleChanges]) => visibleChanges[0] ?? null,
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
                    <h1>Panel review</h1>
                    <p>
                        Deterministic initial surfaces for the CSS overhaul.
                        The scope control is native until its Fray replacement
                        is introduced in a later reviewed iteration.
                    </p>
                </header>
                <nav aria-label="Style-lab sections">
                    <a href="#portfolio">Portfolio</a>
                    <a href="#selection">Selection</a>
                    <a href="#harness">Harness</a>
                </nav>
                <section class="meridian-controls" aria-label="Meridian scope controls">
                    <label>
                        <span>Scope</span>
                        <select bind:value={this.selectedScope}>
                            {Object.entries(scopeLabels).map(([value, label]) =>
                                <option value={value}>{label}</option>)}
                        </select>
                    </label>
                </section>
                <div class="meridian-panels">
                    <Panel id="portfolio" header="Portfolio summary">
                        <p><strong>{visibleChanges.length}</strong> visible changes in {scopeLabels[scope]}.</p>
                        <p class="long-copy">
                            This deliberately long deterministic explanation checks that Panel content
                            remains readable when a portfolio summary needs more than a single line.
                        </p>
                    </Panel>
                    <Panel id="selection" header="Current selection" orientation="horizontal">
                        {currentChange == null
                            ? <p>No change is visible in this scope.</p>
                            : <>
                                <p><strong>{currentChange.id}</strong></p>
                                <p>{currentChange.title}</p>
                                <p>{currentChange.risk} risk</p>
                            </>}
                    </Panel>
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
            </main>
        )
    }
}

const runtime = createFrayRuntime()
runtime.mount(runtime.create(DemoApp), document.querySelector('#app')!)
