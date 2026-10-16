import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {Button, PanZoomToolbar, PanZoomViewport, h, panZoomClampCamera, panZoomClientToWorld, panZoomFitCamera, panZoomWorldToClient, panZoomZoomAt} from '../src/index.js'
import type {PanZoomCamera, PanZoomViewportProps} from '../src/index.js'
import {installPopoverStub} from '../../../test-utils/nativePopover.js'
let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    installPopoverStub(window.HTMLElement.prototype)
    Object.assign(globalThis, {window, document: window.document, Node: window.Node, Element: window.Element,
        HTMLElement: window.HTMLElement, Event: window.Event, EventTarget: window.EventTarget,
        MouseEvent: window.MouseEvent, KeyboardEvent: window.KeyboardEvent, PointerEvent: window.PointerEvent, DocumentFragment: window.DocumentFragment})
})
after(() => window.close())
test('viewport named toolbar is outside scaled content and rejects duplicate/legacy regions', () => {
    const props = {label: 'Canvas', worldWidth: 100, worldHeight: 100}
    const viewport = new PanZoomViewport({...props, children: [h(PanZoomToolbar, {}, h(Button, {label: 'Fit selection'})), h('article', {}, 'World')]}).attachTo(document.body)
    const host = viewport.dom as HTMLElement
    const action = [...host.querySelectorAll('button')].find(button => button.textContent === 'Fit selection')
    assert.equal(action?.closest('.cap-viewport-toolbar')?.parentElement, host)
    assert.equal(host.querySelector('.cap-viewport-world button'), null)
    assert.equal(host.querySelector('cap-panzoomtoolbar'), null)
    viewport.destroy()
    assert.throws(() => new PanZoomViewport({...props, toolbar: 'Legacy'} as never).attachTo(document.body), /PanZoomToolbar/)
    assert.throws(() => new PanZoomViewport({...props, children: [h(PanZoomToolbar, {}), h(PanZoomToolbar, {})]}).attachTo(document.body), /duplicate/)
})
test('client/world conversion has independently expected offsets and zoom', () => {
    const camera = {x: 100, y: 50, zoom: 2}, origin = {x: 20, y: 30}
    assert.deepEqual(panZoomClientToWorld({x: 120, y: 130}, origin, camera), {x: 100, y: 75})
    assert.deepEqual(panZoomWorldToClient({x: 100, y: 75}, origin, camera), {x: 120, y: 130})
    assert.deepEqual(panZoomClientToWorld({x: 0, y: 0}, origin, camera), {x: 40, y: 10})
})
test('zoom preserves the explicit inner-viewport anchor before boundary clamping', () => {
    const next = panZoomZoomAt({x: 100, y: 50, zoom: 1}, 2, {x: 200, y: 100})
    assert.deepEqual(next, {x: 400, y: 200, zoom: 2})
    assert.deepEqual(panZoomClientToWorld({x: 200, y: 100}, {x: 0, y: 0}, next), {x: 300, y: 150})
})
test('fit centers an independently computed rectangle and clamp bounds scaled scroll offsets', () => {
    assert.deepEqual(panZoomFitCamera({x: 100, y: 200, width: 400, height: 200}, {width: 400, height: 300}, {}, 0), {x: 100, y: 150, zoom: 1})
    assert.deepEqual(panZoomClampCamera({x: 999, y: 999, zoom: 5}, {width: 200, height: 300}, {width: 400, height: 500}), {x: 0, y: 100, zoom: 2})
    assert.deepEqual(panZoomClampCamera({x: -10, y: 400, zoom: .1}, {width: 200, height: 300}, {width: 400, height: 500}), {x: 0, y: 0, zoom: .25})
})
test('geometry rejects nonfinite dimensions, invalid limits and a hidden fit target', () => {
    assert.throws(() => panZoomClampCamera({x: 0, y: 0, zoom: 0}, {width: 10, height: 10}, {width: 10, height: 10}), /positive/)
    assert.throws(() => panZoomClampCamera({x: 0, y: 0, zoom: 1}, {width: Infinity, height: 10}, {width: 10, height: 10}), /finite/)
    assert.throws(() => panZoomZoomAt({x: 0, y: 0, zoom: 1}, 2, {x: 0, y: 0}, {minZoom: 3, maxZoom: 2}), /limits/)
    assert.throws(() => panZoomFitCamera({x: 0, y: 0, width: 10, height: 10}, {width: 0, height: 0}), /positive viewport/)
    assert.throws(() => panZoomZoomAt({x: Number.MAX_VALUE, y: 0, zoom: 1}, 2, {x: 0, y: 0}), /finite/)
})
test('controlled viewport emits camera requests and keeps native refs/coordinate conversion stable', () => {
    const first: {current: HTMLElement | null} = {current: null}, second: {current: HTMLElement | null} = {current: null}
    const changes: PanZoomCamera[] = []
    let current: PanZoomViewportProps
    const accept = (camera: PanZoomCamera) => {changes.push(camera); current = {...current, camera}; viewport.setProps(current)}
    current = {label: 'Canvas', worldWidth: 1200, worldHeight: 800, camera: {x: 100, y: 50, zoom: 1}, onCameraChange: accept, viewportRef: first}
    const viewport = new PanZoomViewport(current).attachTo(document.body), element = first.current!
    Object.defineProperties(element, {clientWidth: {value: 400}, clientHeight: {value: 300}})
    viewport.afterUpdate(); viewport.zoomTo(2, {x: 200, y: 100})
    assert.deepEqual(changes.at(-1), {x: 400, y: 200, zoom: 2})
    assert.deepEqual(viewport.clientToWorld({x: 20, y: 30}), {x: 210, y: 115})
    current = {...current, viewportRef: second}; viewport.setProps(current)
    assert.equal(first.current, null); assert.equal(second.current, element)
    viewport.destroy(); assert.equal(second.current, null)
})
test('fit requests remain pending while hidden and execute once after a nonzero resize', () => {
    const changes: PanZoomCamera[] = []
    const ref: {current: HTMLElement | null} = {current: null}
    const viewport = new PanZoomViewport({label: 'Hidden canvas', worldWidth: 1200, worldHeight: 800, viewportRef: ref,
        fitRequest: {key: 1, bounds: {x: 300, y: 200, width: 400, height: 200}}, onCameraChange: camera => changes.push(camera),
    }).attachTo(document.body)
    assert.deepEqual(changes, [])
    Object.defineProperties(ref.current!, {clientWidth: {value: 400}, clientHeight: {value: 300}})
    viewport.afterUpdate(); assert.deepEqual(changes, [{x: 225, y: 105, zoom: .85}])
    viewport.afterUpdate(); assert.equal(changes.length, 1)
    viewport.destroy()
})

