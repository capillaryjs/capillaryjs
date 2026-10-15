import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {AsyncCommand, Emitter} from '@capillaryjs/capillary'
import {Button, Component, DataTable, FilterPanel, Icon, ListView, Popover, ThemePicker, TreeView, h, live} from '../src/index.js'
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

test('external busy retains collection content and permits application-controlled selection', () => {
    const pending = new Emitter(false)
    class Owner extends Component {
        render() {
            return h('div', null,
                h(ListView, {items: [{id: 'a', label: 'Alpha'}], itemKey: 'id', label: 'List', busy: live(pending)}),
                h(TreeView, {nodes: [{id: 'a', label: 'Alpha'}], label: 'Tree', busy: live(pending)}),
                h(DataTable, {data: [{id: 'a', label: 'Alpha'}], rowKey: 'id', busy: live(pending),
                    columns: [{field: 'label', label: 'Label', sortable: true, filterOptions: ['Alpha']}]}))
        }
        static dependencies = [ListView, TreeView, DataTable]
    }
    const owner = Owner.new().attachTo(document.body)
    const listRow = document.querySelector<HTMLElement>('cap-listview [role="option"]')!
    pending.set(true)
    for (const host of document.querySelectorAll('cap-listview,cap-treeview,cap-datatable')) {
        assert.equal(host.getAttribute('aria-busy'), 'true')
        assert.equal(host.hasAttribute('data-cap-retained-loading'), true)
        assert.match(host.textContent!, /Alpha/)
        assert.equal(host.querySelector('cap-placeholder'), null)
    }
    assert.equal(document.querySelector('cap-listview [role="option"]'), listRow)
    for (const row of document.querySelectorAll<HTMLElement>('[role="option"],[role="treeitem"],tbody tr')) {
        row.click()
        assert.equal(row.getAttribute('aria-selected'), 'true')
    }
    for (const button of document.querySelectorAll('th button')) assert.equal(button.getAttribute('aria-busy'), 'true')
    pending.set(false)
    for (const host of document.querySelectorAll('cap-listview,cap-treeview,cap-datatable')) {
        assert.equal(host.hasAttribute('aria-busy'), false)
        assert.equal(host.hasAttribute('data-cap-retained-loading'), false)
    }
    owner.destroy()
    assert.equal(pending.subscriberCount, 0)
    pending.dispose()
})

test('new static table rows replace old values while retaining table/header and keyed selection', () => {
    const props = {data: [{id: 'a', name: 'Before'}], rowKey: 'id' as const,
        columns: [{field: 'name' as const, label: 'Name'}]}
    const table = new DataTable(props).attachTo(document.body)
    const element = document.querySelector('table'), header = document.querySelector('thead')
    document.querySelector<HTMLElement>('tbody tr')!.click()
    const after = {id: 'a', name: 'After'}
    table.setProps({...props, data: [after]})
    assert.equal(document.querySelector('tbody')!.textContent, 'After')
    assert.equal(document.querySelector('table'), element)
    assert.equal(document.querySelector('thead'), header)
    assert.equal(table.getSelectedRows()[0], after)
    const external = new Emitter(props.data)
    assert.throws(() => table.setProps({...props, data: external}), /different data source/)
    external.dispose()
    table.destroy()
})

