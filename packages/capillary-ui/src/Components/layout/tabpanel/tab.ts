import {Component} from '../../component.js'
import type {ComponentProps, CapillaryUiChild, Key} from '../../component.js'
import type {LiteralRouteDescriptor} from '../../../routing/route.js'

export interface TabProps extends ComponentProps {
    id?: Key
    label?: CapillaryUiChild
    disabled?: boolean
    route?: LiteralRouteDescriptor
}

/** Declarative content marker consumed by TabPanel. */
export class Tab extends Component<TabProps> {
    static override liveProps: readonly string[] = []
    render(): CapillaryUiChild {
        return this.props.children ?? []
    }
}
