import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {AsyncCommand, Emitter} from '@capillaryjs/capillary'
import {DropdownMenu, MenuButton, Popover} from '../src/index.js'
import type {MenuEntry} from '../src/index.js'
import {installPopoverStub} from '../../../test-utils/nativePopover.js'

let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    installPopoverStub(window.HTMLElement.prototype)
    Object.assign(globalThis, {window, document: window.document, Node: window.Node,
        Element: window.Element, HTMLElement: window.HTMLElement, Event: window.Event,
        EventTarget: window.EventTarget, MouseEvent: window.MouseEvent,
        KeyboardEvent: window.KeyboardEvent, DocumentFragment: window.DocumentFragment})
})
afterEach(() => document.body.replaceChildren())
after(() => window.close())
const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve() }
const key = (element: HTMLElement, value: string) => element.dispatchEvent(new KeyboardEvent('keydown', {key: value, bubbles: true, cancelable: true}))
const trigger = () => document.querySelector<HTMLButtonElement>('cap-menubutton > cap-button > button')!
const actions = () => [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]

test('a menu action can open an anchored popup without its opening click dismissing it', () => {
    let popup: Popover
    const menu = new MenuButton({label: 'Edit', items: [{id: 'details', label: 'Details', onSelect: () => popup.openEmitter.set(true)}]}).attachTo(document.body)
    popup = new Popover({label: 'Details', anchor: trigger(), children: 'Contextual form'}).attachTo(document.body)
    trigger().click(); actions()[0]!.click()
    assert.equal(menu.openEmitter.get(), false)
    assert.equal(popup.openEmitter.get(), true)
    assert.equal(document.querySelector('[role="dialog"]')!.matches(':popover-open'), true)
    popup.destroy(); menu.destroy()
})

test('menu trigger composes external outcomes and stable refs without guarding unrelated actions', () => {
    const ref: {current: HTMLButtonElement | null} = {current: null}
    const props = {label: 'Actions', buttonRef: ref, title: '', ariaDescribedBy: 'help', busy: true,
        items: [{id: 'local', label: 'Local', onSelect: () => {}}]}
    const menu = new MenuButton(props).attachTo(document.body), element = trigger()
    assert.equal(ref.current, element); assert.equal(element.disabled, false)
    assert.equal(element.getAttribute('aria-busy'), 'true'); assert.equal(element.getAttribute('title'), '')
    menu.setProps({...props, busy: false, error: new Error('Popup action failed')})
    assert.equal(ref.current, element); assert.equal(element.getAttribute('aria-invalid'), 'true')
    assert.match(element.getAttribute('aria-describedby')!, /^help /)
    element.click(); assert.equal(actions()[0]!.getAttribute('aria-disabled'), null)
    menu.destroy(); assert.equal(ref.current, null)
})

test('menus use action semantics, groups, disabled focus and keyboard navigation', () => {
    let count = 0
    const menu = new MenuButton({icon: 'add', ariaLabel: 'Create definition', items: [
        {id: 'class', label: 'Class', onSelect: () => count++},
        {id: 'sep', kind: 'separator'},
        {id: 'values', kind: 'group', label: 'Values', items: [
            {id: 'type', label: 'Type', disabled: true, onSelect: () => count++},
            {id: 'enum', label: 'Enumeration', onSelect: () => count++},
        ]},
    ]}).attachTo(document.body)
    trigger().click()
    assert.equal(trigger().getAttribute('aria-expanded'), 'true')
    assert.equal(trigger().getAttribute('aria-haspopup'), 'menu')
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(document.querySelector('[role="group"]')?.getAttribute('aria-label'), 'Values')
    assert.equal(document.activeElement, actions()[0])
    key(actions()[0]!, 'ArrowDown')
    assert.equal(document.activeElement, actions()[1], 'disabled menu items remain discoverable')
    actions()[1]!.click()
    assert.equal(count, 0)
    assert.equal(menu.openEmitter.get(), true)
    key(actions()[1]!, 'End')
    assert.equal(document.activeElement, actions()[2])
    key(actions()[2]!, 'Home')
    assert.equal(document.activeElement, actions()[0])
    key(actions()[0]!, 'e')
    assert.equal(document.activeElement, actions()[2])
    key(actions()[2]!, 'Escape')
    assert.equal(menu.openEmitter.get(), false)
    assert.equal(document.activeElement, trigger())
    key(trigger(), 'ArrowUp')
    assert.equal(document.activeElement, actions()[2])
    key(actions()[2]!, 'Tab')
    assert.equal(menu.openEmitter.get(), false)
    menu.destroy()
})

test('closing before invocation preserves focus transferred by a synchronous action', () => {
    const destination = document.createElement('input')
    document.body.append(destination)
    const menu = new MenuButton({label: 'Create', items: [{id: 'class', label: 'Class', onSelect: () => destination.focus()}]}).attachTo(document.body)
    trigger().click(); actions()[0]!.click()
    assert.equal(menu.openEmitter.get(), false)
    assert.equal(document.activeElement, destination)
    assert.equal(trigger().hasAttribute('aria-busy'), false)
    menu.destroy()
})

