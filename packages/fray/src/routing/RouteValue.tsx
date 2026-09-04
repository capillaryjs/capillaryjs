import {Component, Fragment, h} from '../Components/component.js'
import type {
    ComponentProps,
    FrayChild,
    WritableEmitter,
} from '../Components/component.js'
import {RouteScope} from './RouteScope.js'
import type {
    ParameterRouteDescriptor,
    RouteValueResolver,
} from './route.js'
import type {ResolvedRoute, RouteRegistration} from './router.js'

export interface RouteValueProps<TValue> extends ComponentProps {
    route: ParameterRouteDescriptor<TValue>
    valueEmitter: WritableEmitter<TValue | null>
    resolve?: RouteValueResolver<TValue>
    /** Make the active dynamic value the parent context for nested routes. */
    scopeChildren?: boolean
}

/** Bind one dynamic child path segment to an application-owned value. */
export class RouteValue<TValue> extends Component<RouteValueProps<TValue>> {
    private registration: (RouteRegistration & {
        contextFor(value: TValue): ResolvedRoute
    }) | null = null

    initialize(): void {
        const router = this._runtime.router
        if (router == null || this._routeContext == null) {
            throw new Error('RouteValue requires a router and contextual route scope')
        }
        this.registration = router.registerValueRoute(this._routeContext, this, {
            route: this.props.route,
            valueEmitter: this.props.valueEmitter,
            ...(this.props.resolve == null ? {} : {resolve: this.props.resolve}),
        })
        this.watch(this.props.valueEmitter)
    }

    render(): FrayChild {
        const value = this.props.valueEmitter.get()
        const children = this.props.children ?? []
        if (!this.props.scopeChildren || value == null || this.registration == null) {
            return h(Fragment, null, children)
        }
        return h(RouteScope, {
            key: this.registration.contextFor(value).pathname,
            context: this.registration.contextFor(value),
            children,
        })
    }

    override onDestroy(): void {
        this.registration?.dispose()
        this.registration = null
    }
}
