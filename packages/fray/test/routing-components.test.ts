import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter} from '@sylwellsoftware/glue'
import {
    Component,
    MemoryNavigationAdapter,
    RouteLink,
    Tab,
    TabPanel,
    createBrowserRouter,
    createFrayRuntime,
    defineRoute,
    h,
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
    test('contextual tabs restore URLs and links preserve native anchor behavior', async () => {
        const firstRoute = defineRoute('first')
        const secondRoute = defineRoute('second')
        const active = new Emitter('first')
        const adapter = new MemoryNavigationAdapter('/second')
        const router = createBrowserRouter({adapter})

        interface ProbeProps extends ComponentProps {
            value: Emitter<string>
        }

        class Probe extends Component<ProbeProps> {
            render(): FrayChild {
                return h('main', null,
                    h(TabPanel, {
                        id: 'routed-tabs',
                        valueEmitter: this.props.value,
                        children: [
                            h(Tab, {id: 'first', label: 'First', route: firstRoute}, 'First page'),
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

            static dependencies = [RouteLink, Tab, TabPanel]
        }

        const runtime = createFrayRuntime({router})
        const probe = runtime.mount(runtime.create(Probe, {value: active}), document.body)
        await waitUntil(() => router.transition.get().state === 'idle')

        assert.equal(active.get(), 'second')
        assert.equal(requiredQuery('[role="tabpanel"]').textContent, 'Second page')
        const links = [...document.querySelectorAll<HTMLAnchorElement>('a')]
        assert.equal(requiredAt(links, 0).href, 'https://example.test/first')
        assert.equal(requiredAt(links, 1).getAttribute('aria-current'), 'page')

        const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        requiredAt(tabs, 0).click()
        await waitUntil(() => router.transition.get().state === 'idle'
            && active.get() === 'first')
        assert.equal(adapter.read(), '/first')
        assert.equal(adapter.length, 2)
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
})

async function waitUntil(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return
        await new Promise<void>((resolve) => setImmediate(resolve))
    }
    throw new Error('Condition did not become true')
}
