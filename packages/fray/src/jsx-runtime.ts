import {
    Component,
    Fragment,
    h,
} from './Components/component.js'
import type {
    ComponentProps,
    FrayIntrinsicElements,
    FrayChild,
    Key,
    TemplateProps,
    VNode,
    VNodeType,
} from './Components/component.js'

export {Fragment}

export function jsx<TProps extends ComponentProps>(
    type: VNodeType<TProps>,
    props: TemplateProps<TProps> | null,
    key?: Key,
): VNode<TProps> {
    const nextProps: TemplateProps<TProps> = props == null
        ? {} as TemplateProps<TProps>
        : {...props}
    if (key !== undefined) nextProps.key = key
    return h(type, nextProps)
}

export const jsxs = jsx
export const jsxDEV = jsx

/** Preserve an explicitly constructed component instance in a vnode tree. */
export function createPrebuiltElement<TComponent extends Component>(
    component: TComponent,
): TComponent {
    if (!(component instanceof Component)) {
        throw new TypeError('createPrebuiltElement requires a Component instance')
    }
    return component
}

export namespace JSX {
    export type Element = VNode | Component
    export interface ElementClass extends Component {}
    export interface ElementAttributesProperty {
        props: {}
    }
    export interface ElementChildrenAttribute {
        children: {}
    }
    export interface IntrinsicAttributes {
        key?: Key
    }
    export type LibraryManagedAttributes<_TComponent, TProps extends ComponentProps> =
        TemplateProps<TProps>
    export type IntrinsicElements = FrayIntrinsicElements
}

// Used by declaration consumers that construct children without JSX.
export type JSXChild = FrayChild
