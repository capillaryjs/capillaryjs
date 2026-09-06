import {Component, createFrayRuntime} from '@sylwellsoftware/fray'
import '../../../packages/fray/themes/base.css'
import '../../../packages/fray/colors/iceblue/colors.css'
import '../../../packages/fray/themes/minimal/theme.css'
import './style-lab.css'

/** Native application shell. Add one reviewed Fray component dependency per slice. */
class RestartLab extends Component {
    static override dependencies = []
    static override css = ''

    render() {
        return <main class="style-lab">
            <header>
                <p class="eyebrow">Fray CSS overhaul · Change 009</p>
                <h1>Component review lab</h1>
                <p>
                    The previous composite demo has been retired. This native shell is the
                    controlled starting point for approving one Fray component at a time.
                </p>
            </header>
            <section aria-labelledby="restart-state">
                <h2 id="restart-state">Ready for the first component slice</h2>
                <p>
                    No Fray component is mounted yet, so the injected structural stylesheet is
                    intentionally empty. The next slice must declare its dependency here before
                    its structural CSS can enter the page.
                </p>
                <dl>
                    <div><dt>Base</dt><dd>Variables and palette derivation</dd></div>
                    <div><dt>Structure</dt><dd>Collected from declared component classes</dd></div>
                    <div><dt>Colors</dt><dd>Palette anchors and endpoints</dd></div>
                    <div><dt>Theme</dt><dd>Intentional variable overrides</dd></div>
                </dl>
            </section>
        </main>
    }
}

const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) throw new Error('Fray style lab requires #app')

const runtime = createFrayRuntime()
runtime.registerStyles(RestartLab).injectStyles(document)
runtime.mount(runtime.create(RestartLab), root)
