import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {AsyncCommand, Emitter, FetchState, LiveQuery} from '@capillaryjs/capillary'
import {ComboBox, createCapillaryUiRuntime} from '../src/index.js'
import type {ComboBoxOption} from '../src/index.js'
import {installPopoverStub} from '../../../test-utils/nativePopover.js'

let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    installPopoverStub(window.HTMLElement.prototype)
    Object.assign(globalThis, {window, document: window.document, Node: window.Node,
        Element: window.Element, HTMLElement: window.HTMLElement, Event: window.Event,
        EventTarget: window.EventTarget, MouseEvent: window.MouseEvent, KeyboardEvent: window.KeyboardEvent,
        DocumentFragment: window.DocumentFragment, FormData: window.FormData})
})
afterEach(() => document.body.replaceChildren())
after(() => window.close())
const flush = async () => { for (let n = 0; n < 16; n++) await Promise.resolve() }
const input = () => document.querySelector<HTMLInputElement>('[role="combobox"]')!
const key = (value: string, isComposing = false) => input().dispatchEvent(new KeyboardEvent('keydown', {key: value, isComposing, bubbles: true, cancelable: true}))
const search = (value: string) => { input().value = value; input().dispatchEvent(new Event('input', {bubbles: true})) }
const options = [{value: 'a', label: 'Alpha'}, {value: 'disabled', label: 'Unavailable', disabled: true}, {value: 'b', label: 'Beta'}] as const

test('searching and keyboard exploration do not change accepted selection or invoke actions', () => {
    const value = new Emitter<string | null>('a')
    let count = 0
    const combo = new ComboBox({label: 'Type', options, valueEmitter: value, onChange: () => count++}).attachTo(document.body)
    input().focus(); assert.equal(input().value, 'Alpha')
    search('be'); assert.equal(value.get(), 'a'); assert.equal(count, 0)
    assert.equal(document.querySelectorAll('[role="option"]').length, 1)
    assert.equal(document.querySelector('[role="option"]')?.textContent, 'Beta')
    assert.equal(document.querySelector('[role="option"]')?.tagName, 'DIV')
    assert.equal(document.activeElement, input())
    key('Escape'); assert.equal(input().value, 'Alpha'); assert.equal(value.get(), 'a')
    key('ArrowDown'); key('ArrowDown')
    assert.equal(input().getAttribute('aria-activedescendant'), document.querySelector('[role="option"][data-active]')?.id)
    assert.equal(value.get(), 'a'); key('Enter')
    assert.equal(value.get(), 'b'); assert.equal(input().value, 'Beta'); assert.equal(count, 1)
    assert.equal(combo.openEmitter.get(), false)
    combo.destroy(); assert.equal(value.subscriberCount, 0); value.dispose()
})

test('strict/custom text and empty choices have explicit commit behavior and preserve IME Enter', () => {
    const strict = new ComboBox({label: 'Strict', options, defaultValue: 'a', required: true}).attachTo(document.body)
    search('Unknown'); key('Enter')
    assert.equal(strict.valueEmitter.get(), 'a')
    key('Escape'); search(''); key('Enter')
    assert.equal(strict.valueEmitter.get(), null); assert.equal(input().checkValidity(), false)
    strict.destroy()
    const custom = new ComboBox<string>({label: 'Custom', options: [], allowCustomValue: true}).attachTo(document.body)
    search('日本'); key('Enter', true)
    assert.equal(custom.valueEmitter.get(), null)
    key('Enter'); assert.equal(custom.valueEmitter.get(), '日本')
    assert.equal(input().value, '日本'); custom.destroy()
})

test('native form values use stable option identity rather than label or uncommitted search', () => {
    const form = document.createElement('form'); document.body.append(form)
    const combo = new ComboBox<number>({label: 'Record', name: 'record', options: [{value: 0, label: 'Zero record'}], defaultValue: 0, required: true}).attachTo(form)
    assert.equal(input().checkValidity(), true)
    search('Uncommitted'); assert.equal(new FormData(form).get('record'), '0')
    key('Escape'); assert.equal(input().value, 'Zero record')
    combo.destroy()
})

