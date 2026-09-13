import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {Window} from 'happy-dom'

import {mountLocalizationDemo} from '../demoController.js'

let window: Window

before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {
        window,
        document: window.document,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        HTMLDialogElement: window.HTMLDialogElement,
        EventTarget: window.EventTarget,
        Event: window.Event,
        MouseEvent: window.MouseEvent,
        KeyboardEvent: window.KeyboardEvent,
        DocumentFragment: window.DocumentFragment,
    })
})

after(() => window.close())

test('language toggle remounts app and Fray text in one selected language', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const demo = mountLocalizationDemo(target, 'en-GB')
    await waitUntil(() => target.textContent?.includes('No rows') === true)

    assert.equal(document.documentElement.lang, 'en-GB')
    assert.match(target.textContent ?? '', /Fray localization/)
    assert.equal(target.querySelector('fray-dropdown option')?.textContent, 'Select…')
    assert.match(target.textContent ?? '', /No items/)

    const danish = [...target.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
        .find((button) => button.textContent === 'Dansk')
    assert.ok(danish)
    danish.click()

    await waitUntil(() => target.dataset.locale === 'da-DK'
        && target.textContent?.includes('Ingen rækker') === true)
    assert.equal(demo.locale, 'da-DK')
    assert.equal(document.documentElement.lang, 'da-DK')
    assert.match(target.textContent ?? '', /Fray-lokalisering/)
    assert.equal(target.querySelector('fray-dropdown option')?.textContent, 'Vælg…')
    assert.match(target.textContent ?? '', /Ingen elementer/)
    assert.match(target.textContent ?? '', /Sortér Opgavenavn/)

    const openCalendar = target.querySelector<HTMLButtonElement>(
        'fray-datepicker button[aria-label="Åbn kalender"]',
    )
    assert.ok(openCalendar)
    openCalendar.click()
    await waitUntil(() => target.querySelector('.fray-calendar') != null)
    assert.match(
        target.querySelector('.fray-calendar [role="heading"]')?.textContent ?? '',
        /september 2026/i,
    )
    assert.equal(
        target.querySelector('.fray-calendar table')?.getAttribute('aria-label'),
        'Vælg en dato',
    )

    const openDialog = [...target.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Åbn dialog')
    assert.ok(openDialog)
    openDialog.click()
    await waitUntil(() => target.querySelector('dialog')?.open === true)
    assert.ok([...target.querySelectorAll<HTMLButtonElement>('dialog button')]
        .some((button) => button.textContent === 'Luk'))

    demo.destroy()
    target.remove()
})

async function waitUntil(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return
        await new Promise<void>((resolve) => setImmediate(resolve))
    }
    throw new Error('Condition did not become true')
}
