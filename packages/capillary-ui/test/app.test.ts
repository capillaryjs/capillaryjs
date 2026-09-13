import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'

import {
    Button,
    CapillaryUiApp,
    createCapillaryUiRuntime,
    h,
    mountCapillaryUiApp,
} from '../src/index.js'
import {requiredQuery} from './testUtils.js'

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
    })
})

afterEach(() => {
    document.body.replaceChildren()
    document.head.replaceChildren()
})

after(() => window.close())

test('CapillaryUiApp renders a themed, landmarked cap-app shell', () => {
    const runtime = createCapillaryUiRuntime()
    const app = mountCapillaryUiApp(runtime, CapillaryUiApp, document.body, {
        id: 'profile',
        className: 'profile-app',
        sizing: 'viewport',
        layout: 'vertical',
        children: 'Profile',
    })
    const root = requiredQuery<HTMLElement>('cap-app')

    assert.equal(root.id, 'profile')
    assert.equal(root.getAttribute('role'), 'main')
    assert.equal(root.dataset.capComponent, 'app')
    assert.equal(
        root.className,
        'profile-app cap-fill-horizontal cap-fill-vertical cap-layout-vertical',
    )
    assert.equal(root.textContent, 'Profile')

    const stylesheet = requiredQuery<HTMLStyleElement>('style[data-cap-structural-styles]')
    assert.match(stylesheet.textContent, /cap-app\s*\{[^}]*display:\s*block/)
    assert.match(stylesheet.textContent, /cap-app\s*\{[^}]*background:\s*var\(--application-background\)/)
    assert.match(stylesheet.textContent, /cap-app\s*\{[^}]*color:\s*var\(--ui-color\)/)
    assert.match(stylesheet.textContent, /cap-app\s*\{[^}]*font-family:\s*var\(--font-family\)/)
    assert.match(stylesheet.textContent, /cap-app\s*\{[^}]*font-size:\s*var\(--font-size\)/)
    assert.match(stylesheet.textContent, /cap-app\s*\{[^}]*line-height:\s*var\(--line-height\)/)

    app.destroy()
})

test('derived CapillaryUiApp roots collect dependencies and support embedded placement', () => {
    class ProfileApp extends CapillaryUiApp {
        protected override renderContent() {
            return h(Button, {label: 'Save'})
        }

        static override dependencies = [Button]
    }

    const runtime = createCapillaryUiRuntime()
    const app = mountCapillaryUiApp(runtime, ProfileApp, document.body, {landmark: 'none'})
    const root = requiredQuery<HTMLElement>('cap-app')

    assert.equal(root.hasAttribute('role'), false)
    assert.equal(root.hasAttribute('class'), false)
    assert.ok(root.querySelector('cap-button > button'))
    assert.match(requiredQuery<HTMLStyleElement>('style[data-cap-structural-styles]').textContent,
        /cap-button > button/)

    app.destroy()
})

test('CapillaryUiApp injects its own CSS when mounted without the helper', () => {
    const runtime = createCapillaryUiRuntime()
    const app = runtime.mount(runtime.create(CapillaryUiApp, {children: 'Profile'}), document.body)

    assert.ok(document.head.querySelector('style[data-cap-structural-styles]'))
    assert.ok(document.body.querySelector('cap-app'))

    app.destroy()
})

test('CapillaryUiApp rejects unsupported sizing and landmark policies', () => {
    assert.throws(
        () => CapillaryUiApp.new({sizing: 'container' as never}),
        /CapillaryUiApp sizing must be embedded, viewport-width, viewport-height, or viewport/,
    )
    assert.throws(
        () => CapillaryUiApp.new({landmark: 'banner' as never}),
        /CapillaryUiApp landmark must be main or none/,
    )
    assert.throws(
        () => CapillaryUiApp.new({layout: 'grid' as never}),
        /Layout direction must be horizontal or vertical/,
    )
})