test('command pending and failure stay visible at the trigger after dismissal', async () => {
    let fail!: (reason: Error) => void
    const command = new AsyncCommand<void, void>({execute: () => new Promise((_resolve, reject) => fail = reject)})
    const menu = new MenuButton({label: 'Actions', items: [{id: 'save', label: 'Save', command},
        {id: 'local', label: 'Local', onSelect: () => {}}]}).attachTo(document.body)
    trigger().click(); actions()[0]!.click()
    assert.equal(menu.openEmitter.get(), false)
    assert.equal(trigger().getAttribute('aria-busy'), 'true')
    assert.equal(trigger().hasAttribute('data-cap-busy-visible'), false)
    assert.equal(trigger().disabled, false, 'other menu actions remain available')
    trigger().click()
    assert.equal(actions()[0]!.getAttribute('aria-disabled'), 'true')
    assert.equal(actions()[1]!.hasAttribute('aria-busy'), false)
    key(actions()[0]!, 'Escape')
    await flush(); fail(new Error('Save refused')); await flush()
    assert.equal(trigger().hasAttribute('aria-busy'), false)
    assert.equal(trigger().getAttribute('aria-invalid'), 'true')
    assert.match(document.querySelector('cap-menubutton > cap-button cap-error')?.textContent ?? '', /Save refused/)
    menu.destroy()
    assert.equal(command.subscriberCount, 0)
    assert.equal(Reflect.get(command.isRunning, 'subscriberCount'), 0)
    command.dispose()
})

test('handler errors remain observable after close and clear on a new action', () => {
    const menu = new MenuButton({label: 'Actions', items: [
        {id: 'bad', label: 'Bad', onSelect: () => { throw new Error('Local failure') }},
        {id: 'good', label: 'Good', onSelect: () => {}},
    ]}).attachTo(document.body)
    trigger().click(); actions()[0]!.click()
    assert.equal(trigger().getAttribute('aria-invalid'), 'true')
    trigger().click(); actions()[1]!.click()
    assert.equal(trigger().hasAttribute('aria-invalid'), false)
    menu.destroy()
})

test('overlapping invoked commands keep trigger busy until their own work completes', async () => {
    let finishFirst!: () => void, finishSecond!: () => void
    const first = new AsyncCommand<void, void>({execute: () => new Promise(resolve => finishFirst = resolve)})
    const second = new AsyncCommand<void, void>({execute: () => new Promise(resolve => finishSecond = resolve)})
    const menu = new MenuButton({label: 'Actions', items: [
        {id: 'first', label: 'First', command: first}, {id: 'second', label: 'Second', command: second},
    ]}).attachTo(document.body)
    trigger().click(); actions()[0]!.click()
    trigger().click(); actions()[1]!.click()
    await flush(); finishSecond(); await flush()
    assert.equal(trigger().getAttribute('aria-busy'), 'true', 'finishing another action must not hide remaining work')
    finishFirst(); await flush()
    assert.equal(trigger().hasAttribute('aria-busy'), false)
    menu.destroy(); first.dispose(); second.dispose()
})

test('standalone notification errors do not prevent the requested action', () => {
    const anchor = document.createElement('button'); document.body.append(anchor)
    let count = 0, observed: unknown = null
    const menu = new DropdownMenu({label: 'Actions', anchor, defaultValue: true,
        items: [{id: 'one', label: 'One', onSelect: () => count++}],
        onAction: () => { throw new Error('Observer failure') }, onActionError: error => observed = error,
    }).attachTo(document.body)
    actions()[0]!.click()
    assert.equal(count, 1)
    assert.equal((observed as Error).message, 'Observer failure')
    menu.destroy()
})

test('replacing focused actions restores menu focus and drops removed command subscriptions', async () => {
    const command = new AsyncCommand<void, void>({execute: async () => {}})
    const anchor = document.createElement('button'); document.body.append(anchor)
    const props = {label: 'Actions', anchor, defaultValue: true, items: [{id: 'old', label: 'Old', command}]}
    const menu = new DropdownMenu(props).attachTo(document.body)
    assert.equal(document.activeElement, actions()[0])
    menu.setProps({...props, items: [{id: 'new', label: 'New', onSelect: () => {}}]})
    await flush()
    assert.equal(document.activeElement, actions()[0])
    assert.equal(actions()[0]!.textContent, 'New')
    assert.equal(command.subscriberCount, 0)
    assert.equal(Reflect.get(command.isRunning, 'subscriberCount'), 0)
    menu.destroy(); command.dispose()
})

test('controlled opening and disabled replacement preserve state and release subscriptions', async () => {
    const open = new Emitter(true)
    const props = {label: 'Controlled', valueEmitter: open, items: [{id: 'one', label: 'One', onSelect: () => {}}]}
    const menu = new MenuButton(props).attachTo(document.body)
    await flush()
    assert.equal(open.get(), true)
    assert.equal(document.activeElement, actions()[0])
    menu.setProps({...props, disabled: true})
    assert.equal(open.get(), false)
    menu.destroy()
    assert.equal(open.subscriberCount, 0)
    open.dispose()
})

test('standalone menu retains default popover behavior and rejects invalid action contracts', () => {
    assert.throws(() => new MenuButton({items: []}), /accessible name/)
    const anchor = document.createElement('button'); document.body.append(anchor)
    const menu = new DropdownMenu({label: 'Standalone', anchor, items: [], defaultValue: true}).attachTo(document.body)
    assert.equal(document.activeElement, document.querySelector('[role="menu"]'))
    menu.destroy()
    const invalid = (items: unknown) => new DropdownMenu({label: 'Invalid', anchor, items: items as readonly MenuEntry[]}).attachTo(document.body)
    assert.throws(() => invalid([{id: 'a', label: 'A'}]), /exactly one/)
    assert.throws(() => invalid([{id: 'a', label: 'A', onSelect() {}, command: {}}]), /exactly one/)
    assert.throws(() => invalid([{id: 'a', label: '', onSelect() {}}]), /labels/)
    assert.throws(() => invalid([{id: 'a', label: 'A', onSelect() {}}, {id: 'a', kind: 'separator'}]), /unique/)
    const popover = new Popover({label: 'Still a dialog', anchor, defaultValue: true}).attachTo(document.body)
    assert.ok(document.querySelector('[role="dialog"]'))
    popover.destroy()
})
