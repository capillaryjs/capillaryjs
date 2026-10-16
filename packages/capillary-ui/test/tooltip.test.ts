import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {Button, Tooltip, h} from '../src/index.js'
import {installPopoverStub} from '../../../test-utils/nativePopover.js'

let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    installPopoverStub(window.HTMLElement.prototype)
    Object.assign(globalThis, {window, document: window.document, Node: window.Node, Element: window.Element,
        HTMLElement: window.HTMLElement, Event: window.Event, EventTarget: window.EventTarget,
        MouseEvent: window.MouseEvent, KeyboardEvent: window.KeyboardEvent, DocumentFragment: window.DocumentFragment})
})
afterEach(() => document.body.replaceChildren())
after(() => window.close())
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const trigger = () => document.querySelector('button')!
const visible = () => document.querySelector('[role="tooltip"]')!.matches(':popover-open')
const create = (delayMs = 0) => new Tooltip({text: 'Use arrow keys to move', delayMs,
    trigger: ({ariaDescribedBy, triggerRef}) => h(Button, {icon: 'pan', ariaLabel: 'Pan', title: '', ariaDescribedBy, buttonRef: triggerRef}),
}).attachTo(document.body)

test('tooltip supplements a separately named trigger without taking focus', async () => {
    const tooltip = create()
    trigger().focus(); await pause(10)
    assert.equal(visible(), true); assert.equal(document.activeElement, trigger())
    assert.equal(trigger().getAttribute('aria-label'), 'Pan')
    assert.equal(trigger().getAttribute('aria-describedby'), tooltip.tooltipId)
    assert.equal(document.querySelector('[role="tooltip"]')?.getAttribute('popover'), 'manual')
    assert.equal(document.querySelector('[role="dialog"]'), null)
    trigger().dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}))
    assert.equal(visible(), false); assert.equal(document.activeElement, trigger())
    await pause(10); assert.equal(visible(), false)
    trigger().blur(); trigger().focus(); await pause(10); assert.equal(visible(), true)
    trigger().click(); assert.equal(visible(), false)
    await pause(10); assert.equal(visible(), false)
    tooltip.destroy()
})

test('hover delay, trigger-to-tooltip transition and disposal cancel owned timers/listeners', async () => {
    const tooltip = create(25)
    trigger().dispatchEvent(new Event('pointerenter')); assert.equal(visible(), false)
    trigger().dispatchEvent(new Event('pointerleave')); await pause(40); assert.equal(visible(), false)
    trigger().dispatchEvent(new Event('pointerenter')); await pause(40); assert.equal(visible(), true)
    trigger().dispatchEvent(new Event('pointerleave'))
    document.querySelector('[role="tooltip"]')!.dispatchEvent(new Event('pointerenter'))
    await pause(140); assert.equal(visible(), true)
    const old = trigger(); tooltip.destroy()
    old.dispatchEvent(new Event('pointerenter')); await pause(40)
    assert.equal(document.querySelector('[role="tooltip"]'), null)
    const pending = create(25)
    trigger().dispatchEvent(new Event('pointerenter')); pending.destroy()
    await pause(40); assert.equal(document.querySelector('[role="tooltip"]'), null)
})

test('button refs update explicitly and stay stable across normal props changes', () => {
    const first: {current: HTMLButtonElement | null} = {current: null}
    const second: {current: HTMLButtonElement | null} = {current: null}
    const button = new Button({label: 'One', buttonRef: first}).attachTo(document.body)
    const element = first.current
    button.setProps({label: 'Two', buttonRef: first}); assert.equal(first.current, element)
    button.setProps({label: 'Three', buttonRef: second})
    assert.equal(first.current, null); assert.equal(second.current, element)
    button.destroy(); assert.equal(second.current, null)
})

test('tooltip validates plain text, trigger and finite nonnegative delay', () => {
    assert.throws(() => new Tooltip({text: '', trigger: () => null}), /plain text/)
    assert.throws(() => new Tooltip({text: 'Help', trigger: () => null, delayMs: -1}), /delayMs/)
})
