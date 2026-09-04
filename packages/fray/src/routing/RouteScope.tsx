import {Component, Fragment, h} from '../Components/component.js'
import type {ComponentProps, FrayChild} from '../Components/component.js'
import type {ResolvedRoute} from './router.js'

export interface RouteScopeProps extends ComponentProps {
    /** Resolved contextual route inherited by every nested component. */
    context: ResolvedRoute
}

/** Context carrier used by route-aware controls and advanced compositions. */
export class RouteScope extends Component<RouteScopeProps> {
    static override liveProps: readonly string[] = []
    private closeScope: (() => void) | null = null

    initialize(): void {
        const router = this._runtime.router
        if (router == null) throw new Error('RouteScope requires a router in FrayRuntime')
        this.closeScope = router.openScope(this.props.context, this)
    }

    render(): FrayChild {
        return h(Fragment, null, this.props.children ?? [])
    }

    override afterMount(): void {
        this._runtime.router?.completeScope(this.props.context, this)
    }

    override _routeContextForChildren(): ResolvedRoute {
        return this.props.context
    }

    override onDestroy(): void {
        this.closeScope?.()
        this.closeScope = null
    }
}
