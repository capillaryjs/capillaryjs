import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {AsyncCommand, Emitter} from '@capillaryjs/capillary'
import {Button, Component, DataTable, ListView, TreeView, createCapillaryUiRuntime, createRestTableDataSource, h} from '../src/index.js'

let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {window, document: window.document, Node: window.Node,
        Element: window.Element, HTMLElement: window.HTMLElement, Event: window.Event,
        EventTarget: window.EventTarget, MouseEvent: window.MouseEvent,
        KeyboardEvent: window.KeyboardEvent, DocumentFragment: window.DocumentFragment})
})
afterEach(() => document.body.replaceChildren())
after(() => window.close())

test('visual delay preserves immediate command guards, suppresses fast work and delays busy labels', async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    let finish = () => {}, calls = 0
    const command = new AsyncCommand<void, void>({execute: () => {
        calls++
        return new Promise<void>(resolve => { finish = resolve })
    }})
    const button = new Button({label: 'Save', busyLabel: 'Saving', command}).attachTo(document.body)
    const native = document.querySelector('button')!
    native.click()
    assert.equal(native.getAttribute('aria-busy'), 'true')
    assert.equal(native.disabled, true)
    assert.equal(native.textContent, 'Save')
    assert.equal(native.hasAttribute('data-cap-busy-visible'), false)
    native.click()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.equal(calls, 1)
    finish()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    t.mock.timers.tick(151)
    assert.equal(native.hasAttribute('data-cap-busy-visible'), false)
    native.click()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    t.mock.timers.tick(149)
    assert.equal(native.textContent, 'Save')
    t.mock.timers.tick(1)
    assert.equal(native.textContent, 'Saving')
    assert.equal(native.hasAttribute('data-cap-busy-visible'), true)
    finish()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.equal(native.hasAttribute('data-cap-busy-visible'), false)
    assert.equal(native.textContent, 'Save')
    button.destroy()
    command.dispose()
})

test('selection pending belongs to current items and replacement restarts only its visual delay', t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const selected = new Emitter<string | null>('a')
    const props = {label: 'Tree', nodes: [{id: 'a', label: 'Alpha'}, {id: 'b', label: 'Beta'}],
        selectedKeyEmitter: selected, selectionBusy: true}
    const tree = new TreeView(props).attachTo(document.body)
    const host = tree.dom as Element
    assert.equal(host.hasAttribute('aria-busy'), false)
    assert.equal(host.querySelector('[aria-busy="true"]')?.textContent?.trim(), '•Alpha')
    t.mock.timers.tick(150)
    assert.equal(host.querySelector('[data-cap-busy-visible]')?.getAttribute('aria-selected'), 'true')
    selected.set('b')
    assert.equal(host.querySelectorAll('[aria-busy="true"]').length, 1)
    assert.equal(host.querySelector('[aria-busy="true"]')?.textContent?.trim(), '•Beta')
    assert.equal(host.querySelector('[data-cap-busy-visible]'), null)
    t.mock.timers.tick(149)
    tree.setProps({...props, selectionBusy: false})
    t.mock.timers.tick(1)
    assert.equal(host.querySelector('[data-cap-busy-visible]'), null)
    tree.destroy()
    selected.dispose()
})

test('list and table expose selection loading without marking their data or headers busy', t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    const rows = [{id: 1n, label: 'Alpha'}, {id: 2n, label: 'Beta'}]
    const selected = new Emitter<typeof rows[number] | null>(rows[0]!)
    const list = new ListView({items: rows, itemKey: 'id', selectedItemEmitter: selected, selectionBusy: true})
        .attachTo(document.body)
    const table = new DataTable({data: rows, rowKey: 'id', selectedItemEmitter: selected, selectionBusy: true,
        columns: [{field: 'label', sortable: true}]}).attachTo(document.body)
    t.mock.timers.tick(150)
    for (const component of [list, table]) {
        const host = component.dom as Element
        assert.equal(host.hasAttribute('aria-busy'), false)
        assert.equal(host.hasAttribute('data-cap-retained-loading'), false)
        assert.equal(host.querySelectorAll('[data-cap-busy-visible]').length, 1)
    }
    assert.equal(document.querySelector('th button[aria-busy]'), null)
    list.destroy(); table.destroy(); selected.dispose()
})

test('custom loading timing supports configuration, immediate errors and timer disposal', t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    class Surface extends Component<{pending: boolean; error?: string}> {
        renders = 0
        render() {
            this.renders++
            return h('p', {'aria-busy': this.props.pending ? 'true' : null,
                'data-cap-busy-visible': this.presentBusy(this.props.pending && !this.props.error) ? '' : null},
            this.props.error ?? 'Result')
        }
    }
    const runtime = createCapillaryUiRuntime({busyDelayMs: 200})
    const surface = runtime.create(Surface, {pending: true})
    runtime.mount(surface, document.body)
    t.mock.timers.tick(150)
    assert.equal((surface.dom as Element).hasAttribute('data-cap-busy-visible'), false)
    surface.setProps({pending: true, error: 'Failed'})
    assert.equal(surface.dom?.textContent, 'Failed')
    t.mock.timers.tick(100)
    assert.equal((surface.dom as Element).hasAttribute('data-cap-busy-visible'), false)
    surface.setProps({pending: true})
    const renders = surface.renders
    surface.destroy()
    t.mock.timers.tick(500)
    assert.equal(surface.renders, renders)
    assert.throws(() => createCapillaryUiRuntime({busyDelayMs: -1}), /busyDelayMs/)
    assert.throws(() => createCapillaryUiRuntime({busyDelayMs: NaN}), /busyDelayMs/)
    const immediate = createCapillaryUiRuntime({busyDelayMs: 0}).create(Surface, {pending: true})
    immediate.attachTo(document.body)
    assert.equal((immediate.dom as Element).hasAttribute('data-cap-busy-visible'), true)
    immediate.destroy()
})

test('remote sorting marks only the initiating header and settles with its query', async t => {
    t.mock.timers.enable({apis: ['setTimeout']})
    let release = () => {}, requests = 0
    const source = createRestTableDataSource<{id: string; label: string}>({url: '/rows', baseUrl: 'https://example.test',
        fetch: async () => {
            if (requests++ > 0) await new Promise<void>(resolve => { release = resolve })
            return {ok: true, json: () => [{id: 'a', label: 'Alpha'}]}
        }})
    const table = new DataTable({dataSource: source, columns: [
        {field: 'label', label: 'Label', sortable: true}, {field: 'id', label: 'Key', sortable: true},
    ]}).attachTo(document.body)
    for (let i = 0; i < 20; i++) await Promise.resolve()
    const label = document.querySelector<HTMLButtonElement>('[aria-label="Sort Label"]')!
    const key = document.querySelector<HTMLButtonElement>('[aria-label="Sort Key"]')!
    label.click()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.equal(label.getAttribute('aria-busy'), 'true')
    assert.equal(key.hasAttribute('aria-busy'), false)
    t.mock.timers.tick(150)
    assert.equal(label.hasAttribute('data-cap-busy-visible'), true)
    release()
    for (let i = 0; i < 20; i++) await Promise.resolve()
    assert.equal(label.hasAttribute('aria-busy'), false)
    assert.equal(label.hasAttribute('data-cap-busy-visible'), false)
    assert.equal(requests, 2)
    table.destroy(); source.dispose()
})
