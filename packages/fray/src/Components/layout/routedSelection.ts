import type {FrayChild, Key} from '../component.js'
import {Component, h} from '../component.js'
import type {ValueEmitter} from '../controlUtils.js'
import {RouteScope} from '../../routing/RouteScope.js'
import type {LiteralRouteDescriptor} from '../../routing/route.js'
import type {BrowserRouter, ResolvedRoute} from '../../routing/router.js'

export type ContentMountPolicy = 'eager' | 'lazy' | 'active-only'

export interface RoutedSelectionItem {
    id: Key
    disabled: boolean
    route?: LiteralRouteDescriptor
}

interface RoutedSelectionOptions {
    subject: string
    restoredCause: string
    pendingCause: string
    selectedCause: string
}

/** @internal Shared literal-route and mounted-content lifecycle for selection owners. */
export class RoutedSelectionController<TItem extends RoutedSelectionItem> {
    private routeContexts = new Map<LiteralRouteDescriptor, ResolvedRoute>()
    private readonly mountedIds = new Set<Key>()
    private registeredRouter: BrowserRouter | null = null
    private registeredParent: ResolvedRoute | null = null

    constructor(
        private readonly owner: Component,
        readonly valueEmitter: ValueEmitter<Key | null>,
        private readonly options: RoutedSelectionOptions,
    ) {}

    prepare(items: readonly TItem[]): void {
        this.registerRoutes(items)
        const requested = this.pendingItem(items)
        if (requested != null) {
            this.valueEmitter.set(requested.id, this.options.pendingCause)
        } else if (!items.some(({id}) => Object.is(id, this.valueEmitter.get()))) {
            this.valueEmitter.set(items.find((item) => !item.disabled)?.id ?? null)
        }
    }

    selected(items: readonly TItem[]): TItem | null {
        return items.find(({id}) => Object.is(id, this.valueEmitter.get()))
            ?? items.find((item) => !item.disabled)
            ?? null
    }

    updateMounted(items: readonly TItem[], policy: ContentMountPolicy): ReadonlySet<Key> {
        const availableIds = new Set(items.map(({id}) => id))
        for (const id of this.mountedIds) {
            if (!availableIds.has(id)) this.mountedIds.delete(id)
        }

        const selectedId = this.selected(items)?.id
        if (policy === 'eager') {
            for (const {id} of items) this.mountedIds.add(id)
        } else {
            if (policy === 'active-only') this.mountedIds.clear()
            if (selectedId !== undefined) this.mountedIds.add(selectedId)
        }
        return this.mountedIds
    }

    select(item: TItem): void {
        const context = item.route == null ? null : this.routeContexts.get(item.route)
        if (context == null) {
            this.valueEmitter.set(item.id, this.options.selectedCause)
        } else {
            void this.registeredRouter?.navigate(context)
        }
    }

    scopedContent(item: TItem, content: FrayChild): FrayChild {
        const context = item.route == null ? null : this.routeContexts.get(item.route)
        return context == null
            ? content
            : h(RouteScope, {key: context.pathname, context}, content)
    }

    dispose(): void {
        if (this.registeredRouter != null && this.registeredParent != null) {
            this.registeredRouter.unregisterRoutes(this.registeredParent, this.owner)
        }
        this.registeredRouter = null
        this.registeredParent = null
        this.routeContexts.clear()
        this.mountedIds.clear()
    }

    private registerRoutes(items: readonly TItem[]): void {
        const router = this.owner._runtime.router
        const parent = this.owner._routeContext
        if (this.registeredRouter != null && this.registeredParent != null) {
            this.registeredRouter.unregisterRoutes(this.registeredParent, this.owner)
        }
        this.registeredRouter = null
        this.registeredParent = null
        this.routeContexts.clear()

        const routed = items.filter((item): item is TItem & {
            route: LiteralRouteDescriptor
        } => item.route != null)
        if (routed.length === 0) return
        if (router == null || parent == null) {
            throw new Error(`Routed ${this.options.subject} require a router and contextual route scope`)
        }

        this.registeredRouter = router
        this.registeredParent = parent
        this.routeContexts = new Map(router.registerSelectionRoutes(
            parent,
            this.owner,
            routed.map((item) => ({
                route: item.route,
                disabled: item.disabled,
                active: () => Object.is(this.valueEmitter.get(), item.id),
                activate: () => {
                    this.valueEmitter.set(item.id, this.options.restoredCause)
                },
            })),
            (listener) => this.valueEmitter.subscribe(listener, {emitCurrent: false}),
        ))
    }

    private pendingItem(items: readonly TItem[]): TItem | undefined {
        const transition = this.registeredRouter?.transition.get()
        if (transition?.state !== 'pending') return undefined
        const requestedPathname = transition.requestedLocation.split('?', 1)[0] || '/'
        return items.find((item) => {
            if (item.disabled || item.route == null) return false
            const context = this.routeContexts.get(item.route)
            return context != null && (
                requestedPathname === context.pathname
                || requestedPathname.startsWith(`${context.pathname}/`)
            )
        })
    }
}

export function readContentMountPolicy(
    value: unknown,
    componentName: string,
): ContentMountPolicy {
    const policy = value ?? 'eager'
    if (policy !== 'eager' && policy !== 'lazy' && policy !== 'active-only') {
        throw new TypeError(`${componentName} mountPolicy must be eager, lazy, or active-only`)
    }
    return policy
}
