import {
    Component,
    createFrayRuntime,
} from '@sylwellsoftware/fray'
import '../../../packages/fray/styles/structural.css'
import '../../../packages/fray/colors/iceblue/colors.css'
import '../../../packages/fray/themes/shiny/theme.css'
import './style-lab.css'

class DemoApp extends Component {
    render() {
        return (
            <main>
                <header>
                    <p class="eyebrow">Fray</p>
                    <h1>Style lab</h1>
                    <p>
                        A deterministic review harness for the CSS overhaul.
                        Component families appear here only after their review
                        state has been agreed.
                    </p>
                </header>
                <nav aria-label="Style-lab sections">
                    <a href="#foundation">Foundation</a>
                    <a href="#review-queue">Review queue</a>
                </nav>
                <section id="foundation" aria-labelledby="foundation-heading">
                    <h2 id="foundation-heading">Foundation</h2>
                    <p>
                        Structural CSS, one document-wide palette, and one
                        document-wide theme are loaded for this page.
                    </p>
                </section>
                <section id="review-queue" aria-labelledby="review-queue-heading">
                    <h2 id="review-queue-heading">Review queue</h2>
                    <p>No component family is selected yet.</p>
                </section>
            </main>
        )
    }
}

const runtime = createFrayRuntime()
runtime.mount(runtime.create(DemoApp), document.querySelector('#app')!)
