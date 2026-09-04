import {Emitter} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'

import type {WritableEmitter} from '../Components/component.js'
import type {NavigationAdapter} from './navigationAdapter.js'
import {normalizeRouteLocation} from './navigationAdapter.js'
import {
    RouteRedirect,
    RouteUnavailableError,
    assertRouteDescriptor,
    assertRouteQueryCodec,
    assertRouteTarget,
    formatRouteTarget,
} from './route.js'
import type {
    AnyRouteDescriptor,
    LiteralRouteDescriptor,
    ParameterRouteDescriptor,
    RouteDescriptor,
    RouteQueryCodec,
    RouteResolveContext,
    RouteTarget,
    RouteValueResolver,
} from './route.js'

export type NavigationHistoryMode = 'push' | 'replace'

export interface BrowserRouterOptions {
    adapter: NavigationAdapter
}

export interface NavigationTransition {
    readonly state: 'pending' | 'idle'
    readonly requestedLocation: string
    readonly settledLocation: string
}

export interface NavigationIssue {
    readonly requestedLocation: string
    readonly failedRouteId: string | null
    readonly reason: string
    readonly fallbackLocation: string
}

export interface ResolvedRoute {
    readonly route: AnyRouteDescriptor | null
    readonly parent: ResolvedRoute | null
    readonly segment: string | null
    readonly value: unknown
    readonly pathname: string
}

export interface SelectionRouteBinding {
    readonly route: LiteralRouteDescriptor
    readonly active: () => boolean
    readonly activate: (signal: AbortSignal) => void | Promise<void>
    readonly disabled?: boolean
}

export interface ValueRouteBinding<TValue> {
    readonly route: ParameterRouteDescriptor<TValue>
    readonly valueEmitter: WritableEmitter<TValue | null>
    readonly resolve?: RouteValueResolver<TValue>
}

export interface RouteQueryBinding<TValue> {
    readonly name: string
    readonly valueEmitter: WritableEmitter<TValue>
    readonly codec: RouteQueryCodec<TValue>
    readonly defaultValue: TValue
    readonly equals?: (left: TValue, right: TValue) => boolean
}

export interface RouteRegistration {
    readonly context: ResolvedRoute
    dispose(): void
}

interface ScopeOwner {
    complete: boolean
}

interface ScopeRecord {
    readonly owners: Map<object, ScopeOwner>
    readonly entries: Map<AnyRouteDescriptor, RouteEntry>
    readonly queries: Map<string, QueryEntry<unknown>>
}

interface RouteEntry {
    readonly owner: object
    readonly descriptor: AnyRouteDescriptor
    readonly parent: ResolvedRoute
    readonly match: (segment: string) => MatchResult | null
    readonly currentValue: () => unknown | null
    readonly activate: (
        match: MatchResult,
        context: RouteResolveContext,
        signal: AbortSignal,
    ) => MatchResult | RouteRedirect | Promise<MatchResult | RouteRedirect>
    readonly context: (value: unknown) => ResolvedRoute
    readonly disposeSubscription: () => void
}

interface QueryEntry<TValue> {
    readonly owner: object
    readonly context: ResolvedRoute
    readonly name: string
    readonly emitter: WritableEmitter<TValue>
    readonly codec: RouteQueryCodec<TValue>
    readonly defaultValue: TValue
    readonly equals: (left: TValue, right: TValue) => boolean
    readonly disposeSubscription: () => void
}

interface MatchResult {
    readonly value: unknown
}

interface ParsedLocation {
    readonly location: string
    readonly pathname: string
    readonly segments: readonly string[]
    readonly search: URLSearchParams
}

const MAX_REDIRECTS = 16

export class BrowserRouter {
    readonly root: ResolvedRoute
    readonly transition: ReadableEmitter<NavigationTransition>
    readonly issue: ReadableEmitter<NavigationIssue | null>

    private readonly transitionEmitter: Emitter<NavigationTransition>
    private readonly issueEmitter: Emitter<NavigationIssue | null>
    private readonly scopes = new Map<ResolvedRoute, ScopeRecord>()
    private readonly contextCache = new Map<string, ResolvedRoute>()
    private readonly knownQueryNames = new Set<string>()
    private readonly registryWaiters = new Set<() => void>()
    private readonly adapterUnsubscribe: () => void
    private controller: AbortController | null = null
    private activeContext: ResolvedRoute
    private requested: ParsedLocation
    private applying = 0
    private syncQueued = false
    private disposed = false

