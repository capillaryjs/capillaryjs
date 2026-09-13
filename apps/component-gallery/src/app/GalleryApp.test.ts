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

test('gallery shell mounts the line-inputs page with islands and toolbar', async () => {
    const adapter = new MemoryNavigationAdapter('/line-inputs')
    const router = createBrowserRouter({adapter})
    const runtime = createFrayRuntime({router})
    const app = runtime.mount(runtime.create(GalleryApp), document.body)
    await waitUntil(() => router.transition.get().state === 'idle')

    // Island landmarks
    assert.ok(document.querySelector('header.gallery-masthead'), 'masthead island')
    assert.ok(document.querySelector('footer.gallery-footer'), 'footer island')
    assert.ok(document.querySelector('nav'), 'page navbar')
    assert.ok(document.querySelector('fray-toolbar.gallery-controls'), 'control toolbar')
    assert.ok(document.querySelector('fray-sidebar'), 'page sidebar')
    assert.ok(document.querySelector('fray-panel'), 'content panel')

    // Toolbar controls
    assert.ok(document.querySelector('fray-themepicker'), 'theme picker')
    assert.ok(document.querySelector('fray-colorpicker'), 'color picker')
    const headerToggles = document.querySelectorAll('.gallery-controls fray-toggle')
    assert.equal(headerToggles.length, 2, 'layout and data-state toggles')
    const flagInputs = document.querySelectorAll('.gallery-flag-group input')
    assert.equal(flagInputs.length, 4, 'component-state flags')

    // The line-inputs page renders its state matrix
    assert.ok(document.querySelector('#gallery-checkboxes'), 'checkbox panel')
    assert.ok(document.querySelector('#gallery-basic-inputs'), 'basic inputs panel')
    assert.ok(document.querySelector('#gallery-date-time'), 'date/time panel')
    assert.ok(document.querySelector('fray-tricheckbox'), 'tri-state checkbox')
    assert.ok(document.querySelector('fray-quadcheckbox'), 'quad-state checkbox')
    assert.ok(document.querySelector('fray-datepicker'), 'date picker')
    assert.ok(document.querySelector('fray-timepicker'), 'time picker')
    assert.ok(document.querySelector('fray-datetimepicker'), 'datetime picker')
    assert.ok(document.querySelector('fray-progressbar'), 'progress bar')
    assert.ok(
        document.querySelectorAll('fray-panel fray-toolbar').length >= 3,
        'panel toolbars',
    )
    assert.ok(
        document.querySelector('.gallery-data-state')?.textContent?.includes('ready'),
        'data-state readout',
    )

    // Panels declare form context; the sidebar demo group declares control
    for (const id of ['#gallery-checkboxes', '#gallery-basic-inputs', '#gallery-date-time']) {
        assert.equal(
            document.querySelector(id)?.getAttribute('data-fray-context'),
            'form',
            `${id} form context`,
        )
    }
    assert.equal(
        document.querySelector('.gallery-control-demo')?.getAttribute('data-fray-context'),
        'control',
        'sidebar demo control context',
    )
    assert.ok(
        document.querySelector('.gallery-control-demo fray-groupbox'),
        'sidebar demo groupbox',
    )

    app.destroy()
    router.dispose()
})

test('toolbar toggles switch layout variant and shared data state', async () => {
    const adapter = new MemoryNavigationAdapter('/line-inputs')
    const router = createBrowserRouter({adapter})
    const runtime = createFrayRuntime({router})
    const app = runtime.mount(runtime.create(GalleryApp), document.body)
    await waitUntil(() => router.transition.get().state === 'idle')

    const root = document.querySelector('fray-app')
    assert.ok(root?.classList.contains('gallery-shell'), 'app shell variant')

    // Layout toggle → website variant
    const websiteOption = [...document.querySelectorAll<HTMLElement>(
        'fray-toggle button[role="radio"]',
    )].find((button) => button.textContent === 'Website')
    assert.ok(websiteOption, 'website layout option')
    websiteOption.click()
    assert.ok(root?.classList.contains('gallery-website'), 'website variant')

    // Data-state toggle → error propagates to the page readout
    const errorOption = [...document.querySelectorAll<HTMLElement>(
        'fray-toggle button[role="radio"]',
    )].find((button) => button.textContent === 'Error')
    assert.ok(errorOption, 'error data-state option')
    errorOption.click()
    assert.ok(
        document.querySelector('.gallery-data-state')?.textContent?.includes('error'),
        'error state readout',
    )

    // Component-state flag → checkbox binding updates the model
    const disabledFlag = document.querySelector<HTMLInputElement>(
        '.gallery-flag-group input',
    )
    assert.ok(disabledFlag, 'disabled flag checkbox')
    disabledFlag.click()
    assert.equal(disabledFlag.checked, true, 'disabled flag applied')

    // The global disabled flag reaches showcased page controls
    const pageTextbox = document.querySelector<HTMLInputElement>(
        '#gallery-basic-inputs fray-textbox input',
    )
    assert.ok(pageTextbox, 'page textbox input')
    assert.equal(pageTextbox.disabled, true, 'global disabled flag applied to page control')

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
