import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter} from '@sylwellsoftware/glue'
import {
    Component,
    MemoryNavigationAdapter,
    NavigationBar,
    RouteLink,
    RouteOutlet,
    Tab,
    TabPanel,
    createBrowserRouter,
    createFrayRuntime,
    defineRoute,
    h,
    routeTarget,
} from '../src/index.js'
import type {ComponentProps, FrayChild} from '../src/index.js'
import {requiredAt, requiredQuery} from './testUtils.js'

let window: Window

before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {
        window,
        document: window.document,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        EventTarget: window.EventTarget,
        Event: window.Event,
        MouseEvent: window.MouseEvent,
        KeyboardEvent: window.KeyboardEvent,
        DocumentFragment: window.DocumentFragment,
    })
})

afterEach(() => {
    document.body.replaceChildren()
    document.head.replaceChildren()
})

after(() => window.close())

describe('routed Fray components', () => {
    test('navigation and a disconnected outlet converge on application selection', async () => {
        const firstRoute = defineRoute('nav-first')
        const secondRoute = defineRoute('nav-second')
        const disabledRoute = defineRoute('nav-disabled')
        const active = new Emitter<string | number | null>('first')
        const adapter = new MemoryNavigationAdapter('/nav-second')
        const router = createBrowserRouter({adapter})
        const lifecycle: string[] = []

        class ViewProbe extends Component<{name: string}> {
            initialize(): void {
                lifecycle.push(`initialize ${this.props.name}`)
            }
            render(): FrayChild {
                return h('p', null, this.props.name)
            }
            override onDestroy(): void {
                lifecycle.push(`destroy ${this.props.name}`)
            }
        }

        class ActiveProjection extends Component {
            render(): FrayChild {
                return h('output', {'aria-label': 'Active view'}, String(this.read(active)))
            }
        }

        class Shell extends Component {
            render(): FrayChild {
                return h('section', null,
                    h(ActiveProjection),
                    h(NavigationBar, {
                        label: 'Primary',
                        items: [
                            {id: 'first', label: 'First', to: routeTarget(firstRoute)},
                            {id: 'second', label: 'Second', to: routeTarget(secondRoute)},
                            {
                                id: 'disabled',
                                label: 'Disabled',
                                to: routeTarget(disabledRoute),
                                disabled: true,
                            },
                        ],
                    }),
                    h('aside', {id: 'persistent'}, 'Persistent tools'),
                    h(RouteOutlet, {
                        id: 'main-view',
                        valueEmitter: active,
                        mountPolicy: 'active-only',
                        views: [
                            {
                                id: 'first',
                                route: firstRoute,
                                content: h(ViewProbe, {name: 'First view'}),
                            },
                            {
                                id: 'second',
                                route: secondRoute,
                                content: h(ViewProbe, {name: 'Second view'}),
                            },
                            {id: 'disabled', route: disabledRoute, disabled: true},
                        ],
                    }),
                )
            }

            static dependencies = [ActiveProjection, NavigationBar, RouteOutlet, ViewProbe]
        }

        const runtime = createFrayRuntime({router})
        const shell = runtime.mount(runtime.create(Shell), document.body)
        await waitUntil(() => router.transition.get().state === 'idle')

        assert.equal(active.get(), 'second', JSON.stringify({
            transition: router.transition.get(),
            issue: router.issue.get(),
            adapter: adapter.read(),
            lifecycle,
            body: document.body.textContent,
        }))
        assert.deepEqual(lifecycle, ['initialize Second view'])
        assert.equal(requiredQuery('nav').getAttribute('aria-label'), 'Primary')
        assert.equal(document.querySelector('[role="tablist"]'), null)
        const links = [...document.querySelectorAll<HTMLAnchorElement>('nav a')]
        assert.equal(links.length, 2)
        assert.equal(requiredAt(links, 1).getAttribute('aria-current'), 'page')
        assert.equal(requiredQuery('nav [aria-disabled="true"]').textContent, 'Disabled')
        assert.equal(requiredQuery('output').textContent, 'second')
        const persistent = requiredQuery('#persistent')

        requiredAt(links, 0).click()
        await waitUntil(() => router.transition.get().state === 'idle'
            && active.get() === 'first')
        assert.equal(lifecycle.filter((event) => event === 'initialize Second view').length, 1)
        assert.equal(lifecycle.filter((event) => event === 'destroy Second view').length, 1)
        assert.equal(lifecycle.filter((event) => event === 'initialize First view').length, 1)
        assert.equal(requiredQuery('output').textContent, 'first')
        assert.equal(requiredQuery('#persistent'), persistent)
        assert.equal(requiredAt(links, 0).getAttribute('aria-current'), 'page')

        const modified = new window.MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
        })
        requiredAt(links, 1).dispatchEvent(modified as unknown as Event)
        assert.equal(modified.defaultPrevented, false)
        assert.equal(active.get(), 'first')

        shell.destroy()
        assert.equal(active.subscriberCount, 0)
        router.dispose()
    })

    test('outlet preselects a direct nested route before mounting deferred work', async () => {
        const defaultRoute = defineRoute('outlet-default')
        const selectedRoute = defineRoute('outlet-selected')
        const summaryRoute = defineRoute('outlet-summary')
        const detailsRoute = defineRoute('outlet-details')
        const active = new Emitter<string | number | null>('default')
        const nested = new Emitter<string | number | null>('summary')
        const adapter = new MemoryNavigationAdapter('/outlet-selected/outlet-details')
        const router = createBrowserRouter({adapter})
        let defaultMounts = 0

        class DefaultView extends Component {
            initialize(): void {
                defaultMounts += 1
            }
            render(): FrayChild {
                return 'Default view'
            }
        }

        class Shell extends Component {
            render(): FrayChild {
                return h('main', null,
                    h(NavigationBar, {
                        label: 'Nested routes',
                        items: [
                            {
                                id: 'selected-parent',
                                label: 'Selected parent',
                                to: routeTarget(selectedRoute),
                            },
                            {
                                id: 'selected-exact',
                                label: 'Selected exact',
                                to: routeTarget(selectedRoute),
                                exact: true,
                            },
                        ],
                    }),
                    h(RouteOutlet, {
                        valueEmitter: active,
                        mountPolicy: 'active-only',
                        views: [
                            {id: 'default', route: defaultRoute, content: h(DefaultView)},
                            {
                                id: 'selected',
                                route: selectedRoute,
                                content: h(TabPanel, {
                                    valueEmitter: nested,
                                    mountPolicy: 'active-only',
                                    tabs: [
                                        {id: 'summary', route: summaryRoute, content: 'Summary'},
                                        {id: 'details', route: detailsRoute, content: 'Details'},
                                    ],
                                }),
                            },
                        ],
                    }),
                )
            }

            static dependencies = [DefaultView, NavigationBar, RouteOutlet, TabPanel]
        }

        const runtime = createFrayRuntime({router})
        const shell = runtime.mount(runtime.create(Shell), document.body)
        await waitUntil(() => router.transition.get().state === 'idle')

        assert.equal(defaultMounts, 0)
        assert.equal(active.get(), 'selected')
        assert.equal(nested.get(), 'details')
        assert.equal(requiredQuery('a').getAttribute('aria-current'), 'page')
        assert.equal(requiredAt([...document.querySelectorAll('a')], 1)
            .getAttribute('aria-current'), null)
        assert.equal(requiredQuery('[role="tabpanel"]:not([hidden])').textContent, 'Details')

        shell.destroy()
        router.dispose()
    })

    test('outlet applies eager and lazy retention without tab semantics', async () => {
        for (const policy of ['eager', 'lazy'] as const) {
            const firstRoute = defineRoute(`${policy}-outlet-first`)
            const secondRoute = defineRoute(`${policy}-outlet-second`)
            const active = new Emitter<string | number | null>('first')
            const adapter = new MemoryNavigationAdapter(`/${policy}-outlet-first`)
            const router = createBrowserRouter({adapter})
            const lifecycle: string[] = []

            class Probe extends Component<{name: string}> {
                initialize(): void {
                    lifecycle.push(`initialize ${this.props.name}`)
                }
                render(): FrayChild {
                    return this.props.name
                }
                override onDestroy(): void {
                    lifecycle.push(`destroy ${this.props.name}`)
                }
            }

            const runtime = createFrayRuntime({router})
            const outlet = runtime.mount(runtime.create(RouteOutlet, {
                valueEmitter: active,
                mountPolicy: policy,
                views: [
                    {id: 'first', route: firstRoute, content: h(Probe, {name: 'first'})},
                    {id: 'second', route: secondRoute, content: h(Probe, {name: 'second'})},
                ],
            }), document.body)
            await waitUntil(() => router.transition.get().state === 'idle')

            assert.deepEqual(lifecycle, policy === 'eager'
                ? ['initialize first', 'initialize second']
                : ['initialize first'])
            active.set('second')
            assert.equal(requiredQuery('fray-routeoutlet > div:not([hidden])').textContent, 'second')
            active.set('first')
            assert.equal(lifecycle.filter((event) => event.startsWith('initialize')).length, 2)
            assert.equal(lifecycle.some((event) => event.startsWith('destroy')), false)

            outlet.destroy()
            assert.equal(lifecycle.filter((event) => event.startsWith('destroy')).length, 2)
            assert.equal(active.subscriberCount, 0)
            router.dispose()
            document.body.replaceChildren()
        }
    })

    test('outlet reconciles policy and route-definition replacements', async () => {
        const firstRoute = defineRoute('replace-first')
        const secondRoute = defineRoute('replace-second')
        const thirdRoute = defineRoute('replace-third')
        const active = new Emitter<string | number | null>('first')
        const router = createBrowserRouter({
            adapter: new MemoryNavigationAdapter('/replace-first'),
        })
        const lifecycle: string[] = []

        class Probe extends Component<{name: string}> {
            initialize(): void {
                lifecycle.push(`initialize ${this.props.name}`)
            }
            render(): FrayChild {
                return this.props.name
            }
            override onDestroy(): void {
                lifecycle.push(`destroy ${this.props.name}`)
            }
        }

        const first = {id: 'first', route: firstRoute, content: h(Probe, {name: 'first'})}
        const second = {id: 'second', route: secondRoute, content: h(Probe, {name: 'second'})}
        const third = {id: 'third', route: thirdRoute, content: h(Probe, {name: 'third'})}
        const runtime = createFrayRuntime({router})
        const outlet = runtime.mount(runtime.create(RouteOutlet, {
            valueEmitter: active,
            mountPolicy: 'lazy',
            views: [first, second],
        }), document.body)
        await waitUntil(() => router.transition.get().state === 'idle')

        active.set('second')
        await waitUntil(() => router.transition.get().state === 'idle')
        assert.deepEqual(lifecycle, ['initialize first', 'initialize second'])

        outlet.setProps({valueEmitter: active, mountPolicy: 'active-only', views: [first, second]})
        assert.equal(lifecycle.filter((event) => event === 'destroy first').length, 1)

        outlet.setProps({valueEmitter: active, mountPolicy: 'active-only', views: [first, third]})
        assert.equal(active.get(), 'first')
        assert.equal(lifecycle.filter((event) => event === 'destroy second').length, 1)
        assert.equal(lifecycle.filter((event) => event === 'initialize first').length, 2)

        outlet.setProps({valueEmitter: active, mountPolicy: 'eager', views: [first, third]})
        assert.equal(lifecycle.filter((event) => event === 'initialize third').length, 1)
        outlet.setProps({valueEmitter: active, mountPolicy: 'eager', views: [first]})
        assert.equal(lifecycle.filter((event) => event === 'destroy third').length, 1)

        outlet.destroy()
        router.dispose()
    })

    test('navigation and outlet validate their structural contracts', () => {
        const route = defineRoute('validated-outlet')
        assert.throws(() => new NavigationBar({label: '', items: []}), /non-empty string/)
        assert.throws(() => new NavigationBar({
            label: 'Primary',
            items: [
                {id: 'duplicate', label: 'First', to: routeTarget(route)},
                {id: 'duplicate', label: 'Second', to: routeTarget(route)},
            ],
        }), /Duplicate navigation item id/)
        assert.throws(() => new NavigationBar({
            label: 'Primary',
            items: [{id: 'ext', label: 'External', to: {kind: 'external', href: ''}}],
        }), /non-empty href/)
        assert.throws(() => new NavigationBar({
            label: 'Primary',
            // @ts-expect-error Runtime validation remains for JavaScript consumers.
            items: [{id: 'ext', label: 'External', to: {kind: 'external'}}],
        }), /non-empty href/)
        assert.throws(() => new RouteOutlet({
            // @ts-expect-error Runtime validation remains for JavaScript consumers.
            views: null,
        }), /views must be an array/)
        assert.throws(() => new RouteOutlet({
            views: [
                {id: 'first', route},
                {id: 'first', route},
            ],
        }), /Duplicate route view id/)
        assert.throws(() => new RouteOutlet({
            views: [
                {id: 'first', route},
                {id: 'second', route},
            ],
        }), /Duplicate outlet route/)
        assert.throws(() => new RouteOutlet({
            // @ts-expect-error Runtime validation remains for JavaScript consumers.
            mountPolicy: 'sometimes',
            views: [{id: 'first', route}],
        }).mount(), /eager, lazy, or active-only/)
    })

    test('contextual tabs restore URLs and links preserve native anchor behavior', async () => {
        const firstRoute = defineRoute('first')
        const secondRoute = defineRoute('second')
        const active = new Emitter('first')
        const adapter = new MemoryNavigationAdapter('/second')
        const router = createBrowserRouter({adapter})
        let firstMounts = 0

        class FirstPage extends Component {
            initialize(): void {
                firstMounts += 1
            }

            render(): FrayChild {
                return 'First page'
            }
        }

        interface ProbeProps extends ComponentProps {
            value: Emitter<string>
        }

        class Probe extends Component<ProbeProps> {
            render(): FrayChild {
                return h('main', null,
                    h(TabPanel, {
                        id: 'routed-tabs',
                        mountPolicy: 'active-only',
                        valueEmitter: this.props.value,
                        children: [
                            h(Tab, {id: 'first', label: 'First', route: firstRoute}, h(FirstPage)),
                            h(Tab, {id: 'second', label: 'Second', route: secondRoute}, 'Second page'),
                        ],
                    }),
                    h('nav', {'aria-label': 'Pages'},
                        h(RouteLink, {to: firstRoute}, 'First link'),
                        h(RouteLink, {to: secondRoute}, 'Second link'),
                        h(RouteLink, {to: firstRoute, target: '_blank'}, 'New tab link'),
                        h(RouteLink, {to: firstRoute, download: true}, 'Download link')),
                )
            }

            static dependencies = [FirstPage, RouteLink, Tab, TabPanel]
        }

        const runtime = createFrayRuntime({router})
        const probe = runtime.mount(runtime.create(Probe, {value: active}), document.body)
        await waitUntil(() => router.transition.get().state === 'idle')

        assert.equal(active.get(), 'second')
        assert.equal(firstMounts, 0)
        assert.equal(visibleTabPanel().textContent, 'Second page')
        assert.equal(requiredQuery('#routed-tabs-panel-first').textContent, '')
        const links = [...document.querySelectorAll<HTMLAnchorElement>('a')]
        assert.equal(requiredAt(links, 0).href, 'https://example.test/first')
        assert.equal(requiredAt(links, 1).getAttribute('aria-current'), 'page')

        const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        requiredAt(tabs, 0).click()
        await waitUntil(() => router.transition.get().state === 'idle'
            && active.get() === 'first')
        assert.equal(adapter.read(), '/first')
        assert.equal(firstMounts, 1)
        assert.equal(adapter.length, 2)
        assert.equal(requiredQuery('#routed-tabs-panel-second').textContent, '')
        assert.equal(requiredAt(links, 0).getAttribute('aria-current'), 'page')

        const modified = new window.MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
        })
        requiredAt(links, 1).dispatchEvent(modified as unknown as Event)
        assert.equal(modified.defaultPrevented, false)
        assert.equal(adapter.length, 2)

        for (const link of [requiredAt(links, 2), requiredAt(links, 3)]) {
            const native = new window.MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                button: 0,
            })
            link.dispatchEvent(native as unknown as Event)
            assert.equal(native.defaultPrevented, false)
        }
        assert.equal(adapter.length, 2)

        requiredAt(links, 1).click()
        await waitUntil(() => router.transition.get().state === 'idle'
            && active.get() === 'second')
        assert.equal(adapter.read(), '/second')
        assert.equal(adapter.length, 3)

        probe.destroy()
        assert.equal(active.subscriberCount, 0)
        router.dispose()
    })

    test('array tab definitions register and navigate contextual routes', async () => {
        const portfolioRoute = defineRoute('meridian-portfolio', 'portfolio')
        const registerRoute = defineRoute('meridian-register', 'register')
        const active = new Emitter('portfolio')
        const adapter = new MemoryNavigationAdapter('/register')
        const router = createBrowserRouter({adapter})
        const runtime = createFrayRuntime({router})
        const panel = runtime.mount(runtime.create(TabPanel, {
            id: 'meridian-work-area',
            valueEmitter: active,
            tabs: [
                {id: 'portfolio', label: 'Portfolio', route: portfolioRoute, content: 'Portfolio'},
                {id: 'register', label: 'Register', route: registerRoute, content: 'Register'},
            ],
        }), document.body)

        await waitUntil(() => router.transition.get().state === 'idle')
        assert.equal(active.get(), 'register')
        assert.equal(visibleTabPanel().textContent, 'Register')

        requiredAt(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'), 0).click()
        await waitUntil(() => router.transition.get().state === 'idle'
            && active.get() === 'portfolio')
        assert.equal(adapter.read(), '/portfolio')
        assert.equal(visibleTabPanel().textContent, 'Portfolio')

        panel.destroy()
        assert.equal(active.subscriberCount, 0)
        router.dispose()
    })

    test('external navigation items render native anchors without router interception', async () => {
        const homeRoute = defineRoute('nav-home')
        const adapter = new MemoryNavigationAdapter()
        const router = createBrowserRouter({adapter})
        let clicked = 0

        const bar = new NavigationBar({
            label: 'Applications',
            items: [
                {id: 'home', label: 'Home', to: routeTarget(homeRoute)},
                {
                    id: 'portal',
                    label: 'Portal',
                    to: {kind: 'external', href: 'https://portal.example/app?x=1'},
                    target: '_blank',
                    title: 'Customer portal',
                    onClick: () => {
                        clicked += 1
                    },
                },
                {
                    id: 'offline',
                    label: 'Offline',
                    to: {kind: 'external', href: 'https://offline.example/'},
                    disabled: true,
                },
            ],
        })
        const runtime = createFrayRuntime({router})
        runtime.mount(bar, document.body)
        await waitUntil(() => router.transition.get().state === 'idle')

        const links = [...document.querySelectorAll<HTMLAnchorElement>('a')]
        assert.equal(links.length, 2)
        const external = requiredAt(links, 1)
        assert.equal(external.getAttribute('href'), 'https://portal.example/app?x=1')
        assert.equal(external.getAttribute('target'), '_blank')
        assert.equal(external.getAttribute('title'), 'Customer portal')
        assert.equal(external.getAttribute('aria-current'), null)

        const disabled = requiredQuery('span[aria-disabled="true"]')
        assert.equal(disabled.textContent, 'Offline')

        const native = new window.MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
        })
        external.dispatchEvent(native as unknown as Event)
        assert.equal(native.defaultPrevented, false)
        assert.equal(clicked, 1)
        assert.equal(adapter.read(), '/')
        assert.equal(adapter.length, 1)

        bar.destroy()
        router.dispose()
    })

    test('external navigation items work without a router', () => {
        const bar = new NavigationBar({
            label: 'Applications',
            items: [
                {id: 'portal', label: 'Portal', to: {kind: 'external', href: 'https://portal.example/'}},
            ],
        })
        const runtime = createFrayRuntime()
        runtime.mount(bar, document.body)

        const link = requiredQuery('a')
        assert.equal(link.getAttribute('href'), 'https://portal.example/')
        bar.destroy()
    })
})

function visibleTabPanel(): HTMLElement {
    return [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')]
        .find((panel) => !panel.hidden)
        ?? requiredQuery('[role="tabpanel"]')
}

async function waitUntil(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return
        await new Promise<void>((resolve) => setImmediate(resolve))
    }
    throw new Error('Condition did not become true')
}
