import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {Emitter} from '@capillaryjs/capillary'
import {Component, Drawer, SplitPrimary, SplitSecondary, SplitView, h} from '../src/index.js'
import type {CollapsedSplitPane} from '../src/index.js'

let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {window, document: window.document, Node: window.Node, Element: window.Element,
        HTMLElement: window.HTMLElement, Event: window.Event, EventTarget: window.EventTarget,
        MouseEvent: window.MouseEvent, KeyboardEvent: window.KeyboardEvent, DocumentFragment: window.DocumentFragment})
})
afterEach(() => document.body.replaceChildren())
after(() => window.close())
const panes = () => [h(SplitPrimary, {label: 'Navigation'}, h('input', {'aria-label': 'Tree filter'})),
    h(SplitSecondary, {label: 'Workspace'}, h('input', {'aria-label': 'Details'}))]

test('split collapse retains resized size, guards separator and restores focus only from hidden content', () => {
    const returnTo = document.createElement('button'); document.body.append(returnTo)
    const props = {horizontal: true as const, primarySize: '200px', children: panes(), collapseFocusRef: {current: returnTo}}
    const split = new SplitView(props).attachTo(document.body)
    const host = split.dom as HTMLElement, primary = host.querySelector<HTMLElement>('cap-primary')!, separator = host.querySelector<HTMLElement>('cap-separator')!
    Object.defineProperty(host, 'clientWidth', {value: 600})
    primary.getBoundingClientRect = () => ({width: 200, height: 200, left: 0, right: 200, top: 0, bottom: 200, x: 0, y: 0, toJSON: () => ({})})
    separator.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}))
    assert.equal(host.style.getPropertyValue('--split-primary-size'), '216px')
    primary.querySelector('input')!.focus()
    split.setProps({...props, collapsed: 'primary'})
    assert.equal(host.getAttribute('data-collapsed'), 'primary')
    assert.equal(document.activeElement, returnTo)
    assert.equal(separator.hasAttribute('tabindex'), false)
    separator.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}))
    assert.equal(host.style.getPropertyValue('--split-primary-size'), '216px')
    split.setProps({...props, collapsed: null})
    assert.equal(host.hasAttribute('data-collapsed'), false)
    assert.equal(host.style.getPropertyValue('--split-primary-size'), '216px')
    assert.equal(separator.tabIndex, 0)
    const details = host.querySelector<HTMLInputElement>('cap-secondary input')!; details.focus()
    split.setProps({...props, collapsed: 'primary'})
    assert.equal(document.activeElement, details, 'collapse does not steal outside focus')
    split.destroy()
})

test('split collapse without an opener uses a focusable container fallback and validates identity', () => {
    const props = {horizontal: true as const, children: panes()}
    const split = new SplitView(props).attachTo(document.body)
    ;(split.dom as HTMLElement).querySelector<HTMLInputElement>('cap-secondary input')!.focus()
    split.setProps({...props, collapsed: 'secondary'})
    assert.equal(document.activeElement, split.dom)
    split.destroy()
    assert.throws(() => new SplitView({...props, collapsed: 'both' as CollapsedSplitPane}).attachTo(document.body), /collapsed/)
})

test('drawer mount policies retain or dispose content explicitly without disposing caller state', () => {
    for (const policy of ['eager', 'lazy', 'active-only'] as const) {
        let mounted = 0, destroyed = 0
        class Content extends Component {
            render() { return h('input', {'aria-label': 'Buffered input'}) }
            afterMount() { mounted++ }
            onDestroy() { destroyed++ }
        }
        const open = new Emitter(false)
        const drawer = new Drawer({label: 'Inspector', valueEmitter: open, mountPolicy: policy, children: h(Content, {})}).attachTo(document.body)
        assert.equal(mounted, policy === 'eager' ? 1 : 0)
        open.set(true); assert.equal(mounted, 1)
        const input = (drawer.dom as HTMLElement).querySelector('input')!; input.value = 'Buffered'
        open.set(false); assert.equal(destroyed, policy === 'active-only' ? 1 : 0)
        open.set(true)
        assert.equal(mounted, policy === 'active-only' ? 2 : 1)
        assert.equal((drawer.dom as HTMLElement).querySelector('input')!.value, policy === 'active-only' ? '' : 'Buffered')
        drawer.destroy(); assert.equal(open.subscriberCount, 0)
        open.set(false); open.dispose()
    }
})

test('drawer has no focus trap/autofocus and only restores focus when its content closes', () => {
    const opener = document.createElement('button'), outside = document.createElement('input')
    document.body.append(opener, outside); opener.focus()
    const open = new Emitter(false); let count = 0
    const drawer = new Drawer({label: 'Changes', valueEmitter: open, children: h('input', {'aria-label': 'Notes'}), onClose: () => count++}).attachTo(document.body)
    open.set(true); assert.equal(document.activeElement, opener)
    const host = drawer.dom as HTMLElement
    assert.equal(host.getAttribute('role'), 'region'); assert.equal(host.hasAttribute('aria-modal'), false)
    host.querySelector('input')!.focus()
    host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}))
    assert.equal(open.get(), false); assert.equal(document.activeElement, opener); assert.equal(count, 1)
    open.set(true); outside.focus(); open.set(false)
    assert.equal(document.activeElement, outside); assert.equal(count, 2)
    drawer.destroy(); open.dispose()
})

test('drawer honors intentional initial/return refs and nested Escape consumption', () => {
    const destination = document.createElement('button'); document.body.append(destination)
    const initial: {current: HTMLElement | null} = {current: null}
    const open = new Emitter(false)
    const drawer = new Drawer({label: 'Problems', valueEmitter: open, initialFocusRef: initial, returnFocusRef: {current: destination},
        children: h('input', {ref: initial, onKeyDown: (event: KeyboardEvent) => event.preventDefault()}),
    }).attachTo(document.body)
    open.set(true); assert.equal(document.activeElement, initial.current)
    initial.current!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}))
    assert.equal(open.get(), true)
    drawer.close(); assert.equal(document.activeElement, destination)
    drawer.destroy(); open.dispose()
})

test('drawer validates label, logical edge, size and mount policy', () => {
    for (const props of [{label: ''}, {label: 'X', edge: 'left'}, {label: 'X', size: ''}, {label: 'X', mountPolicy: 'forever'}]) {
        assert.throws(() => new Drawer(props as never).attachTo(document.body))
    }
})
