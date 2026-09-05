import {
    Component,
    createFrayRuntime,
} from '@sylwellsoftware/fray'
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
import '@sylwellsoftware/fray/themes/shiny/theme.css'

class DemoApp extends Component {
    render() {
        return (
            <main>
                <h1>Fray CSS Overhaul Demo</h1>
                <p>Waiting for component implementation...</p>
            </main>
        )
    }
}

const runtime = createFrayRuntime()
runtime.mount(runtime.create(DemoApp), document.querySelector('#app')!)
