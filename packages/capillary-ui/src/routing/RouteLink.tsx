import {Component, h} from '../Components/component.js'
import type {ComponentProps, CapillaryUiChild, LivePropContract} from '../Components/component.js'
import {isRouteDescriptor} from './route.js'
import type {RouteDescriptor, RouteTarget} from './route.js'
import type {ResolvedRoute} from './router.js'
import type {NavigationTransition} from './router.js'
import {classNames, componentClass} from '../Components/controlUtils.js'
import {StatusPresentation} from '../Components/status/statusPresentation.js'

export interface RouteLinkProps extends ComponentProps, LivePropContract<'busy'> {
    /** Additional pending work associated with this navigation, owned by the caller. */
    busy?: boolean
    to: RouteDescriptor | RouteTarget | ResolvedRoute
    exact?: boolean
    target?: string
    download?: string | boolean
    onClick?: (event: MouseEvent) => void
}

/** A native anchor that delegates unmodified same-context activation to the router. */
export class RouteLink extends Component<RouteLinkProps> {
    static override liveProps = ['busy'] as const
    static override dependencies = [StatusPresentation]
    private pendingTransition: NavigationTransition | null = null
    private pendingHref: string | null = null
    initialize(): void {
        const router = this._runtime.router
        if (router == null) throw new Error('RouteLink requires a router in CapillaryUiRuntime')
        this.watch(router.transition)
    }

    render(): CapillaryUiChild {
        const router = this._runtime.router
        if (router == null) throw new Error('RouteLink requires a router in CapillaryUiRuntime')
        const target = isRouteDescriptor(this.props.to)
            ? router.resolve(this.props.to, this._routeContext ?? router.root)
            : this.props.to
        const {
            to: _to,
            exact = false,
            children = [],
            onClick,
            busy = false,
            className: _className,
            class: _class,
            ...anchorProps
        } = this.props
        const href = router.href(target)
        const transition = router.transition.get()
        const isBusy = busy || (transition.state === 'pending' && transition === this.pendingTransition
            && href === this.pendingHref)
        return h('a', {
            ...anchorProps,
            href,
            className: classNames(componentClass(this.props), 'cap-working'),
            'aria-busy': isBusy ? 'true' : null,
            'data-cap-busy-visible': this.presentBusy(isBusy, 'navigation', href) ? '' : null,
            'aria-current': router.isActive(target, exact) ? 'page' : null,
            onClick: (event: MouseEvent) => {
                onClick?.(event)
                if (!shouldHandleClick(event, anchorProps.target, anchorProps.download)) return
                event.preventDefault()
                void router.navigate(target)
                this.pendingTransition = router.transition.get()
                this.pendingHref = href
                this.update()
            },
        }, children)
    }
}

function shouldHandleClick(
    event: MouseEvent,
    target: string | undefined,
    download: string | boolean | undefined,
): boolean {
    if (event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || download != null && download !== false
        || target != null && target !== '' && target !== '_self') return false
    return true
}
