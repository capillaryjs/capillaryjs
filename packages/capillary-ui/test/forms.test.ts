import assert from 'node:assert/strict'
import {after, afterEach, before, test} from 'node:test'
import {Window} from 'happy-dom'
import {AsyncCommand, Emitter} from '@capillaryjs/capillary'
import {Button, Component, Form, FormField, FormLayout, TextArea, Textbox, h} from '../src/index.js'

let window: Window
before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {window, document: window.document, Node: window.Node,
        Element: window.Element, HTMLElement: window.HTMLElement, HTMLFormElement: window.HTMLFormElement,
        Event: window.Event, EventTarget: window.EventTarget, MouseEvent: window.MouseEvent,
        KeyboardEvent: window.KeyboardEvent, SubmitEvent: window.SubmitEvent, DocumentFragment: window.DocumentFragment})
})
afterEach(() => document.body.replaceChildren())
after(() => window.close())
const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve() }
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('button')]

test('native form validity and submitter sampling invoke one command and scope submit feedback', async () => {
    let finish!: () => void, count = 0, cancelled = 0, received = ''
    const command = new AsyncCommand<string, void>({execute: name => {
        count++; received = name; return new Promise(resolve => finish = resolve)
    }})
    const form = new Form<string>({submitCommand: command,
        submitArguments: ({submitter}) => (submitter as HTMLButtonElement | null)?.value ?? 'implicit',
        children: [h(Textbox, {label: 'Name', required: true}),
            h(Button, {type: 'submit', value: 'save', label: 'Save'}),
            h(Button, {type: 'submit', value: 'draft', label: 'Draft', formNoValidate: true}),
            h(Button, {label: 'Cancel', onClick: () => cancelled++})],
    }).attachTo(document.body)
    const native = document.querySelector('form')!
    native.requestSubmit(buttons()[0]!)
    await flush(); assert.equal(count, 0)
    native.requestSubmit(buttons()[1]!)
    await flush(); assert.equal(count, 1); assert.equal(received, 'draft')
    assert.equal(buttons()[0]!.disabled, true)
    assert.equal(buttons()[0]!.hasAttribute('aria-busy'), false)
    assert.equal(buttons()[1]!.getAttribute('aria-busy'), 'true')
    assert.equal(buttons()[1]!.hasAttribute('data-cap-busy-visible'), false)
    assert.equal(document.querySelector('input')!.disabled, false)
    buttons()[2]!.click(); assert.equal(cancelled, 1)
    native.dispatchEvent(new SubmitEvent('submit', {bubbles: true, cancelable: true, submitter: buttons()[1]!}))
    await flush(); assert.equal(count, 1)
    finish(); await flush()
    assert.equal(buttons()[1]!.hasAttribute('aria-busy'), false)
    assert.equal(buttons()[0]!.disabled, false)
    form.destroy(); assert.equal(command.subscriberCount, 0); command.dispose()
})

test('form failures remain associated with the submitter, and a subsequent invocation recovers', async () => {
    let attempt = 0
    const command = new AsyncCommand<void, void>({execute: async () => { if (++attempt === 1) throw new Error('Save refused') }})
    const form = new Form({submitCommand: command, children: h(Button, {type: 'submit', label: 'Save'})}).attachTo(document.body)
    buttons()[0]!.click(); await flush()
    const error = document.querySelector<HTMLElement>('[role="alert"]')!
    assert.equal(error.textContent, 'Save refused')
    assert.equal(buttons()[0]!.getAttribute('aria-invalid'), 'true')
    assert.equal(buttons()[0]!.getAttribute('aria-describedby'), error.id)
    assert.equal(document.querySelectorAll('[role="alert"]').length, 1)
    buttons()[0]!.click(); await flush()
    assert.equal(attempt, 2); assert.equal(document.querySelector('[role="alert"]'), null)
    assert.equal(buttons()[0]!.hasAttribute('aria-invalid'), false)
    form.destroy(); command.dispose()
})

test('argument-sampler errors are visible without starting a command or manufacturing pending work', () => {
    let count = 0, observed: unknown = null
    const command = new AsyncCommand<string, void>({execute: async () => { count++ }})
    const form = new Form<string>({submitCommand: command,
        submitArguments: () => { throw new Error('Missing context') }, onCommandInvocationError: error => observed = error,
        children: h(Button, {type: 'submit', label: 'Save'}),
    }).attachTo(document.body)
    buttons()[0]!.click()
    assert.equal(count, 0); assert.equal((observed as Error).message, 'Missing context')
    assert.equal(buttons()[0]!.hasAttribute('aria-busy'), false)
    assert.equal(buttons()[0]!.getAttribute('aria-invalid'), 'true')
    form.destroy(); command.dispose()
})

