import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {Emitter, FetchState} from '@sylwellsoftware/glue'
import {
    BrowserRouter,
    MemoryNavigationAdapter,
    RouteUnavailableError,
    createBrowserRouter,
    defineRoute,
    defineRouteParameter,
    formatRouteTarget,
    routeParameter,
    routeTarget,
    stringRouteCodec,
    stringRouteQueryCodec,
    waitForRouteValue,
} from '../src/index.js'
import type {ResolvedRoute} from '../src/index.js'

describe('route declarations and adapters', () => {
    test('formats immutable literal and dynamic route targets canonically', () => {
        const security = defineRoute('security')
        const projects = defineRoute('projects')
        const project = defineRouteParameter('project', stringRouteCodec, 'project-id')
        const target = routeTarget(
            security,
            projects,
            routeParameter(project, 'acme web'),
        )

        assert.equal(formatRouteTarget(target), '/security/projects/acme%20web')
        assert.throws(() => (target.routes as unknown[]).push(security),
            /extensible|read only|object/i)
    })

    test('memory navigation preserves history intent', () => {
        const adapter = new MemoryNavigationAdapter('/first')
        const visited: string[] = []
        const unsubscribe = adapter.subscribe(() => visited.push(adapter.read()))

        adapter.push('/second')
        adapter.replace('/second?sort=name')
        assert.equal(adapter.length, 2)
        assert.equal(adapter.read(), '/second?sort=name')

        adapter.back()
        adapter.forward()
        unsubscribe()
        adapter.back()

        assert.deepEqual(visited, ['/first', '/second?sort=name'])
    })

    test('rejects ambiguous sibling paths and parameter routes when a scope completes', () => {
        const firstAdapter = new MemoryNavigationAdapter('/')
        const firstRouter = createBrowserRouter({adapter: firstAdapter})
        const firstOwner = {}
        firstRouter.openScope(firstRouter.root, firstOwner)
        firstRouter.registerSelectionRoutes(firstRouter.root, firstOwner, [
            selection(defineRoute('first', 'same'), new Emitter('first'), 'first'),
            selection(defineRoute('second', 'same'), new Emitter('second'), 'second'),
        ], () => () => {})
        assert.throws(() => firstRouter.completeScope(firstRouter.root, firstOwner),
            /Duplicate route path/)
        firstRouter.dispose()

        const secondAdapter = new MemoryNavigationAdapter('/')
        const secondRouter = createBrowserRouter({adapter: secondAdapter})
        const secondOwner = {}
        secondRouter.openScope(secondRouter.root, secondOwner)
        secondRouter.registerValueRoute(secondRouter.root, secondOwner, {
            route: defineRouteParameter('first-value', stringRouteCodec),
            valueEmitter: new Emitter<string | null>(null),
        })
        secondRouter.registerValueRoute(secondRouter.root, secondOwner, {
            route: defineRouteParameter('second-value', stringRouteCodec),
            valueEmitter: new Emitter<string | null>(null),
        })
        assert.throws(() => secondRouter.completeScope(secondRouter.root, secondOwner),
            /Ambiguous parameter routes/)
        secondRouter.dispose()
    })
})

