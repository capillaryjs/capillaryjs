import {Component} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'

export class AppHeader extends Component {
    render(): FrayChild {
        return <header class="meridian-masthead island">
            <p class="eyebrow">Meridian Change Office</p>
            <h1>Operational change management</h1>
            <p>Review and coordinate changes across the organisation.</p>
        </header>
    }
}
