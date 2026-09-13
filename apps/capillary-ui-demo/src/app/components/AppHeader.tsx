import {Component} from '@capillaryjs/capillary-ui'
import type {CapillaryUiChild} from '@capillaryjs/capillary-ui'

export class AppHeader extends Component {
    render(): CapillaryUiChild {
        return <header class="meridian-masthead island">
            <p class="eyebrow">Meridian Change Office</p>
            <h1>Operational change management</h1>
            <p>Review and coordinate changes across the organisation.</p>
        </header>
    }
}