test('disabled and controlled read-only viewports cannot change camera through controls or native scroll', () => {
    const ref: {current: HTMLElement | null} = {current: null}
    const props = {label: 'Frozen canvas', worldWidth: 1200, worldHeight: 800, viewportRef: ref, disabled: true}
    const viewport = new PanZoomViewport(props).attachTo(document.body)
    Object.defineProperties(ref.current!, {clientWidth: {value: 400}, clientHeight: {value: 300}})
    viewport.afterUpdate(); viewport.zoomTo(2); viewport.panBy(100, 100)
    ref.current!.scrollLeft = 50; ref.current!.dispatchEvent(new Event('scroll'))
    assert.deepEqual(viewport.camera, {x: 0, y: 0, zoom: 1}); assert.equal(ref.current!.scrollLeft, 0)
    viewport.setProps({...props, disabled: false, camera: {x: 100, y: 50, zoom: 1}})
    viewport.panBy(100, 100); assert.equal(ref.current!.scrollLeft, 100)
    viewport.destroy()
})

test('hiding while replacing context cannot roll an active pan back into the new context', () => {
    const ref: {current: HTMLElement | null} = {current: null}, changes: PanZoomCamera[] = []
    let props: PanZoomViewportProps
    const accept = (camera: PanZoomCamera) => {changes.push(camera); props = {...props, camera}; viewport.setProps(props)}
    props = {label: 'Canvas', worldWidth: 1200, worldHeight: 800, viewportRef: ref, interactionKey: 'old',
        camera: {x: 100, y: 50, zoom: 1}, onCameraChange: accept}
    const viewport = new PanZoomViewport(props).attachTo(document.body), element = ref.current!
    Object.defineProperties(element, {clientWidth: {configurable: true, value: 400}, clientHeight: {configurable: true, value: 300}})
    let captured = false
    element.setPointerCapture = () => {captured = true}; element.hasPointerCapture = () => captured; element.releasePointerCapture = () => {captured = false}
    viewport.afterUpdate()
    element.dispatchEvent(new PointerEvent('pointerdown', {clientX: 20, clientY: 20, pointerId: 1, isPrimary: true, button: 0, bubbles: true, cancelable: true}))
    element.dispatchEvent(new PointerEvent('pointermove', {clientX: 10, clientY: 10, pointerId: 1, isPrimary: true, bubbles: true, cancelable: true}))
    assert.deepEqual(props.camera, {x: 110, y: 60, zoom: 1})
    const count = changes.length
    Object.defineProperties(element, {clientWidth: {configurable: true, value: 0}, clientHeight: {configurable: true, value: 0}})
    props = {...props, interactionKey: 'new'}; viewport.setProps(props)
    assert.equal(changes.length, count); assert.deepEqual(props.camera, {x: 110, y: 60, zoom: 1}); assert.equal(captured, false)
    viewport.destroy()
})
