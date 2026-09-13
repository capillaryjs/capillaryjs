import {Component} from '../../component.js'
import type {ComponentProps, CapillaryUiChild, Key} from '../../component.js'

export interface TreeNode<TValue = unknown> {
    id: Key
    label: CapillaryUiChild
    textValue?: string
    value?: TValue
    children?: readonly TreeNode<TValue>[]
}

export interface TreeItemProps<TValue = unknown> extends ComponentProps {
    id: Key
    label: CapillaryUiChild
    textValue?: string
    value?: TValue
}

/** Declarative tree-node marker consumed by TreeView. */
export class TreeItem<TValue = unknown> extends Component<TreeItemProps<TValue>> {
    static override liveProps: readonly string[] = []
    render(): CapillaryUiChild {
        return this.props.children ?? []
    }
}
