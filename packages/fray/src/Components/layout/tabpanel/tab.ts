import {Component} from '../../component.js'
import type {ComponentProps, FrayChild, Key} from '../../component.js'

export interface TabProps extends ComponentProps {
    id?: Key
    label?: FrayChild
    disabled?: boolean
}

/** Declarative content marker consumed by TabPanel. */
export class Tab extends Component<TabProps> {
    render(): FrayChild {
        return this.props.children ?? []
    }
}