    constructor(readonly adapter: NavigationAdapter) {
        assertNavigationAdapter(adapter)
        this.root = Object.freeze({
            route: null,
            parent: null,
            segment: null,
            value: null,
            pathname: '/',
        })
        resolvedRouteOwners.set(this.root, this)
        this.activeContext = this.root
        this.requested = parseLocation(adapter.read())
        const initialTransition = Object.freeze({
            state: 'pending' as const,
            requestedLocation: this.requested.location,
            settledLocation: '/',
        })
        this.transitionEmitter = new Emitter<NavigationTransition>(initialTransition, {
            owner: this,
            purpose: 'browser route transition',
        })
        this.issueEmitter = new Emitter<NavigationIssue | null>(null, {
            owner: this,
            purpose: 'browser route issue',
        })
        this.transition = this.transitionEmitter
        this.issue = this.issueEmitter
        this.adapterUnsubscribe = adapter.subscribe(() => {
            this.startTransition(adapter.read(), 0, false)
        })
        this.startTransition(this.requested.location, 0, false)
    }

    openScope(context: ResolvedRoute, owner: object): () => void {
        this.assertActive()
        assertResolvedRoute(context, this)
        assertOwner(owner)
        const scope = this.scope(context)
        if (scope.owners.has(owner)) throw new Error('Route scope owner is already registered')
        scope.owners.set(owner, {complete: false})
        this.wakeRegistry()
        let active = true
        return () => {
            if (!active) return
            active = false
            scope.owners.delete(owner)
            this.removeOwnerEntries(scope, owner)
            this.removeOwnerQueries(scope, owner)
            if (scope.owners.size === 0
                && scope.entries.size === 0
                && scope.queries.size === 0) {
                this.scopes.delete(context)
            }
            this.wakeRegistry()
        }
    }

    completeScope(context: ResolvedRoute, owner: object): void {
        this.assertActive()
        assertResolvedRoute(context, this)
        const scopeOwner = this.scope(context).owners.get(owner)
        if (scopeOwner == null) throw new Error('Cannot complete an unopened route scope')
        validateScope(this.scope(context))
        scopeOwner.complete = true
        this.wakeRegistry()
    }

    registerSelectionRoutes(
        parent: ResolvedRoute,
        owner: object,
        bindings: readonly SelectionRouteBinding[],
        subscribe: (listener: () => void) => () => void,
    ): ReadonlyMap<LiteralRouteDescriptor, ResolvedRoute> {
        this.assertActive()
        assertResolvedRoute(parent, this)
        assertOwner(owner)
        if (!Array.isArray(bindings)) throw new TypeError('Route bindings must be an array')
        if (typeof subscribe !== 'function') {
            throw new TypeError('Selection route registration requires a subscriber')
        }
        const scope = this.scope(parent)
        const contexts = new Map<LiteralRouteDescriptor, ResolvedRoute>()
        const descriptors = new Set<LiteralRouteDescriptor>()
        for (const binding of bindings) {
            assertRouteDescriptor(binding.route)
            if (binding.route.kind !== 'literal') {
                throw new TypeError('Tab routes must use literal route descriptors')
            }
            if (descriptors.has(binding.route) || scope.entries.has(binding.route)) {
                throw new Error(`Duplicate route in one scope: ${binding.route.id}`)
            }
            descriptors.add(binding.route)
            const context = this.literalContext(parent, binding.route)
            const entry: RouteEntry = {
                owner,
                descriptor: binding.route,
                parent,
                match: (segment) => decodeSegment(segment) === binding.route.path
                    ? {value: null}
                    : null,
                currentValue: () => binding.active() ? null : undefined,
                activate: async (match, _context, signal) => {
                    if (binding.disabled) {
                        throw new RouteUnavailableError(
                            `Route "${binding.route.id}" is currently disabled`,
                        )
                    }
                    if (signal.aborted) throw signal.reason
                    await binding.activate(signal)
                    return match
                },
                context: () => context,
                disposeSubscription: () => {},
            }
            scope.entries.set(binding.route, entry)
            contexts.set(binding.route, context)
        }
        const unsubscribe = subscribe(() => this.scheduleStateSync())
        for (const descriptor of descriptors) {
            const entry = scope.entries.get(descriptor)
            if (entry != null) {
                ;(entry as {disposeSubscription: () => void}).disposeSubscription = unsubscribe
            }
        }
        this.wakeRegistry()
        return contexts
    }