test('form repeat policy and disabled replacement do not disable unrelated Cancel', async () => {
    let count = 0
    const command = new AsyncCommand<void, void>({concurrency: 'replace', execute: () => { count++; return new Promise(() => {}) }})
    const children = [h(Button, {type: 'submit', label: 'Run'}), h(Button, {label: 'Cancel'})]
    const props = {submitCommand: command, children, disableWhileRunning: false}
    const form = new Form(props).attachTo(document.body)
    buttons()[0]!.click(); await flush(); buttons()[0]!.click(); await flush()
    assert.equal(count, 2); assert.equal(buttons()[0]!.disabled, false)
    form.setProps({...props, disabled: true})
    assert.equal(buttons()[0]!.disabled, true); assert.equal(buttons()[1]!.disabled, false)
    form.destroy(); assert.equal(command.subscriberCount, 0)
    assert.equal(command.isRunning.get(), true, 'closing a form does not cancel app-owned work')
    command.dispose()
})

test('replacing a form command drops old failures and command subscriptions', async () => {
    const failed = new AsyncCommand<void, void>({execute: async () => { throw new Error('Old operation') }})
    const next = new AsyncCommand<void, void>({execute: async () => {}})
    const children = h(Button, {type: 'submit', label: 'Save'})
    const form = new Form({submitCommand: failed, children}).attachTo(document.body)
    buttons()[0]!.click(); await flush()
    form.setProps({submitCommand: next, children})
    assert.equal(document.querySelector('[role="alert"]'), null)
    assert.equal(buttons()[0]!.hasAttribute('aria-invalid'), false)
    assert.equal(failed.subscriberCount, 0)
    form.destroy(); failed.dispose(); next.dispose()
})

test('submit feedback crosses ordinary component boundaries without a service or copied values', async () => {
    class Actions extends Component {
        render() { return h('div', null, h(Button, {type: 'submit', label: 'Save'})) }
        static dependencies = [Button]
    }
    const command = new AsyncCommand<void, void>({execute: () => new Promise(() => {})})
    const form = new Form({submitCommand: command, children: h(Actions)}).attachTo(document.body)
    buttons()[0]!.click(); await flush()
    assert.equal(buttons()[0]!.getAttribute('aria-busy'), 'true')
    form.destroy(); assert.equal(command.subscriberCount, 0); command.dispose()
})

test('field associations merge help, field validation and control-owned errors', () => {
    const props = {controlId: 'field-name', label: 'Name', help: 'Choose a unique name', error: 'Already used', required: true,
        control: (associations: {id: string; ariaDescribedBy?: string; ariaInvalid: boolean; required: boolean}) => h(Textbox, {...associations, error: new Error('Remote failure')}),
    }
    const field = new FormLayout({children: h(FormField, props)}).attachTo(document.body)
    const input = document.querySelector('input')!
    assert.equal(input.id, 'field-name'); assert.equal(input.required, true)
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    assert.equal(input.getAttribute('aria-describedby'), 'field-name-help field-name-field-error field-name-error')
    assert.equal(document.querySelector('label')!.htmlFor, input.id)
    field.destroy()
    assert.throws(() => new FormField({...props, controlId: ''}).attachTo(document.body), /controlId/)
})

test('multiline input preserves native selection, strings and committed command semantics', async () => {
    const value = new Emitter('Alpha\nβeta')
    let committed = '', count = 0
    const command = new AsyncCommand<string, void>({execute: async text => { count++; committed = text }})
    const area = new TextArea({label: 'Description', valueEmitter: value, rows: 4, changeCommand: command,
        ariaDescribedBy: 'description-help'}).attachTo(document.body)
    const input = document.querySelector('textarea')!
    assert.equal(input.value, 'Alpha\nβeta'); assert.equal(input.getAttribute('rows'), '4')
    input.focus(); input.setSelectionRange(1, 4); area.update()
    assert.equal(input.selectionStart, 1); assert.equal(input.selectionEnd, 4)
    input.value = 'Zero: 0\nFalse: false'; input.dispatchEvent(new Event('input', {bubbles: true}))
    assert.equal(value.get(), 'Zero: 0\nFalse: false'); assert.equal(count, 0)
    input.dispatchEvent(new Event('change', {bubbles: true})); await flush()
    assert.equal(committed, value.get()); assert.equal(count, 1)
    input.dispatchEvent(new Event('change', {bubbles: true})); await flush(); assert.equal(count, 1)
    assert.equal(input.getAttribute('aria-describedby'), 'description-help')
    area.destroy(); assert.equal(value.subscriberCount, 0); assert.equal(command.subscriberCount, 0)
    value.dispose(); command.dispose()
})

test('multiline read-only, invalid options and handler contracts are explicit', () => {
    const value = new Emitter('Retained')
    const area = new TextArea({valueEmitter: value, readOnly: true}).attachTo(document.body)
    const input = document.querySelector('textarea')!
    input.value = 'Changed'; input.dispatchEvent(new Event('input', {bubbles: true}))
    assert.equal(input.value, 'Retained'); assert.equal(value.get(), 'Retained')
    area.destroy(); value.dispose()
    assert.throws(() => new TextArea({rows: 0}).attachTo(document.body), /positive integers/)
    assert.throws(() => new Form({submitCommand: null as never}), /requires submitCommand/)
})
