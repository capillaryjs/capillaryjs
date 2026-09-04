import {Component} from '../../component.js'
import type {ComponentProps, FrayChild, Key} from '../../component.js'
import type {LiteralRouteDescriptor} from '../../../routing/route.js'

export interface TabProps extends ComponentProps {
    id?: Key
    label?: FrayChild
    disabled?: boolean
    route?: LiteralRouteDescriptor
}

/** Declarative content marker consumed by TabPanel. */
export class Tab extends Component<TabProps> {
    render(): FrayChild {
        return this.props.children ?? []
    }
}
