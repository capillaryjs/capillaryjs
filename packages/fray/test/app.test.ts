import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'

import {
    Button,
    FrayApp,
    createFrayRuntime,
    h,
    mountFrayApp,
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

test('FrayApp renders a themed, landmarked fray-app shell', () => {
    const runtime = createFrayRuntime()
    const app = mountFrayApp(runtime, FrayApp, document.body, {
        id: 'profile',
        className: 'profile-app',
        sizing: 'viewport',
        children: 'Profile',
    })
    const root = requiredQuery<HTMLElement>('fray-app')

    assert.equal(root.id, 'profile')
    assert.equal(root.getAttribute('role'), 'main')
    assert.equal(root.dataset.frayComponent, 'app')
    assert.equal(root.className, 'profile-app fray-fill-horizontal fray-fill-vertical')
    assert.equal(root.textContent, 'Profile')

    const stylesheet = requiredQuery<HTMLStyleElement>('style[data-fray-structural-styles]')
    assert.match(stylesheet.textContent, /fray-app\s*\{[^}]*display:\s*block/)
    assert.match(stylesheet.textContent, /fray-app\s*\{[^}]*background:\s*var\(--application-background\)/)
    assert.match(stylesheet.textContent, /fray-app\s*\{[^}]*color:\s*var\(--ui-color\)/)
    assert.match(stylesheet.textContent, /fray-app\s*\{[^}]*font-family:\s*var\(--font-family\)/)
    assert.match(stylesheet.textContent, /fray-app\s*\{[^}]*font-size:\s*var\(--font-size\)/)
    assert.match(stylesheet.textContent, /fray-app\s*\{[^}]*line-height:\s*var\(--line-height\)/)

    app.destroy()
})

test('derived FrayApp roots collect dependencies and support embedded placement', () => {
    class ProfileApp extends FrayApp {
        protected override renderContent() {
            return h(Button, {label: 'Save'})
        }

        static override dependencies = [Button]
    }

    const runtime = createFrayRuntime()
    const app = mountFrayApp(runtime, ProfileApp, document.body, {landmark: 'none'})
    const root = requiredQuery<HTMLElement>('fray-app')

    assert.equal(root.hasAttribute('role'), false)
    assert.equal(root.hasAttribute('class'), false)
    assert.ok(root.querySelector('fray-button > button'))
    assert.match(requiredQuery<HTMLStyleElement>('style[data-fray-structural-styles]').textContent,
        /fray-button > button/)

    app.destroy()
})

test('FrayApp injects its own CSS when mounted without the helper', () => {
    const runtime = createFrayRuntime()
    const app = runtime.mount(runtime.create(FrayApp, {children: 'Profile'}), document.body)

    assert.ok(document.head.querySelector('style[data-fray-structural-styles]'))
    assert.ok(document.body.querySelector('fray-app'))

    app.destroy()
})

test('FrayApp rejects unsupported sizing and landmark policies', () => {
    assert.throws(
        () => FrayApp.new({sizing: 'container' as never}),
        /FrayApp sizing must be embedded, viewport-width, viewport-height, or viewport/,
    )
    assert.throws(
        () => FrayApp.new({landmark: 'banner' as never}),
        /FrayApp landmark must be main or none/,
    )
})
