/** Direction in which a supported component arranges application-owned children. */
export type FrayLayoutDirection = 'horizontal' | 'vertical'

/** Main-axis participation of a supported component in its containing layout. */
export type FrayLayoutAllocation = 'natural' | 'flexible'

/** Opt-in contract for components whose host intentionally participates in layout. */
export interface FrayLayoutParticipantProps {
    allocation?: FrayLayoutAllocation
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
