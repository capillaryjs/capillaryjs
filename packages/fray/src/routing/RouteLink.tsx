import {Component, h} from '../Components/component.js'
import type {ComponentProps, FrayChild} from '../Components/component.js'
import {isRouteDescriptor} from './route.js'
import type {RouteDescriptor, RouteTarget} from './route.js'
import type {ResolvedRoute} from './router.js'

export interface RouteLinkProps extends ComponentProps {
    to: RouteDescriptor | RouteTarget | ResolvedRoute
    exact?: boolean
    target?: string
    download?: string | boolean
    onClick?: (event: MouseEvent) => void
}

/** A native anchor that delegates unmodified same-context activation to the router. */
export class RouteLink extends Component<RouteLinkProps> {
    static override liveProps: readonly string[] = []
    initialize(): void {
        const router = this._runtime.router
        if (router == null) throw new Error('RouteLink requires a router in FrayRuntime')
        this.watch(router.transition)
    }

    render(): FrayChild {
        const router = this._runtime.router
        if (router == null) throw new Error('RouteLink requires a router in FrayRuntime')
        const target = isRouteDescriptor(this.props.to)
            ? router.resolve(this.props.to, this._routeContext ?? router.root)
            : this.props.to
        const {
            to: _to,
            exact = false,
            children = [],
            onClick,
            ...anchorProps
        } = this.props
        return h('a', {
            ...anchorProps,
            href: router.href(target),
            'aria-current': router.isActive(target, exact) ? 'page' : null,
            onClick: (event: MouseEvent) => {
                onClick?.(event)
                if (!shouldHandleClick(event, anchorProps.target, anchorProps.download)) return
                event.preventDefault()
                void router.navigate(target)
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