    unregisterRoutes(parent: ResolvedRoute, owner: object): void {
        const scope = this.scopes.get(parent)
        if (scope == null) return
        this.removeOwnerEntries(scope, owner)
        this.wakeRegistry()
    }

    registerValueRoute<TValue>(
        parent: ResolvedRoute,
        owner: object,
        binding: ValueRouteBinding<TValue>,
    ): RouteRegistration & {contextFor(value: TValue): ResolvedRoute} {
        this.assertActive()
        assertResolvedRoute(parent, this)
        assertOwner(owner)
        assertRouteDescriptor(binding.route)
        if (binding.route.kind !== 'parameter') {
            throw new TypeError('Value routes require a parameter route descriptor')
        }
        assertWritableEmitter(binding.valueEmitter, 'Value route emitter')
        if (binding.resolve != null && typeof binding.resolve !== 'function') {
            throw new TypeError('Value route resolver must be a function')
        }
        const scope = this.scope(parent)
        if (scope.entries.has(binding.route)) {
            throw new Error(`Duplicate route in one scope: ${binding.route.id}`)
        }
        const contextFor = (value: TValue) => this.parameterContext(parent, binding.route, value)
        const unsubscribe = binding.valueEmitter.subscribe(() => this.scheduleStateSync(), {
            emitCurrent: false,
        })
        const entry: RouteEntry = {
            owner,
            descriptor: binding.route,
            parent,
            match: (segment) => {
                const decoded = decodeSegment(segment)
                const value = binding.route.codec.parse(decoded)
                const formatted = binding.route.codec.format(value)
                if (formatted !== decoded) {
                    throw new TypeError(
                        `Route parameter "${binding.route.name}" does not round-trip`,
                    )
                }
                return {value}
            },
            currentValue: () => binding.valueEmitter.get(),
            activate: async (match, context, signal) => {
                const parsed = match.value as TValue
                const resolved = binding.resolve == null
                    ? parsed
                    : await binding.resolve(parsed, context, signal)
                if (resolved instanceof RouteRedirect) return resolved
                if (signal.aborted) throw signal.reason
                this.withApplication(() => binding.valueEmitter.set(
                    resolved,
                    'route value restored',
                ))
                return {value: resolved}
            },
            context: (value) => contextFor(value as TValue),
            disposeSubscription: unsubscribe,
        }
        scope.entries.set(binding.route, entry)
        this.wakeRegistry()
        let active = true
        return {
            context: contextForCurrent(binding.valueEmitter, contextFor, parent),
            contextFor,
            dispose: () => {
                if (!active) return
                active = false
                const current = scope.entries.get(binding.route)
                if (current === entry) scope.entries.delete(binding.route)
                unsubscribe()
                this.wakeRegistry()
            },
        }
    }

    registerQuery<TValue>(
        context: ResolvedRoute,
        owner: object,
        binding: RouteQueryBinding<TValue>,
    ): () => void {
        this.assertActive()
        assertResolvedRoute(context, this)
        assertOwner(owner)
        const name = queryName(binding.name)
        assertWritableEmitter(binding.valueEmitter, 'Route query emitter')
        assertRouteQueryCodec(binding.codec)
        const equals = binding.equals ?? Object.is
        if (typeof equals !== 'function') throw new TypeError('Route query equals must be a function')
        const scope = this.scope(context)
        if (scope.queries.has(name)) throw new Error(`Duplicate route query name: ${name}`)
        this.knownQueryNames.add(name)
        const unsubscribe = binding.valueEmitter.subscribe(() => this.scheduleStateSync(), {
            emitCurrent: false,
        })
        const entry: QueryEntry<TValue> = {
            owner,
            context,
            name,
            emitter: binding.valueEmitter,
            codec: binding.codec,
            defaultValue: binding.defaultValue,
            equals,
            disposeSubscription: unsubscribe,
        }
        scope.queries.set(name, entry as QueryEntry<unknown>)
        this.applyQueryEntry(entry, this.requested)
        this.wakeRegistry()
        let active = true
        return () => {
            if (!active) return
            active = false
            if (scope.queries.get(name) === entry) scope.queries.delete(name)
            unsubscribe()
            this.scheduleStateSync()
        }
    }

