import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {Window} from 'happy-dom'

import {
    Fragment,
    MemoryNavigationAdapter,
    createBrowserRouter,
    createFrayRuntime,
    h,
} from '@sylwellsoftware/fray'
import {MeridianApp} from '../MeridianApp.js'
import type {WorkArea} from './types.js'

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
        React: {createElement: h, Fragment},
    })
})

after(() => window.close())

test('Meridian renders one flat island layer around its routed workspace', () => {
    const router = createBrowserRouter({adapter: new MemoryNavigationAdapter('/')})
    const runtime = createFrayRuntime({router})
    const app = runtime.mount(runtime.create(MeridianApp), document.body)

    assert.ok(document.querySelector('body > main.meridian-app'))
    assert.ok(document.querySelector('.meridian-navigation > fray-sidebar.meridian-scope.island'))
    assert.ok(document.querySelector('.meridian-navigation > fray-panel.meridian-view.island'))
    assert.ok(document.querySelector('body > main > fray-panel.demo-harness.island'))
    assert.equal(document.querySelectorAll('.island .island').length, 0)
    assert.equal(document.querySelectorAll('.meridian-masthead .appearance-controls').length, 0)
    assert.equal(document.querySelectorAll('.demo-harness .appearance-controls').length, 1)

    assertScreen(app, 'portfolio', '.portfolio-area', 4)
    assertScreen(app, 'register', '.register-area', 4)
    const split = document.querySelector('fray-splitview.register-results-split')
    assert.ok(split)
    assert.equal(split.classList.contains('island'), false)
    assert.ok(split.querySelector(':scope > fray-primary > fray-panel.island'))
    assert.ok(split.querySelector(':scope > fray-secondary > fray-panel.island'))
    assertScreen(app, 'change', '.change-area', 4)
    assertScreen(app, 'analysis', '.analysis-area', 4)

    app.destroy()
    router.dispose()
})

function assertScreen(
    app: MeridianApp,
    area: WorkArea,
    selector: string,
    islandCount: number,
): void {
    app.model.activeArea.set(area, `test switched to ${area}`)
    const screen = document.querySelector(selector)
    assert.ok(screen, `${area} screen should be mounted`)
    assert.equal(screen.querySelectorAll('.island').length, islandCount)
    assert.equal(screen.querySelectorAll('.island .island').length, 0)
}
