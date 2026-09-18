/** Direction in which a supported component arranges application-owned children. */
export type CapillaryUiLayoutDirection = 'horizontal' | 'vertical'

/** Main-axis participation of a supported component in its containing layout. */
export type CapillaryUiLayoutAllocation = 'natural' | 'flexible'

/** Opt-in contract for components whose host intentionally participates in layout. */
export interface CapillaryUiLayoutParticipantProps {
    allocation?: CapillaryUiLayoutAllocation
}

/** Shared surface spacing; omission inherits the enclosing island layout. */
export interface CapillaryUiIslandLayoutProps {
    /** Enable shared island gutters; false stops inheritance, undefined inherits. */
    islands?: boolean | undefined
}

export function islandLayoutClassName(islands: boolean | undefined): string | undefined {
    if (islands === undefined) return undefined
    if (islands === true) return 'cap-island-layout'
    if (islands === false) return 'cap-island-layout-off'
    throw new TypeError('Island layout islands must be a boolean')
}

/** Concise, mutually exclusive direction modifiers for intentional layout components. */
export type CapillaryUiLayoutDirectionProps =
    | {horizontal: boolean, vertical?: never}
    | {horizontal?: never, vertical: boolean}

/** Presentation context a container declares for its descendants. */
export type CapillaryUiPresentationContext = 'control' | 'form'

/**
 * Opt-in contract for containers that declare a presentation context.
 * The nearest marked ancestor wins: descendants read context through
 * inherited CSS custom properties, so a nested marker overrides an outer one.
 */
export interface CapillaryUiPresentationContextProps {
    context?: CapillaryUiPresentationContext
}

/** Compatibility form for components that retain an established default direction. */
export type CapillaryUiOptionalLayoutDirectionProps =
    | CapillaryUiLayoutDirectionProps
    | {horizontal?: never, vertical?: never}

/** Resolve boolean direction modifiers, with an optional compatibility fallback. */
export function layoutDirectionFromProps(
    props: {horizontal?: boolean, vertical?: boolean},
    fallback?: CapillaryUiLayoutDirection,
    componentName = 'Layout component',
): CapillaryUiLayoutDirection {
    const {horizontal = false, vertical = false} = props
    if (horizontal && vertical) {
        throw new TypeError(`${componentName} cannot be both horizontal and vertical`)
    }
    if (horizontal) return 'horizontal'
    if (vertical) return 'vertical'
    if (fallback != null) return fallback
    throw new TypeError(`${componentName} requires either horizontal or vertical`)
}

export function layoutDirectionClassName(direction: CapillaryUiLayoutDirection): string {
    if (direction === 'horizontal') return 'cap-layout-horizontal'
    if (direction === 'vertical') return 'cap-layout-vertical'
    throw new TypeError('Layout direction must be horizontal or vertical')
}

export function layoutAllocationClassName(
    allocation: CapillaryUiLayoutAllocation | null | undefined,
): string | undefined {
    if (allocation == null) return undefined
    if (allocation === 'natural') return 'cap-size-natural'
    if (allocation === 'flexible') return 'cap-size-flexible'
    throw new TypeError('Layout allocation must be natural or flexible')
}
