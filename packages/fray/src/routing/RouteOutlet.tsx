import {Component, css} from '../Components/component.js'
import type {FrayChild, Key} from '../Components/component.js'
import {componentClass, controlId, createValueEmitter} from '../Components/controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../Components/controlUtils.js'
import {
    RoutedSelectionController,
    readContentMountPolicy,
} from '../Components/layout/routedSelection.js'
import type {
    ContentMountPolicy,
    RoutedSelectionItem,
} from '../Components/layout/routedSelection.js'
import {RouteScope} from './RouteScope.js'
import type {LiteralRouteDescriptor} from './route.js'

export interface RouteOutletDefinition {
    id: Key
    route: LiteralRouteDescriptor
    disabled?: boolean
    content?: FrayChild
    component?: FrayChild
}

export interface RouteOutletProps extends ValueControlProps<Key | null> {
    id?: string | number | null
    views: readonly RouteOutletDefinition[]
    activeViewEmitter?: ValueEmitter<Key | null>
    initialActiveViewId?: Key | null
    /** Controls when routed content is mounted and whether inactive content is retained. */
    mountPolicy?: ContentMountPolicy
}

interface NormalizedRouteView extends RoutedSelectionItem {
    route: LiteralRouteDescriptor
    content: FrayChild
}

/** Demand-driven non-tab routed content with application-owned selection state. */
export class RouteOutlet extends Component<RouteOutletProps> {
    static override liveProps: readonly string[] = []
    readonly valueEmitter: ValueEmitter<Key | null>
    readonly activeViewEmitter: ValueEmitter<Key | null>
    readonly outletId: string
    private readonly selection: RoutedSelectionController<NormalizedRouteView>

    constructor(props: RouteOutletProps) {
        super(props)
        const views = normalizeViews(props.views)
        const emitterProps: RouteOutletProps = {...props}
        if (emitterProps.valueEmitter == null && props.activeViewEmitter != null) {
            emitterProps.valueEmitter = props.activeViewEmitter
        }
        if (emitterProps.defaultValue == null && props.initialActiveViewId != null) {
            emitterProps.defaultValue = props.initialActiveViewId
        }
        this.valueEmitter = createValueEmitter<Key | null>(
            this,
            emitterProps,
            views.find((view) => !view.disabled)?.id ?? null,
            'active route view',
        )
        this.activeViewEmitter = this.valueEmitter
        this.outletId = controlId('route-outlet', props.id)
        this.selection = new RoutedSelectionController(this, this.valueEmitter, {
            subject: 'outlet views',
            restoredCause: 'route view restored',
            pendingCause: 'pending route view selected',
            selectedCause: 'route view selected',
        })
    }

    initialize(): void {
        const views = normalizeViews(this.props.views)
        readContentMountPolicy(this.props.mountPolicy, 'RouteOutlet')
        this.selection.prepare(views)
        this.watch(this.valueEmitter)
    }

    setProps(nextProps: RouteOutletProps): this {
        readContentMountPolicy(nextProps.mountPolicy, 'RouteOutlet')
        super.setProps(nextProps)
        this.selection.prepare(normalizeViews(nextProps.views))
        this.update()
        return this
    }

    render(): FrayChild {
        const views = normalizeViews(this.props.views)
        const policy = readContentMountPolicy(this.props.mountPolicy, 'RouteOutlet')
        const selected = this.selection.selected(views)
        const mountedIds = this.selection.updateMounted(views, policy)
        const Host = this.Host
        return <Host
            id={this.outletId}
            className={componentClass(this.props) || null}
        >{views.map((view) => {
                const active = selected != null && Object.is(selected.id, view.id)
                return <div
                    key={String(view.id)}
                    hidden={!active}
                >{mountedIds.has(view.id)
                        ? this.selection.scopedContent(view, view.content)
                        : null}</div>
            })}</Host>
    }

    override onDestroy(): void {
        this.selection.dispose()
    }

    static dependencies = [RouteScope]
    static override hostName = 'route-outlet'

    static override css = css`
        & {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
        }

        & > div {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: auto;
        }

        & > div[hidden] {
            display: none;
        }
    `
}

function normalizeViews(views: unknown): NormalizedRouteView[] {
    if (!Array.isArray(views)) throw new TypeError('RouteOutlet views must be an array')
    const ids = new Set<Key>()
    const routes = new Set<LiteralRouteDescriptor>()
    return views.map((view: RouteOutletDefinition) => {
        if (view == null || view.id == null) throw new TypeError('Each route view requires an id')
        if (view.route == null || view.route.kind !== 'literal') {
            throw new TypeError('Each route view requires a literal route descriptor')
        }
        if (ids.has(view.id)) throw new Error(`Duplicate route view id: ${String(view.id)}`)
        if (routes.has(view.route)) throw new Error(`Duplicate outlet route: ${view.route.id}`)
        ids.add(view.id)
        routes.add(view.route)
        return {
            id: view.id,
            route: view.route,
            disabled: Boolean(view.disabled),
            content: view.content ?? view.component ?? [],
        }
    })
}
