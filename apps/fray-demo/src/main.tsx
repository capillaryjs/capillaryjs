import {Emitter} from '@sylwellsoftware/glue'
import {Component, Panel, Sidebar, SplitView, createFrayRuntime, live} from '@sylwellsoftware/fray'
import baseStylesheet from '../../../packages/fray/themes/base.css?url&no-inline'
import colorsStylesheet from '../../../packages/fray/colors/iceblue/colors.css?url&no-inline'
import themeStylesheet from '../../../packages/fray/themes/shiny/theme.css?url&no-inline'
import './style-lab.css'

class RestartLab extends Component {
    static override dependencies = [Panel, Sidebar, SplitView]
    static override css = ''
    readonly panelDisabled = new Emitter(false, {
        owner: this,
        purpose: 'Panel review disabled state',
    })

    render() {
        return <main class="style-lab">
            <header>
                <p class="eyebrow">Fray CSS overhaul · Change 009</p>
                <h1>SplitView review lab</h1>
                <p>
                    SplitView is the new component. Previously approved Header, Panel, and
                    Sidebar remain visible, with native application content between them.
                </p>
            </header>

            <section class="review-controls" aria-labelledby="panel-state">
                <h2 id="panel-state">Approved Panel state</h2>
                <label>
                    <input type="checkbox" bind:checked={this.panelDisabled} />
                    Disable the live-state Panel
                </label>
            </section>

            <div class="approved-grid">
                <Sidebar
                    id="portfolio-navigation"
                    className="sidebar-example"
                    header="Portfolio navigation"
                    toolbar={<p class="native-toolbar">Native toolbar-slot content</p>}
                >
                    <nav aria-label="Portfolio sections">
                        <ul>
                            <li>Overview</li>
                            <li>Change requests</li>
                            <li>Critical risks</li>
                            <li>Completed work</li>
                            <li>Archive</li>
                            <li>System notes</li>
                            <li>Inspection history</li>
                            <li>Supplier follow-up</li>
                        </ul>
                    </nav>
                </Sidebar>

                <Panel
                    id="portfolio-summary"
                    header="Portfolio summary"
                    disabled={live(this.panelDisabled)}
                >
                    <p><strong>4</strong> deterministic change requests</p>
                    <p>
                        The approved Panel remains in the cumulative lab while the SplitView
                        slice is reviewed.
                    </p>
                </Panel>
            </div>

            <Sidebar id="saved-views" className="sidebar-example" ariaLabel="Saved views">
                <p>This Sidebar has no visible Header or toolbar.</p>
                <p>Its accessible name comes from <code>ariaLabel</code>.</p>
            </Sidebar>

            <SplitView
                className="splitview-example"
                primarySize="40%"
                primaryLabel="Change register"
                secondaryLabel="Selected change preview"
                primary={<nav aria-label="Change register">
                    <ul class="change-register">
                        <li>CR-104 · Emergency lighting renewal</li>
                        <li>CR-118 · North plant maintenance</li>
                        <li>CR-121 · Supplier audit follow-up</li>
                    </ul>
                </nav>}
                secondary={<Panel id="selected-change" header="Selected change preview">
                    <p><strong>CR-104</strong></p>
                    <p>Emergency lighting renewal is ready for the next review checkpoint.</p>
                </Panel>}
            />
        </main>
    }
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
