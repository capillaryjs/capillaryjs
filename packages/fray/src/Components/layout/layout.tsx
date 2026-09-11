import {Component} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {classNames, componentClass} from '../controlUtils.js'
import {
    layoutAllocationClassName,
    layoutDirectionClassName,
    layoutDirectionFromProps,
} from './layoutTraits.js'
import type {
    FrayLayoutDirection,
    FrayLayoutDirectionProps,
    FrayOptionalLayoutDirectionProps,
    FrayLayoutParticipantProps,
} from './layoutTraits.js'

export type LayoutContainerProps = ComponentProps
& FrayOptionalLayoutDirectionProps
& FrayLayoutParticipantProps
& {
    id?: string
    role?: string
    ariaLabel?: string
    tabIndex?: number
    /** Make this bounded Layout host its own overflow owner. */
    scroll?: boolean
}

export type LayoutProps = LayoutContainerProps & FrayLayoutDirectionProps

interface LayoutHostAccessibilityProps {
    role?: string | null
    'aria-label'?: string | null
    tabIndex?: number | null
}

/** Presentation-only horizontal or vertical arrangement for arbitrary children. */
export class Layout<TProps extends LayoutContainerProps = LayoutProps> extends Component<TProps> {
    static override liveProps: readonly string[] = []

    protected defaultDirection(): FrayLayoutDirection | undefined {
        return undefined
    }

    protected defaultScroll(): boolean {
        return false
    }

    protected hostAccessibilityProps(): LayoutHostAccessibilityProps {
        const {role, ariaLabel, tabIndex} = this.props
        return {
            role: role ?? (ariaLabel == null ? null : 'region'),
            'aria-label': ariaLabel ?? null,
            tabIndex: tabIndex ?? null,
        }
    }

    render(): FrayChild {
        const direction = layoutDirectionFromProps(
            this.props,
            this.defaultDirection(),
            this.constructor.name,
        )
        const scroll = this.props.scroll ?? this.defaultScroll()
        const Host = this.Host
        return <Host
            id={this.props.id}
            {...this.hostAccessibilityProps()}
            className={classNames(
                componentClass(this.props),
                layoutDirectionClassName(direction),
                layoutAllocationClassName(this.props.allocation),
                scroll ? 'fray-scroll' : undefined,
            ) || null}
        >{this.props.children ?? []}</Host>
    }

    static override hostName = 'layout'
}