    navigate(
        target: RouteTarget | ResolvedRoute,
        options: {history?: NavigationHistoryMode} = {},
    ): Promise<void> {
        this.assertActive()
        const location = isResolvedRoute(target)
            ? this.formatContext(target)
            : formatRouteTarget(assertedTarget(target))
        this.issueEmitter.set(null, 'explicit route navigation')
        if ((options.history ?? 'push') === 'replace') this.adapter.replace(location)
        else this.adapter.push(location)
        return this.startTransition(location, 0, true)
    }

    redirect(target: RouteTarget | ResolvedRoute): Promise<void> {
        return this.navigate(target, {history: 'replace'})
    }

    href(target: RouteTarget | ResolvedRoute): string {
        this.assertActive()
        const location = isResolvedRoute(target)
            ? this.formatContext(target)
            : formatRouteTarget(assertedTarget(target))
        return this.adapter.href(location)
    }

    resolve(route: RouteDescriptor, from: ResolvedRoute): ResolvedRoute {
        assertRouteDescriptor(route)
        assertResolvedRoute(from, this)
        let context: ResolvedRoute | null = from
        while (context != null) {
            const entry = this.scopes.get(context)?.entries.get(route)
            if (entry != null) {
                const value = entry.currentValue()
                if (entry.descriptor.kind === 'parameter' && value == null) {
                    throw new Error(
                        `Dynamic route "${route.id}" requires an explicit parameter value`,
                    )
                }
                return entry.context(value)
            }
            context = context.parent
        }
        throw new Error(`Route "${route.id}" is not registered in the current route lineage`)
    }

    formatActiveLocation(): string {
        return this.formatStateLocation()
    }