test('live option errors and source replacement retain accepted labels and drop old subscriptions', () => {
    const first = new Emitter<readonly ComboBoxOption<string>[]>(options)
    const next = new Emitter<readonly ComboBoxOption<string>[]>([{value: 'a', label: 'Alpha updated'}])
    const props = {label: 'Choice', options: first, defaultValue: 'a'}
    const combo = new ComboBox(props).attachTo(document.body)
    first.setWithState([], FetchState.Loading)
    assert.equal(combo.valueEmitter.get(), 'a'); assert.equal(input().value, 'Alpha')
    assert.equal(input().getAttribute('aria-busy'), 'true')
    first.setWithState([], FetchState.Error, new Error('Options failed'))
    assert.equal(input().value, 'Alpha'); assert.equal(input().getAttribute('aria-invalid'), 'true')
    combo.setProps({...props, options: next})
    assert.equal(input().value, 'Alpha updated'); assert.equal(first.subscriberCount, 0)
    assert.equal(input().hasAttribute('aria-invalid'), false)
    combo.destroy(); assert.equal(next.subscriberCount, 0); first.dispose(); next.dispose()
})

test('late query results cannot replace newer options or the accepted state', async () => {
    const text = new Emitter('')
    const requests: Array<{search: string; finish: (options: readonly ComboBoxOption[]) => void}> = []
    const query = new LiveQuery<readonly ComboBoxOption[], {search: Emitter<string>}>({args: {search: text},
        handler: {fetch: args => new Promise(resolve => requests.push({search: args.search, finish: resolve}))},
    })
    const combo = new ComboBox({label: 'Remote', options: query, searchEmitter: text, filter: 'none', defaultValue: 'accepted'}).attachTo(document.body)
    await flush(); requests[0]!.finish([{value: 'accepted', label: 'Accepted'}]); await flush()
    search('first'); await flush(); search('second'); await flush()
    assert.deepEqual(requests.map(request => request.search), ['', 'first', 'second'])
    requests[2]!.finish([{value: 'new', label: 'Newest'}]); await flush()
    requests[1]!.finish([{value: 'old', label: 'Obsolete'}]); await flush()
    assert.equal(document.querySelector('[role="option"]')?.textContent, 'Newest')
    assert.equal(combo.valueEmitter.get(), 'accepted'); key('Escape'); assert.equal(input().value, 'Accepted')
    combo.destroy(); assert.equal(query.subscriberCount, 0)
    query.dispose(); assert.equal(text.subscriberCount, 0); text.dispose()
})

test('selection command pending/errors stay scoped and retained without rolling back the accepted value', async () => {
    let fail!: (error: Error) => void
    const command = new AsyncCommand<string | null, void>({execute: () => new Promise((_resolve, reject) => fail = reject)})
    const combo = new ComboBox({label: 'Choice', options, changeCommand: command}).attachTo(document.body)
    key('ArrowDown'); key('ArrowDown'); key('Enter'); await flush()
    assert.equal(combo.valueEmitter.get(), 'b')
    assert.equal(input().getAttribute('aria-busy'), 'true')
    assert.equal(document.querySelector('button')!.hasAttribute('aria-busy'), false)
    fail(new Error('Details failed')); await flush()
    assert.equal(input().value, 'Beta'); assert.equal(combo.valueEmitter.get(), 'b')
    assert.equal(input().getAttribute('aria-invalid'), 'true')
    combo.destroy(); assert.equal(command.subscriberCount, 0); command.dispose()
})

test('read-only/disabled choices and invalid option contracts cannot mutate state', () => {
    const combo = new ComboBox({label: 'Choice', options, defaultValue: 'a', readOnly: true}).attachTo(document.body)
    search('Beta'); key('ArrowDown'); key('Enter')
    assert.equal(input().value, 'Alpha'); assert.equal(combo.valueEmitter.get(), 'a')
    combo.destroy()
    assert.throws(() => new ComboBox({options: [{value: 'a'}, {value: 'a'}]}).attachTo(document.body), /unique/)
    assert.throws(() => new ComboBox({options: [{value: NaN}]}).attachTo(document.body), /finite/)
    assert.throws(() => new ComboBox({options: [{value: ''}]}).attachTo(document.body), /nonempty labels/)
})

test('combobox UI messages and local case folding use the configured runtime', () => {
    const runtime = createCapillaryUiRuntime({localization: {locale: 'tr', messages: {
        comboBoxEmpty: 'Seçenek yok', comboBoxRequired: 'Bir değer seçin',
    }}})
    const combo = runtime.create(ComboBox<string>, {label: 'Choice', options: [{value: 'river', label: 'IRMAK'}], required: true})
    runtime.mount(combo, document.body)
    assert.equal(input().validationMessage, 'Bir değer seçin')
    search('ı'); assert.equal(document.querySelector('[role="option"]')?.textContent, 'IRMAK')
    search('missing'); assert.equal(document.querySelector('[role="option"]')?.textContent, 'Seçenek yok')
    combo.destroy(); runtime.services.dispose()
})
