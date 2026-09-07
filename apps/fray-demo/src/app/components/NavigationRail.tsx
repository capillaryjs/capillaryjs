import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../model/MeridianModel.js'
import {ScopeSidebar} from './ScopeSidebar.js'
import {ViewPanel} from './ViewPanel.js'

interface NavigationRailProps extends ComponentProps {
    readonly model: MeridianModel
}

export class NavigationRail extends Component<NavigationRailProps> {
    render(): FrayChild {
        return <aside class="meridian-navigation" aria-label="Scope and view controls">
            <ScopeSidebar key="scope" model={this.props.model} />
            <ViewPanel key="view" model={this.props.model} />
        </aside>
    }
}