    isActive(target: RouteTarget | ResolvedRoute, exact = false): boolean {
        const context = isResolvedRoute(target)
            ? target
            : this.resolveTargetContext(assertedTarget(target))
        return exact ? context === this.activeContext : isAncestor(context, this.activeContext)
    }

    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        this.controller?.abort(new DOMException('Router disposed', 'AbortError'))
        this.controller = null
        this.adapterUnsubscribe()
        for (const scope of this.scopes.values()) {
            const subscriptions = new Set<() => void>()
            for (const entry of scope.entries.values()) subscriptions.add(entry.disposeSubscription)
            for (const entry of scope.queries.values()) subscriptions.add(entry.disposeSubscription)
            for (const unsubscribe of subscriptions) unsubscribe()
        }
        this.scopes.clear()
        this.knownQueryNames.clear()
        this.wakeRegistry()
        this.transitionEmitter.dispose()
        this.issueEmitter.dispose()
    }

    private startTransition(
        location: string,
        redirectDepth: number,
        clearIssue: boolean,
    ): Promise<void> {
        this.assertActive()
        this.controller?.abort(new DOMException('Navigation superseded', 'AbortError'))
        const controller = new AbortController()
        this.controller = controller
        this.requested = parseLocation(location)
        if (clearIssue) this.issueEmitter.set(null, 'route transition started')
        this.transitionEmitter.set(Object.freeze({
            state: 'pending',
            requestedLocation: this.requested.location,
            settledLocation: this.formatContext(this.activeContext),
        }), 'route transition started')
        return this.runTransition(this.requested, controller, redirectDepth).catch((error) => {
            if (!controller.signal.aborted) throw error
        })
    }

    private async runTransition(
        requested: ParsedLocation,
        controller: AbortController,
        redirectDepth: number,
    ): Promise<void> {
        const signal = controller.signal
        let context = this.root
        const values = new Map<AnyRouteDescriptor, unknown>()

        for (const segment of requested.segments) {
            const scope = await this.waitForCompleteScope(context, signal)
            let match: {entry: RouteEntry; match: MatchResult} | null
            try {
                match = matchEntry(scope, segment)
            } catch (error) {
                this.fallback(requested, context, null, routeErrorMessage(error))
                return
            }
            if (match == null) {
                this.fallback(requested, context, null, `Unknown route segment "${decodeSegment(segment)}"`)
                return
            }
            const resolveContext: RouteResolveContext = Object.freeze({
                requestedLocation: requested.location,
                resolvedValues: values,
            })
            try {
                const result = await match.entry.activate(match.match, resolveContext, signal)
                if (result instanceof RouteRedirect) {
                    if (redirectDepth >= MAX_REDIRECTS) {
                        this.fallback(requested, context, match.entry.descriptor, 'Too many route redirects')
                        return
                    }
                    const target = formatRouteTarget(result.target)
                    this.adapter.replace(target)
                    await this.startTransition(target, redirectDepth + 1, false)
                    return
                }
                match = {entry: match.entry, match: result}
            } catch (error) {
                if (signal.aborted) return
                this.fallback(
                    requested,
                    context,
                    match.entry.descriptor,
                    routeErrorMessage(error),
                )
                return
            }
            values.set(match.entry.descriptor, match.match.value)
            context = match.entry.context(match.match.value)
        }

        if (signal.aborted) return
        if (context === this.root) {
            await this.waitForCompleteScope(this.root, signal)
            context = this.findActiveContext()
        }
        if (signal.aborted) return
        this.activeContext = context
        this.applyQueriesInLineage(context, requested)
        const settled = this.formatContext(context)
        if (settled !== requested.location) this.adapter.replace(settled)
        this.transitionEmitter.set(Object.freeze({
            state: 'idle',
            requestedLocation: requested.location,
            settledLocation: settled,
        }), 'route transition settled')
        this.scheduleStateSync()
    }

    private async waitForCompleteScope(
        context: ResolvedRoute,
        signal: AbortSignal,
    ): Promise<ScopeRecord> {
        while (true) {
            if (signal.aborted) throw signal.reason
            const scope = this.scopes.get(context)
            if (scope != null && isScopeComplete(scope)) return scope
            await this.waitForRegistryChange(signal)
        }
    }

    private waitForRegistryChange(signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const wake = () => {
                signal.removeEventListener('abort', abort)
                this.registryWaiters.delete(wake)
                resolve()
            }
            const abort = () => {
                this.registryWaiters.delete(wake)
                reject(signal.reason)
            }
            this.registryWaiters.add(wake)
            signal.addEventListener('abort', abort, {once: true})
        })
    }

    private wakeRegistry(): void {
        const waiters = [...this.registryWaiters]
        this.registryWaiters.clear()
        for (const wake of waiters) wake()
    }

    private fallback(
        requested: ParsedLocation,
        context: ResolvedRoute,
        failedRoute: AnyRouteDescriptor | null,
        reason: string,
    ): void {
        this.activeContext = context
        const fallbackLocation = context === this.root
            ? this.formatStateLocation()
            : this.formatContext(context)
        this.adapter.replace(fallbackLocation)
        this.issueEmitter.set(Object.freeze({
            requestedLocation: requested.location,
            failedRouteId: failedRoute?.id ?? null,
            reason,
            fallbackLocation,
        }), 'route fallback selected')
        this.transitionEmitter.set(Object.freeze({
            state: 'idle',
            requestedLocation: requested.location,
            settledLocation: fallbackLocation,
        }), 'route transition fell back')
    }

    private literalContext(
        parent: ResolvedRoute,
        route: LiteralRouteDescriptor,
    ): ResolvedRoute {
        return this.cachedContext(parent, route, route.path, null)
    }

    private resolveTargetContext(target: RouteTarget): ResolvedRoute {
        let context = this.root
        for (const part of target.routes) {
            if ('route' in part) {
                context = this.parameterContext(context, part.route, part.value)
            } else {
                context = this.literalContext(context, part)
            }
        }
        return context
    }

    private parameterContext<TValue>(
        parent: ResolvedRoute,
        route: ParameterRouteDescriptor<TValue>,
        value: TValue,
    ): ResolvedRoute {
        const formatted = route.codec.format(value)
        if (typeof formatted !== 'string' || formatted === '' || formatted.includes('/')) {
            throw new TypeError(`Route parameter "${route.name}" must format one path segment`)
        }
        return this.cachedContext(parent, route, formatted, value)
    }

    private cachedContext(
        parent: ResolvedRoute,
        route: AnyRouteDescriptor,
        segment: string,
        value: unknown,
    ): ResolvedRoute {
        const pathname = joinPath(parent.pathname, segment)
        const key = `${contextKey(parent)}\u0000${route.id}\u0000${segment}`
        const existing = this.contextCache.get(key)
        if (existing != null) return existing
        const context: ResolvedRoute = Object.freeze({route, parent, segment, value, pathname})
        resolvedRouteOwners.set(context, this)
        this.contextCache.set(key, context)
        return context
    }

    private scope(context: ResolvedRoute): ScopeRecord {
        let scope = this.scopes.get(context)
        if (scope == null) {
            scope = {owners: new Map(), entries: new Map(), queries: new Map()}
            this.scopes.set(context, scope)
        }
        return scope
    }

    private removeOwnerEntries(scope: ScopeRecord, owner: object): void {
        const subscriptions = new Set<() => void>()
        for (const [route, entry] of scope.entries) {
            if (entry.owner !== owner) continue
            subscriptions.add(entry.disposeSubscription)
            scope.entries.delete(route)
        }
        for (const unsubscribe of subscriptions) unsubscribe()
    }

    private removeOwnerQueries(scope: ScopeRecord, owner: object): void {
        for (const [name, entry] of scope.queries) {
            if (entry.owner !== owner) continue
            entry.disposeSubscription()
            scope.queries.delete(name)
        }
    }

    private scheduleStateSync(): void {
        if (this.applying > 0 || this.disposed || this.syncQueued) return
        this.syncQueued = true
        queueMicrotask(() => {
            this.syncQueued = false
            if (this.applying > 0 || this.disposed) return
            if (this.transitionEmitter.get().state === 'pending') return
            const location = this.formatStateLocation()
            if (location !== this.adapter.read()) this.adapter.replace(location)
            this.requested = parseLocation(location)
            this.activeContext = this.findActiveContext()
            this.transitionEmitter.set(Object.freeze({
                ...this.transitionEmitter.get(),
                state: 'idle',
                settledLocation: location,
            }), 'route state synchronized')
        })
    }

    private formatStateLocation(): string {
        return this.formatContext(this.findActiveContext())
    }

    private findActiveContext(): ResolvedRoute {
        let context = this.root
        const visited = new Set<ResolvedRoute>()
        while (!visited.has(context)) {
            visited.add(context)
            const scope = this.scopes.get(context)
            if (scope == null) break
            const active = [...scope.entries.values()].filter((entry) =>
                entry.currentValue() !== undefined && entry.currentValue() !== null)
            const nullableLiteral = [...scope.entries.values()].find((entry) =>
                entry.descriptor.kind === 'literal' && entry.currentValue() === null)
            const entry = active[0] ?? nullableLiteral
            if (entry == null) break
            const value = entry.currentValue()
            context = entry.context(value)
        }
        return context
    }

    private formatContext(context: ResolvedRoute): string {
        const search = new URLSearchParams(this.requested.search)
        for (const name of this.knownQueryNames) search.delete(name)
        for (const lineageContext of routeLineage(context)) {
            const scope = this.scopes.get(lineageContext)
            if (scope == null) continue
            for (const entry of [...scope.queries.values()].sort((left, right) =>
                left.name.localeCompare(right.name))) {
                if (entry.equals(entry.emitter.get(), entry.defaultValue)) continue
                const values = entry.codec.format(entry.emitter.get())
                if (!Array.isArray(values)) {
                    throw new TypeError(`Route query "${entry.name}" codec must format an array`)
                }
                for (const value of values) search.append(entry.name, value)
            }
        }
        search.sort()
        const query = search.toString()
        return `${context.pathname}${query === '' ? '' : `?${query}`}`
    }

    private applyQueriesInLineage(context: ResolvedRoute, requested: ParsedLocation): void {
        for (const lineageContext of routeLineage(context)) {
            const scope = this.scopes.get(lineageContext)
            if (scope == null) continue
            for (const entry of scope.queries.values()) this.applyQueryEntry(entry, requested)
        }
    }

    private applyQueryEntry<TValue>(entry: QueryEntry<TValue>, requested: ParsedLocation): void {
        if (!isAncestor(entry.context, this.activeContext)
            && !isPathPrefix(entry.context.pathname, requested.pathname)) return
        const raw = requested.search.getAll(entry.name)
        try {
            const value = raw.length === 0 ? entry.defaultValue : entry.codec.parse(raw)
            if (!entry.equals(entry.emitter.get(), value)) {
                this.withApplication(() => entry.emitter.set(value, 'route query restored'))
            }
        } catch (error) {
            if (!entry.equals(entry.emitter.get(), entry.defaultValue)) {
                this.withApplication(() => entry.emitter.set(
                    entry.defaultValue,
                    'invalid route query defaulted',
                ))
            }
            const search = new URLSearchParams(requested.search)
            search.delete(entry.name)
            search.sort()
            const fallbackLocation = `${requested.pathname}${search.size === 0
                ? ''
                : `?${search.toString()}`}`
            this.adapter.replace(fallbackLocation)
            this.issueEmitter.set(Object.freeze({
                requestedLocation: requested.location,
                failedRouteId: entry.context.route?.id ?? null,
                reason: routeErrorMessage(error),
                fallbackLocation,
            }), 'invalid route query')
        }
    }

    private withApplication(action: () => void): void {
        this.applying += 1
        try {
            action()
        } finally {
            this.applying -= 1
        }
    }

    private assertActive(): void {
        if (this.disposed) throw new Error('BrowserRouter has been disposed')
    }
}