describe('BrowserRouter', () => {
    test('progressively restores ordered scopes, async values, and query state', async () => {
        const fixture = createNestedFixture('/security/projects/acme?sort=name')
        const rootOwner = {}
        const rootClose = fixture.router.openScope(fixture.router.root, rootOwner)
        const appRoutes = fixture.router.registerSelectionRoutes(
            fixture.router.root,
            rootOwner,
            [
                selection(fixture.routes.changes, fixture.app, 'changes'),
                selection(fixture.routes.security, fixture.app, 'security'),
            ],
            (listener) => fixture.app.subscribe(listener, {emitCurrent: false}),
        )
        fixture.router.completeScope(fixture.router.root, rootOwner)

        await waitUntil(() => fixture.app.get() === 'security')
        const securityContext = requiredContext(appRoutes, fixture.routes.security)
        const securityOwner = {}
        const securityClose = fixture.router.openScope(securityContext, securityOwner)
        const viewRoutes = fixture.router.registerSelectionRoutes(
            securityContext,
            securityOwner,
            [
                selection(fixture.routes.overview, fixture.view, 'overview'),
                selection(fixture.routes.projects, fixture.view, 'projects'),
            ],
            (listener) => fixture.view.subscribe(listener, {emitCurrent: false}),
        )
        fixture.router.completeScope(securityContext, securityOwner)

        await waitUntil(() => fixture.view.get() === 'projects')
        const projectsContext = requiredContext(viewRoutes, fixture.routes.projects)
        const projectsOwner = {}
        const projectsClose = fixture.router.openScope(projectsContext, projectsOwner)
        const projectRegistration = fixture.router.registerValueRoute(
            projectsContext,
            projectsOwner,
            {
                route: fixture.routes.project,
                valueEmitter: fixture.project,
                resolve: async (id, _context, signal) => {
                    const projects = await waitForRouteValue(
                        fixture.projects,
                        (items) => items.length > 0,
                        signal,
                    )
                    if (!projects.includes(id)) {
                        throw new RouteUnavailableError(`Unknown project "${id}"`)
                    }
                    return id
                },
            },
        )
        const removeQuery = fixture.router.registerQuery(projectsContext, projectsOwner, {
            name: 'sort',
            valueEmitter: fixture.sort,
            codec: stringRouteQueryCodec,
            defaultValue: 'recent',
        })
        fixture.router.completeScope(projectsContext, projectsOwner)

        assert.equal(fixture.project.get(), null)
        assert.equal(fixture.router.transition.get().state, 'pending')
        assert.equal(fixture.sort.get(), 'name')

        fixture.projects.setWithState(['acme'], FetchState.Ready)
        await waitUntil(() => fixture.router.transition.get().state === 'idle')

        assert.equal(fixture.project.get(), 'acme')
        assert.equal(fixture.adapter.read(), '/security/projects/acme?sort=name')
        assert.equal(fixture.router.issue.get(), null)

        fixture.sort.set('owner')
        await flushMicrotasks()
        assert.equal(fixture.adapter.read(), '/security/projects/acme?sort=owner')
        assert.equal(fixture.adapter.length, 1)

        await fixture.router.navigate(requiredContext(appRoutes, fixture.routes.changes))
        await waitUntil(() => fixture.router.transition.get().state === 'idle')
        assert.equal(fixture.adapter.read(), '/changes')
        assert.equal(fixture.adapter.length, 2)

        fixture.adapter.back()
        await waitUntil(() => fixture.router.transition.get().state === 'idle'
            && fixture.app.get() === 'security')
        assert.equal(fixture.view.get(), 'projects')
        assert.equal(fixture.project.get(), 'acme')

        removeQuery()
        projectRegistration.dispose()
        projectsClose()
        securityClose()
        rootClose()
        fixture.router.dispose()
    })

    test('falls back to the deepest valid parent and reports a structured issue', async () => {
        const fixture = createNestedFixture('/security/projects/missing')
        fixture.projects.setWithState(['acme'], FetchState.Ready)
        const cleanup = mountNestedScopes(fixture)

        await waitUntil(() => fixture.router.transition.get().state === 'idle')

        assert.equal(fixture.app.get(), 'security')
        assert.equal(fixture.view.get(), 'projects')
        assert.equal(fixture.project.get(), null)
        assert.equal(fixture.adapter.read(), '/security/projects')
        assert.deepEqual(fixture.router.issue.get(), {
            requestedLocation: '/security/projects/missing',
            failedRouteId: 'project',
            reason: 'Unknown project "missing"',
            fallbackLocation: '/security/projects',
        })

        cleanup()
        fixture.router.dispose()
    })

    test('new navigation aborts a pending resolver and ignores its late result', async () => {
        const fixture = createNestedFixture('/security/projects/acme')
        const cleanup = mountNestedScopes(fixture)

        await waitUntil(() => fixture.router.transition.get().state === 'pending'
            && fixture.view.get() === 'projects')
        const changes = fixture.router.resolve(fixture.routes.changes, fixture.router.root)
        await fixture.router.navigate(changes)
        await waitUntil(() => fixture.router.transition.get().state === 'idle')

        fixture.projects.setWithState(['acme'], FetchState.Ready)
        await flushMicrotasks()
        assert.equal(fixture.project.get(), null)
        assert.equal(fixture.app.get(), 'changes')
        assert.equal(fixture.adapter.read(), '/changes')

        cleanup()
        fixture.router.dispose()
    })

    test('uses a resolver-normalized dynamic value for child discovery and canonicalization', async () => {
        const adapter = new MemoryNavigationAdapter('/projects/ACME/details')
        const router = createBrowserRouter({adapter})
        const projectsRoute = defineRoute('projects')
        const projectRoute = defineRouteParameter('project', stringRouteCodec)
        const detailsRoute = defineRoute('details')
        const section = new Emitter('projects')
        const project = new Emitter<string | null>(null)
        const child = new Emitter('details')
        const rootOwner = {}
        const projectsOwner = {}
        const projectOwner = {}

        router.openScope(router.root, rootOwner)
        const rootRoutes = router.registerSelectionRoutes(router.root, rootOwner, [
            selection(projectsRoute, section, 'projects'),
        ], (listener) => section.subscribe(listener, {emitCurrent: false}))
        router.completeScope(router.root, rootOwner)
        const projectsContext = requiredContext(rootRoutes, projectsRoute)
        router.openScope(projectsContext, projectsOwner)
        const projectRegistration = router.registerValueRoute(projectsContext, projectsOwner, {
            route: projectRoute,
            valueEmitter: project,
            resolve: (value) => value.toLowerCase(),
        })
        router.completeScope(projectsContext, projectsOwner)

        await waitUntil(() => project.get() === 'acme')
        const projectContext = projectRegistration.contextFor('acme')
        router.openScope(projectContext, projectOwner)
        router.registerSelectionRoutes(projectContext, projectOwner, [
            selection(detailsRoute, child, 'details'),
        ], (listener) => child.subscribe(listener, {emitCurrent: false}))
        router.completeScope(projectContext, projectOwner)
        await waitUntil(() => router.transition.get().state === 'idle')

        assert.equal(adapter.read(), '/projects/acme/details')
        assert.equal(project.get(), 'acme')
        assert.equal(router.issue.get(), null)
        router.dispose()
    })

    test('defaults malformed query values, retains foreign keys, and reports the issue', async () => {
        const adapter = new MemoryNavigationAdapter('/history?range=invalid&utm=campaign')
        const router = createBrowserRouter({adapter})
        const historyRoute = defineRoute('history')
        const active = new Emitter('history')
        const range = new Emitter('six-months')
        const owner = {}
        const childOwner = {}

        router.openScope(router.root, owner)
        const routes = router.registerSelectionRoutes(router.root, owner, [
            selection(historyRoute, active, 'history'),
        ], (listener) => active.subscribe(listener, {emitCurrent: false}))
        const context = requiredContext(routes, historyRoute)
        router.openScope(context, childOwner)
        router.registerQuery(context, childOwner, {
            name: 'range',
            valueEmitter: range,
            codec: {
                parse(values) {
                    if (values.length !== 1 || values[0] !== 'twelve-months') {
                        throw new TypeError('Unsupported history range')
                    }
                    return values[0]
                },
                format: (value) => [value],
            },
            defaultValue: 'six-months',
        })
        router.completeScope(context, childOwner)
        router.completeScope(router.root, owner)
        await waitUntil(() => router.transition.get().state === 'idle')

        assert.equal(range.get(), 'six-months')
        assert.equal(adapter.read(), '/history?utm=campaign')
        assert.match(router.issue.get()?.reason ?? '', /Unsupported history range/)
        router.dispose()
    })

    test('falls back cleanly when a path contains malformed percent encoding', async () => {
        const adapter = new MemoryNavigationAdapter('/%E0%A4%A')
        const router = createBrowserRouter({adapter})
        const homeRoute = defineRoute('home')
        const active = new Emitter('home')
        const owner = {}

        router.openScope(router.root, owner)
        router.registerSelectionRoutes(router.root, owner, [
            selection(homeRoute, active, 'home'),
        ], (listener) => active.subscribe(listener, {emitCurrent: false}))
        router.completeScope(router.root, owner)
        await waitUntil(() => router.transition.get().state === 'idle')

        assert.equal(adapter.read(), '/home')
        assert.match(router.issue.get()?.reason ?? '', /malformed percent encoding/)
        router.dispose()
    })
})

