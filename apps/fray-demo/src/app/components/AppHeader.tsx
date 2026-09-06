import {Component} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
import {FeaturePlaceholder} from './shared.js'

export class AppHeader extends Component {
    render(): FrayChild {
        return <header class="meridian-masthead">
            <div>
                <p class="eyebrow">Meridian Change Office</p>
                <h1>Operational change management</h1>
                <p>Review and coordinate changes across the organisation.</p>
            </div>
            <FeaturePlaceholder
                compact={true}
                feature="ThemePicker + ColorPicker"
                purpose="Theme and colour controls will appear here after approval."
            />
        </header>
    }
}
