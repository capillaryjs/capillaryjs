import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {Window} from 'happy-dom'

import {
    MemoryNavigationAdapter,
    createBrowserRouter,
    createFrayRuntime,
} from '@sylwellsoftware/fray'

import {GalleryApp} from './GalleryApp.js'

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

after(() => window.close())

test('gallery shell mounts the routed data-grid page with islands', async () => {
    const adapter = new MemoryNavigationAdapter('/data-grid')
    const router = createBrowserRouter({adapter})
    const runtime = createFrayRuntime({router})
    const app = runtime.mount(runtime.create(GalleryApp), document.body)
    await waitUntil(() => router.transition.get().state === 'idle')

    // Island landmarks
    assert.ok(document.querySelector('header.gallery-masthead'), 'masthead island')
    assert.ok(document.querySelector('footer.gallery-footer'), 'footer island')
    assert.ok(document.querySelector('nav'), 'page navbar')
    assert.ok(document.querySelector('fray-sidebar'), 'sidebar island')
    assert.ok(document.querySelector('fray-datatable'), 'service register table')
    assert.ok(document.querySelector('fray-filterpanel'), 'semantic criteria panel')

    // Navbar links resolve to registered page routes
    const hrefs = [...document.querySelectorAll<HTMLAnchorElement>('nav a')]
        .map((anchor) => anchor.getAttribute('href'))
    for (const page of ['explorer', 'directory', 'analytics', 'forms']) {
        assert.ok(
            hrefs.some((href) => href?.includes(page)),
            `navbar link for ${page}`,
        )
    }

    // The data grid renders deterministic catalog rows
    assert.ok(
        document.querySelector('fray-datatable')?.textContent?.includes('SVC-001'),
        'catalog row rendered',
    )

    app.destroy()
    router.dispose()
})

test('navbar navigation mounts the explorer page lazily', async () => {
    const adapter = new MemoryNavigationAdapter('/data-grid')
    const router = createBrowserRouter({adapter})
    const runtime = createFrayRuntime({router})
    const app = runtime.mount(runtime.create(GalleryApp), document.body)
    await waitUntil(() => router.transition.get().state === 'idle')

    const explorerLink = [...document.querySelectorAll<HTMLAnchorElement>('nav a')]
        .find((anchor) => anchor.getAttribute('href')?.includes('explorer'))
    assert.ok(explorerLink, 'explorer nav link')
    explorerLink.click()
    await waitUntil(() => router.transition.get().state === 'idle'
        && document.querySelector('fray-treeview') != null)

    assert.equal(adapter.read(), '/explorer')
    assert.ok(document.querySelector('fray-treeview'), 'catalog tree')
    assert.ok(document.querySelector('fray-linegraph'), 'incident history chart')

    app.destroy()
    router.dispose()
})

async function waitUntil(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return
        await new Promise<void>((resolve) => setImmediate(resolve))
    }
    throw new Error('Condition did not become true')
}