test('static collection data and its new render callbacks are installed coherently', () => {
    const old = {old: 'Before'}, next = {new: 'After'}
    const renderOld = (id: string) => { assert.ok(id in old); return old[id as keyof typeof old] }
    const renderNext = (id: string) => { assert.ok(id in next); return next[id as keyof typeof next] }
    const list = new ListView<string>({items: ['old'], renderItem: renderOld}).attachTo(document.body)
    list.setProps({items: ['new'], renderItem: renderNext})
    assert.equal(list.dom?.textContent, 'After')
    list.destroy()
    const tree = new TreeView({label: 'Tree', nodes: [{id: 'old', label: 'Old'}], renderItem: node => renderOld(String(node.id))})
        .attachTo(document.body)
    tree.setProps({label: 'Tree', nodes: [{id: 'new', label: 'New'}], renderItem: node => renderNext(String(node.id))})
    assert.match(tree.dom?.textContent ?? '', /After/)
    tree.destroy()
    const table = new DataTable({data: [{id: 'old', name: 'Before'}], rowKey: 'id',
        columns: [{field: 'name', render: row => renderOld(row.id)}]}).attachTo(document.body)
    table.setProps({data: [{id: 'new', name: 'After'}], rowKey: 'id',
        columns: [{field: 'name', render: row => renderNext(row.id)}]})
    assert.equal((table.dom as HTMLElement).querySelector('tbody')?.textContent, 'After')
    table.destroy()
})

test('filter choices use standard busy presentation without preventing refinement', () => {
    const pending = new Emitter(true)
    let changes = 0
    class Owner extends Component {
        render() { return h(FilterPanel, {options: ['Alpha'], busy: live(pending), onChange: () => changes++}) }
    }
    const panel = Owner.new().attachTo(document.body)
    const input = document.querySelector<HTMLInputElement>('input')!
    assert.equal(input.getAttribute('aria-busy'), 'true')
    assert.equal(input.disabled, false)
    input.click()
    assert.equal(changes, 1)
    panel.destroy()
    assert.equal(pending.subscriberCount, 0)
    pending.dispose()
})

test('icon-only actions require names and retain icon identity throughout command work', async () => {
    let finish!: () => void
    const command = new AsyncCommand<void, void>({execute: () => new Promise(resolve => finish = resolve)})
    const action = Button.new({icon: 'add', ariaLabel: 'Add definition', appearance: 'subtle', command,
        ariaControls: 'definition-popup', ariaExpanded: false, ariaHasPopup: 'dialog'})
        .attachTo(document.body)
    const button = document.querySelector<HTMLButtonElement>('button')!, icon = button.querySelector('cap-icon')
    assert.equal(button.getAttribute('aria-label'), 'Add definition')
    assert.equal(button.title, 'Add definition')
    assert.equal(button.getAttribute('aria-controls'), 'definition-popup')
    assert.equal(button.getAttribute('aria-expanded'), 'false')
    assert.equal(button.getAttribute('aria-haspopup'), 'dialog')
    assert.equal(icon?.getAttribute('aria-hidden'), 'true')
    button.click()
    assert.equal(button.getAttribute('aria-busy'), 'true')
    assert.equal(button.disabled, true)
    assert.equal(button.querySelector('cap-icon'), icon)
    await Promise.resolve()
    finish()
    await command._activeRequest
    assert.equal(button.hasAttribute('aria-busy'), false)
    assert.equal(button.querySelector('cap-icon'), icon)
    assert.throws(() => Button.new({icon: 'add'}).attachTo(document.body), /requires ariaLabel/)
    assert.throws(() => Icon.new({name: 'unknown' as never}).attachTo(document.body), /Unknown icon/)
    action.destroy()
    command.dispose()
})

test('explicit busy guards actions by default but permits an intentional replacement policy', () => {
    let count = 0
    const guarded = Button.new({label: 'Guarded', busy: true, onClick: () => count++}).attachTo(document.body)
    const replacement = Button.new({label: 'Replace', busy: true, disableWhileRunning: false, onClick: () => count++}).attachTo(document.body)
    const buttons = document.querySelectorAll<HTMLButtonElement>('button')
    buttons[0]!.click()
    buttons[1]!.click()
    assert.equal(count, 1)
    assert.equal(buttons[1]!.getAttribute('aria-busy'), 'true')
    replacement.setProps({label: 'Replace', busy: true, disableWhileRunning: false, disabled: true, onClick: () => count++})
    buttons[1]!.click()
    assert.equal(count, 1, 'explicit disabled always wins')
    guarded.destroy(); replacement.destroy()
})