const resolvedRouteOwners = new WeakMap<object, BrowserRouter>()

export function createBrowserRouter(options: BrowserRouterOptions): BrowserRouter {
    if (options == null || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('Browser router options must be an object')
    }
    return new BrowserRouter(options.adapter)
}

export function waitForRouteValue<TValue, TError>(
    emitter: ReadableEmitter<TValue, TError>,
    accept: (value: TValue) => boolean,
    signal: AbortSignal,
): Promise<TValue> {
    if (emitter == null || typeof emitter.subscribe !== 'function') {
        throw new TypeError('waitForRouteValue requires a readable emitter')
    }
    if (typeof accept !== 'function') {
        throw new TypeError('waitForRouteValue requires an acceptance predicate')
    }
    return new Promise((resolve, reject) => {
        let settled = false
        let unsubscribe = () => {}
        const finish = (action: () => void) => {
            if (settled) return
            settled = true
            unsubscribe()
            signal.removeEventListener('abort', abort)
            action()
        }
        const abort = () => {
            finish(() => reject(signal.reason))
        }
        const inspect = (value: TValue, fetchState: string, error: TError | null) => {
            if (fetchState === 'error') {
                finish(() => reject(
                    error ?? new RouteUnavailableError('Route prerequisite failed'),
                ))
            } else if (accept(value)) {
                finish(() => resolve(value))
            }
        }
        if (signal.aborted) {
            abort()
            return
        }
        inspect(emitter.get(), emitter.getFetchState(), emitter.getError())
        if (settled) return
        unsubscribe = emitter.subscribe(({value, fetchState, error}) => {
            inspect(value, fetchState, error)
        }, {emitCurrent: false})
        if (settled) unsubscribe()
        else signal.addEventListener('abort', abort, {once: true})
    })
}

