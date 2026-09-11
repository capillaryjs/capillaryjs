/** Direction in which a supported component arranges application-owned children. */
export type FrayLayoutDirection = 'horizontal' | 'vertical'

/** Main-axis participation of a supported component in its containing layout. */
export type FrayLayoutAllocation = 'natural' | 'flexible'

/** Opt-in contract for components whose host intentionally participates in layout. */
export interface FrayLayoutParticipantProps {
    allocation?: FrayLayoutAllocation
}

/** Concise, mutually exclusive direction modifiers for intentional layout components. */
export type FrayLayoutDirectionProps =
    | {horizontal: boolean, vertical?: never}
    | {horizontal?: never, vertical: boolean}

/** Compatibility form for components that retain an established default direction. */
export type FrayOptionalLayoutDirectionProps =
    | FrayLayoutDirectionProps
    | {horizontal?: never, vertical?: never}

/** Resolve boolean direction modifiers, with an optional compatibility fallback. */
export function layoutDirectionFromProps(
    props: {horizontal?: boolean, vertical?: boolean},
    fallback?: FrayLayoutDirection,
    componentName = 'Layout component',
): FrayLayoutDirection {
    const {horizontal = false, vertical = false} = props
    if (horizontal && vertical) {
        throw new TypeError(`${componentName} cannot be both horizontal and vertical`)
    }
    if (horizontal) return 'horizontal'
    if (vertical) return 'vertical'
    if (fallback != null) return fallback
    throw new TypeError(`${componentName} requires either horizontal or vertical`)
}

export function layoutDirectionClassName(direction: FrayLayoutDirection): string {
    if (direction === 'horizontal') return 'fray-layout-horizontal'
    if (direction === 'vertical') return 'fray-layout-vertical'
    throw new TypeError('Layout direction must be horizontal or vertical')
}

export function layoutAllocationClassName(
    allocation: FrayLayoutAllocation | null | undefined,
): string | undefined {
    if (allocation == null) return undefined
    if (allocation === 'natural') return 'fray-size-natural'
    if (allocation === 'flexible') return 'fray-size-flexible'
    throw new TypeError('Layout allocation must be natural or flexible')
}
