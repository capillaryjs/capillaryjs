import {Component, isVNode} from '../component.js'
import type {
    ComponentConstructor,
    ComponentProps,
    FrayChild,
} from '../component.js'

/**
 * Base for non-visual, parent-specific content-region markers.
 *
 * A marker must be consumed as a direct child by the component that defines
 * its meaning. The marker itself never contributes a DOM or component host.
 */
export abstract class DeclarativeRegion<
    TProps extends ComponentProps = ComponentProps,
> extends Component<TProps> {
    static override liveProps: readonly string[] = []

    render(): never {
        throw new Error(`${this.constructor.name} must be a direct child of its documented parent`)
    }
}

export interface ReadDeclarativeRegionsOptions<TName extends string> {
    /** Allow ordinary, unmarked children. Defaults to true. */
    allowContent?: boolean
    /** Region names that must be supplied exactly once. */
    required?: readonly NoInfer<TName>[]
}

export interface ReadDeclarativeRegionsResult<TName extends string> {
    /** Ordinary children retained in their authored order. */
    content: readonly FrayChild[]
    /** Contents of each unique, parent-specific region marker. */
    regions: Readonly<Partial<Record<TName, readonly FrayChild[]>>>
}

/**
 * Separate direct declarative-region children from ordinary ordered content
 * and validate one component's documented region contract.
 */
export function readDeclarativeRegions<TName extends string>(
    componentName: string,
    children: ComponentProps['children'],
    supportedRegions: Readonly<Record<TName, ComponentConstructor>>,
    options: ReadDeclarativeRegionsOptions<TName> = {},
): ReadDeclarativeRegionsResult<TName> {
    const entries = Object.entries(supportedRegions) as [TName, ComponentConstructor][]
    const content: FrayChild[] = []
    const regions: Partial<Record<TName, readonly FrayChild[]>> = {}
    const values = Array.isArray(children) ? children : children == null ? [] : [children]

    for (const child of values) {
        if (!isVNode(child)) {
            content.push(child)
            continue
        }
        const entry = entries.find(([, type]) => child.type === type)
        if (entry == null) {
            if (isDeclarativeRegionType(child.type)) {
                throw new Error(`${componentName} does not support region: ${child.type.name}`)
            }
            content.push(child)
            continue
        }

        const [name] = entry
        if (regions[name] != null) throw new Error(`${componentName} received duplicate region: ${name}`)
        regions[name] = child.props.children
    }

    if (options.allowContent === false && content.length > 0) {
        throw new Error(`${componentName} accepts only its documented region children`)
    }
    for (const required of options.required ?? []) {
        if (!Object.hasOwn(supportedRegions, required)) {
            throw new Error(`${componentName} requires undeclared region: ${required}`)
        }
        if (regions[required] == null) throw new Error(`${componentName} requires region: ${required}`)
    }

    return {content, regions}
}

function isDeclarativeRegionType(type: unknown): type is ComponentConstructor {
    return typeof type === 'function'
        && type.prototype instanceof DeclarativeRegion
}