function parseLocation(location: string): ParsedLocation {
    const normalized = normalizeRouteLocation(location)
    const queryIndex = normalized.indexOf('?')
    const pathname = queryIndex < 0 ? normalized : normalized.slice(0, queryIndex)
    const query = queryIndex < 0 ? '' : normalized.slice(queryIndex + 1)
    const rawSegments = pathname.split('/').filter(Boolean)
    return Object.freeze({
        location: normalized,
        pathname,
        segments: Object.freeze(rawSegments),
        search: new URLSearchParams(query),
    })
}

function validateScope(scope: ScopeRecord): void {
    const ids = new Set<string>()
    const literalPaths = new Set<string>()
    let parameter: AnyRouteDescriptor | null = null
    for (const entry of scope.entries.values()) {
        if (ids.has(entry.descriptor.id)) {
            throw new Error(`Duplicate route id in one scope: ${entry.descriptor.id}`)
        }
        ids.add(entry.descriptor.id)
        if (entry.descriptor.kind === 'literal') {
            if (literalPaths.has(entry.descriptor.path)) {
                throw new Error(`Duplicate route path in one scope: ${entry.descriptor.path}`)
            }
            literalPaths.add(entry.descriptor.path)
        } else if (parameter != null) {
            throw new Error(
                `Ambiguous parameter routes in one scope: ${parameter.id}, ${entry.descriptor.id}`,
            )
        } else {
            parameter = entry.descriptor
        }
    }
}