interface NestedFixture {
    router: BrowserRouter
    adapter: MemoryNavigationAdapter
    app: Emitter<string>
    view: Emitter<string>
    project: Emitter<string | null>
    projects: Emitter<readonly string[]>
    sort: Emitter<string>
    routes: {
        changes: ReturnType<typeof defineRoute>
        security: ReturnType<typeof defineRoute>
        overview: ReturnType<typeof defineRoute>
        projects: ReturnType<typeof defineRoute>
        project: ReturnType<typeof defineRouteParameter<string>>
    }
}

function createNestedFixture(location: string): NestedFixture {
    const adapter = new MemoryNavigationAdapter(location)
    return {
        adapter,
        router: createBrowserRouter({adapter}),
        app: new Emitter('changes'),
        view: new Emitter('overview'),
        project: new Emitter<string | null>(null),
        projects: new Emitter<readonly string[]>([], {fetchState: FetchState.Loading}),
        sort: new Emitter('recent'),
        routes: {
            changes: defineRoute('changes'),
            security: defineRoute('security'),
            overview: defineRoute('overview'),
            projects: defineRoute('projects'),
            project: defineRouteParameter('project', stringRouteCodec, 'project-id'),
        },
    }
}

function mountNestedScopes(fixture: NestedFixture): () => void {
    const rootOwner = {}
    const securityOwner = {}
    const projectsOwner = {}
    const rootClose = fixture.router.openScope(fixture.router.root, rootOwner)
    const appRoutes = fixture.router.registerSelectionRoutes(
        fixture.router.root,
        rootOwner,
        [
            selection(fixture.routes.changes, fixture.app, 'changes'),
            selection(fixture.routes.security, fixture.app, 'security'),
        ],
        (listener) => fixture.app.subscribe(listener, {emitCurrent: false}),
    )
    fixture.router.completeScope(fixture.router.root, rootOwner)
    const securityContext = requiredContext(appRoutes, fixture.routes.security)
    const securityClose = fixture.router.openScope(securityContext, securityOwner)
    const viewRoutes = fixture.router.registerSelectionRoutes(
        securityContext,
        securityOwner,
        [
            selection(fixture.routes.overview, fixture.view, 'overview'),
            selection(fixture.routes.projects, fixture.view, 'projects'),
        ],
        (listener) => fixture.view.subscribe(listener, {emitCurrent: false}),
    )
    fixture.router.completeScope(securityContext, securityOwner)
    const projectsContext = requiredContext(viewRoutes, fixture.routes.projects)
    const projectsClose = fixture.router.openScope(projectsContext, projectsOwner)
    const projectRegistration = fixture.router.registerValueRoute(
        projectsContext,
        projectsOwner,
        {
            route: fixture.routes.project,
            valueEmitter: fixture.project,
            resolve: async (id, _context, signal) => {
                const projects = await waitForRouteValue(
                    fixture.projects,
                    (items) => items.length > 0,
                    signal,
                )
                if (!projects.includes(id)) {
                    throw new RouteUnavailableError(`Unknown project "${id}"`)
                }
                return id
            },
        },
    )
    fixture.router.completeScope(projectsContext, projectsOwner)
    return () => {
        projectRegistration.dispose()
        projectsClose()
        securityClose()
        rootClose()
    }
}

function selection(
    route: ReturnType<typeof defineRoute>,
    emitter: Emitter<string>,
    value: string,
) {
    return {
        route,
        active: () => emitter.get() === value,
        activate: () => {
            emitter.set(value)
        },
    }
}

function requiredContext(
    contexts: ReadonlyMap<ReturnType<typeof defineRoute>, ResolvedRoute>,
    route: ReturnType<typeof defineRoute>,
): ResolvedRoute {
    const context = contexts.get(route)
    if (context == null) throw new Error(`Missing route context: ${route.id}`)
    return context
}

async function waitUntil(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return
        await new Promise<void>((resolve) => setImmediate(resolve))
    }
    throw new Error('Condition did not become true')
}

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
}