test('controlled popover returns focus and releases state subscriptions on destruction', () => {
    const open = new Emitter(false)
    const anchor = document.createElement('button')
    anchor.textContent = 'Connect'
    document.body.append(anchor)
    let closed = 0
    const popover = Popover.new({label: 'Connection', anchor, valueEmitter: open,
        onClose: () => closed++, children: h('input', {'aria-label': 'Target'})}).attachTo(document.body)
    open.set(true)
    const panel = document.querySelector<HTMLElement>('[popover]')!
    assert.equal(panel.matches(':popover-open'), true)
    assert.equal(document.activeElement, panel.querySelector('input'))
    popover.close()
    assert.equal(open.get(), false)
    assert.equal(panel.matches(':popover-open'), false)
    assert.equal(document.activeElement, anchor)
    assert.equal(closed, 1)
    popover.destroy()
    assert.equal(open.subscriberCount, 0)
    open.dispose()
})

test('stylesheet selection stays busy through native load, replaces old work and supports failure retry', async () => {
    document.head.querySelectorAll('link[data-cap-stylesheet]').forEach(link => link.remove())
    const value = new Emitter('a')
    const picker = ThemePicker.new({label: 'Theme', valueEmitter: value, options: [
        {value: 'a', label: 'A', href: '/a.css'}, {value: 'b', label: 'B', href: '/b.css'},
    ]}).attachTo(document.body)
    const select = document.querySelector<HTMLSelectElement>('select')!
    const first = document.head.querySelector<HTMLLinkElement>('link[data-cap-stylesheet="theme"]')!
    assert.equal(document.documentElement.dataset.theme, 'a', 'selection remains synchronous')
    await flush()
    assert.equal(select.getAttribute('aria-busy'), 'true')
    select.value = 'b'
    select.dispatchEvent(new Event('change', {bubbles: true}))
    const second = document.head.querySelector<HTMLLinkElement>('link[data-cap-stylesheet="theme"]')!
    assert.notEqual(first, second)
    await flush()
    first.dispatchEvent(new Event('load'))
    await flush()
    assert.equal(select.getAttribute('aria-busy'), 'true', 'obsolete resource cannot settle the replacement')
    second.dispatchEvent(new Event('error'))
    await flush()
    assert.equal(select.hasAttribute('aria-busy'), false)
    assert.equal(select.getAttribute('aria-invalid'), 'true')
    document.querySelector<HTMLButtonElement>('button[aria-label="Retry stylesheet"]')!.click()
    await flush()
    const retry = document.head.querySelector<HTMLLinkElement>('link[data-cap-stylesheet="theme"]')!
    assert.notEqual(retry, second)
    assert.equal(select.getAttribute('aria-busy'), 'true')
    retry.dispatchEvent(new Event('load'))
    await flush()
    assert.equal(select.hasAttribute('aria-busy'), false)
    assert.equal(select.hasAttribute('aria-invalid'), false)
    picker.destroy()
    assert.equal(value.subscriberCount, 0)
    value.dispose()
})

test('stylesheet observer releases a disposed pending picker and accepts an already loaded link', async () => {
    document.head.querySelectorAll('link[data-cap-stylesheet]').forEach(link => link.remove())
    const value = new Emitter('a')
    const options = [{value: 'a', label: 'A', href: '/cached.css'}]
    const picker = ThemePicker.new({label: 'Theme', options, valueEmitter: value}).attachTo(document.body)
    await flush()
    const link = document.head.querySelector<HTMLLinkElement>('link[data-cap-stylesheet="theme"]')!
    picker.destroy()
    assert.equal(value.subscriberCount, 0)
    link.dispatchEvent(new Event('load'))
    await flush()
    assert.equal(document.body.childElementCount, 0)
    Object.defineProperty(link, 'sheet', {configurable: true, value: {}})
    const cached = ThemePicker.new({label: 'Cached theme', options, valueEmitter: value}).attachTo(document.body)
    await flush()
    assert.equal(document.querySelector('select')!.hasAttribute('aria-busy'), false)
    cached.destroy()
    value.dispose()
})
