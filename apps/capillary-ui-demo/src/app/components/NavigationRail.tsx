import {Component} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import type {MeridianModel} from '../model/MeridianModel.js'
import {ScopeSidebar} from './ScopeSidebar.js'
import {ViewPanel} from './ViewPanel.js'

interface NavigationRailProps extends ComponentProps {
    readonly model: MeridianModel
}

export class NavigationRail extends Component<NavigationRailProps> {
    render(): CapillaryUiChild {
        return <aside class="meridian-navigation" aria-label="Scope and view controls">
            <ScopeSidebar key="scope" model={this.props.model} />
            <ViewPanel key="view" model={this.props.model} />
        </aside>
    }
}
