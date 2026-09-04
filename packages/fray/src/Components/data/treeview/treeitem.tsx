import {Component} from '../../component.js'
import type {ComponentProps, FrayChild, Key} from '../../component.js'

export interface TreeNode<TValue = unknown> {
    id: Key
    label: FrayChild
    textValue?: string
    value?: TValue
    children?: readonly TreeNode<TValue>[]
}

export interface TreeItemProps<TValue = unknown> extends ComponentProps {
    id: Key
    label: FrayChild
    textValue?: string
    value?: TValue
}

/** Declarative tree-node marker consumed by TreeView. */
export class TreeItem<TValue = unknown> extends Component<TreeItemProps<TValue>> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        return this.props.children ?? []
    }
}
