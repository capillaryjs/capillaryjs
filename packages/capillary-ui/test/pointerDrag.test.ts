import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {Component, createPointerDrag} from '../src/index.js'
import type {PointerDragOptions} from '../src/index.js'
let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {window, document: window.document, Node: window.Node, Element: window.Element,
        HTMLElement: window.HTMLElement, Event: window.Event, EventTarget: window.EventTarget,
        MouseEvent: window.MouseEvent, KeyboardEvent: window.KeyboardEvent, PointerEvent: window.PointerEvent})
})
after(() => window.close())
function fixture(options: PointerDragOptions<string> = {}) {
    const owner = new Component({}), element = document.createElement('article')
    document.body.append(element)
    const captures = new Set<number>()
    element.setPointerCapture = id => {captures.add(id)}
    element.hasPointerCapture = id => captures.has(id)
    element.releasePointerCapture = id => {captures.delete(id)}
    const drag = createPointerDrag(owner, options)
    const event = (type: string, x = 0, pointerId = 1) => new PointerEvent(type, {clientX: x, clientY: 0, pointerId, isPrimary: true, button: 0, bubbles: true, cancelable: true})
    const send = (type: string, x = 0, id = 1) => element.dispatchEvent(event(type, x, id))
    return {owner, element, captures, drag, event, send, destroy: () => {owner.destroy(); element.remove()}}
}
test('threshold separates clicks, preview and one committed drag with captured context', () => {
    const calls: string[] = []
    const f = fixture({onStart: state => calls.push(`start:${state.context}`), onMove: state => calls.push(`move:${state.dx}`), onCommit: state => calls.push(`commit:${state.dx}`)})
    assert.equal(f.drag.begin(f.event('pointerdown'), 'first', f.element), true)
    f.send('pointermove', 3); assert.deepEqual(calls, []); f.send('pointerup', 3)
    assert.deepEqual(calls, []); assert.equal(f.captures.size, 0)
    f.drag.begin(f.event('pointerdown'), 'second', f.element)
    f.send('pointermove', 10); f.send('pointermove', 20); f.send('pointerup', 25); f.send('pointerup', 30)
    assert.deepEqual(calls, ['start:second', 'move:10', 'move:20', 'commit:25'])
    f.drag.begin(f.event('pointerdown'), 'coalesced', f.element); f.send('pointerup', 40)
    assert.deepEqual(calls.slice(-3), ['start:coalesced', 'move:40', 'commit:40'])
    assert.equal(f.drag.active, false); assert.equal(f.captures.size, 0); f.destroy()
})
test('pointer identity, replacement and native cancellation release capture without committing', () => {
    const cancelled: string[] = []; let commits = 0
    const f = fixture({onCancel: (state, reason) => cancelled.push(`${state.context}:${reason}`), onCommit: () => commits++})
    f.drag.begin(f.event('pointerdown'), 'first', f.element)
    f.send('pointermove', 10, 2); f.send('pointerup', 20, 2); assert.equal(f.drag.dragging, false)
    f.drag.begin(f.event('pointerdown', 0, 2), 'next', f.element)
    assert.deepEqual(cancelled, ['first:replaced']); assert.equal(f.drag.context, 'next')
    f.send('pointercancel', 20, 2)
    f.drag.begin(f.event('pointerdown'), 'lost', f.element); f.send('lostpointercapture')
    assert.deepEqual(cancelled, ['first:replaced', 'next:pointercancel', 'lost:lostcapture'])
    assert.equal(commits, 0); assert.equal(f.captures.size, 0); f.destroy()
})
test('Escape, explicit cancellation and owner disposal clean listeners and reject late events', () => {
    const reasons: string[] = []; let moves = 0
    const f = fixture({onMove: () => moves++, onCancel: (_state, reason) => reasons.push(reason)})
    f.drag.begin(f.event('pointerdown'), 'escape', f.element)
    const escape = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true})
    document.dispatchEvent(escape); assert.equal(escape.defaultPrevented, true)
    f.drag.begin(f.event('pointerdown'), 'stale', f.element); f.drag.cancel('context-changed')
    f.drag.begin(f.event('pointerdown'), 'blur', f.element); window.dispatchEvent(new window.Event('blur'))
    f.drag.begin(f.event('pointerdown'), 'disposed', f.element); f.owner.destroy()
    f.send('pointermove', 100); f.send('pointerup', 200)
    assert.deepEqual(reasons, ['escape', 'context-changed', 'blur', 'disposed']); assert.equal(moves, 0)
    assert.equal(f.drag.begin(f.event('pointerdown'), 'late', f.element), false)
    assert.equal(f.captures.size, 0); f.destroy()
})
test('only the post-drag pointer click on the captured widget is consumed', () => {
    const f = fixture()
    f.drag.begin(f.event('pointerdown'), 'drag', f.element); f.send('pointermove', 10); f.send('pointerup', 10)
    const keyboard = new MouseEvent('click', {detail: 0}); f.element.dispatchEvent(keyboard)
    assert.equal(f.drag.consumeClick(keyboard), false)
    const outside = new MouseEvent('click', {detail: 1}); document.body.dispatchEvent(outside)
    assert.equal(f.drag.consumeClick(outside), false)
    const click = new MouseEvent('click', {detail: 1}); f.element.dispatchEvent(click)
    assert.equal(f.drag.consumeClick(click), true); assert.equal(f.drag.consumeClick(click), false)
    f.drag.begin(f.event('pointerdown'), 'next', f.element); f.send('pointermove', 10); f.send('pointerup', 10)
    f.drag.cancel(); assert.equal(f.drag.consumeClick(click), false, 'idle cancellation clears pending suppression')
    f.destroy()
})
test('invalid thresholds and secondary pointer starts are rejected', () => {
    const owner = new Component({})
    assert.throws(() => createPointerDrag(owner, {threshold: NaN}), /threshold/)
    const f = fixture()
    assert.equal(f.drag.begin(new PointerEvent('pointerdown', {button: 2}), 'right', f.element), false)
    assert.equal(f.drag.begin(new PointerEvent('pointerdown', {button: 0, isPrimary: false}), 'second', f.element), false)
    f.destroy(); owner.destroy()
})

test('capture failure and cancellation from start cannot leak a gesture or preview', () => {
    const reasons: string[] = []
    const f = fixture({onCancel: (_state, reason) => reasons.push(reason)})
    f.element.setPointerCapture = () => {throw new Error('Pointer no longer active')}
    assert.equal(f.drag.begin(f.event('pointerdown'), 'failed', f.element), false)
    assert.equal(f.drag.active, false); assert.deepEqual(reasons, ['capturefailed']); f.destroy()
    let moves = 0
    const next = fixture({onStart: () => next.drag.cancel('context-changed'), onMove: () => moves++})
    next.drag.begin(next.event('pointerdown'), 'cancel-from-start', next.element); next.send('pointermove', 20)
    assert.equal(moves, 0); assert.equal(next.drag.active, false); assert.equal(next.captures.size, 0); next.destroy()
})