function matchEntry(
    scope: ScopeRecord,
    segment: string,
): {entry: RouteEntry; match: MatchResult} | null {
    const entries = [...scope.entries.values()].sort((left, right) =>
        left.descriptor.kind === right.descriptor.kind
            ? 0
            : left.descriptor.kind === 'literal' ? -1 : 1)
    for (const entry of entries) {
        const match = entry.match(segment)
        if (match != null) return {entry, match}
    }
    return null
}

function isScopeComplete(scope: ScopeRecord): boolean {
    return scope.owners.size > 0
        && [...scope.owners.values()].every(({complete}) => complete)
}

function routeLineage(context: ResolvedRoute): ResolvedRoute[] {
    const result: ResolvedRoute[] = []
    let current: ResolvedRoute | null = context
    while (current != null) {
        result.unshift(current)
        current = current.parent
    }
    return result
}

function isAncestor(ancestor: ResolvedRoute, context: ResolvedRoute): boolean {
    let current: ResolvedRoute | null = context
    while (current != null) {
        if (current === ancestor) return true
        current = current.parent
    }
    return false
}

function isPathPrefix(parent: string, path: string): boolean {
    return parent === '/' || path === parent || path.startsWith(`${parent}/`)
}

function joinPath(parent: string, segment: string): string {
    return `${parent === '/' ? '' : parent}/${encodeURIComponent(segment)}`
}

function contextKey(context: ResolvedRoute): string {
    return context.pathname
}

function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        throw new RouteUnavailableError('Route contains malformed percent encoding')
    }
}

function queryName(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(value)) {
        throw new TypeError('Route query name must start with a letter and use URL-safe characters')
    }
    return value
}

function routeErrorMessage(error: unknown): string {
    return error instanceof Error && error.message !== ''
        ? error.message
        : 'The requested route could not be resolved'
}

function contextForCurrent<TValue>(
    emitter: WritableEmitter<TValue | null>,
    contextFor: (value: TValue) => ResolvedRoute,
    parent: ResolvedRoute,
): ResolvedRoute {
    const current = emitter.get()
    return current == null ? parent : contextFor(current)
}

function assertedTarget(target: RouteTarget): RouteTarget {
    assertRouteTarget(target)
    return target
}

function isResolvedRoute(value: unknown): value is ResolvedRoute {
    return value != null && typeof value === 'object' && resolvedRouteOwners.has(value)
}

function assertResolvedRoute(
    value: unknown,
    router: BrowserRouter,
): asserts value is ResolvedRoute {
    if (value === router.root) return
    if (!isResolvedRoute(value) || resolvedRouteOwners.get(value) !== router) {
        throw new TypeError('Resolved route does not belong to this router')
    }
}

function assertNavigationAdapter(value: unknown): asserts value is NavigationAdapter {
    if (value == null
        || typeof value !== 'object'
        || typeof Reflect.get(value, 'read') !== 'function'
        || typeof Reflect.get(value, 'href') !== 'function'
        || typeof Reflect.get(value, 'push') !== 'function'
        || typeof Reflect.get(value, 'replace') !== 'function'
        || typeof Reflect.get(value, 'subscribe') !== 'function') {
        throw new TypeError('BrowserRouter requires a navigation adapter')
    }
}

function assertOwner(value: unknown): asserts value is object {
    if (value == null || (typeof value !== 'object' && typeof value !== 'function')) {
        throw new TypeError('Route registration owner must be an object')
    }
}

function assertWritableEmitter(value: unknown, label: string): void {
    if (value == null
        || typeof value !== 'object'
        || typeof Reflect.get(value, 'get') !== 'function'
        || typeof Reflect.get(value, 'set') !== 'function'
        || typeof Reflect.get(value, 'subscribe') !== 'function') {
        throw new TypeError(`${label} must be a writable emitter`)
    }
}
