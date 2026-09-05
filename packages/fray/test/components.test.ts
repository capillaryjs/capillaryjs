import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    Checkbox,
    ColorPicker,
    Component,
    DescriptionItem,
    DescriptionList,
    Dropdown,
    FilterMode,
    Panel,
    ProgressBar,
    QuadCheckbox,
    RadioButton,
    RadioGroup,
    Sidebar,
    SplitView,
    Tab,
    TabPanel,
    Textbox,
    ThemePicker,
    Toggle,
    Toolbar,
    TriCheckbox,
    createFrayRuntime,
    h,
    live,
} from '../src/index.js'
import type {RadioOption} from '../src/index.js'
import {requiredAt, requiredQuery} from './testUtils.js'

let window: Window

before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {
        window,
        document: window.document,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        EventTarget: window.EventTarget,
        Event: window.Event,
        MouseEvent: window.MouseEvent,
        KeyboardEvent: window.KeyboardEvent,
        DocumentFragment: window.DocumentFragment,
    })
})

afterEach(() => {
    document.body.replaceChildren()
    document.head.replaceChildren()
})

after(() => window.close())

describe('action and text controls', () => {
    test('Button is a native, disableable action', () => {
        let calls = 0
        const button = Button.new({label: 'Save', onClick: () => calls += 1})
            .attachTo(document.body)
        const element = requiredQuery<HTMLButtonElement>('button')

        assert.equal(element.type, 'button')
        assert.equal(element.dataset.frayComponent, 'button')
        assert.equal(element.hasAttribute('data-fray'), true)
        assert.equal(element.hasAttribute('class'), false)
        assert.equal(element.textContent, 'Save')
        element.click()
        assert.equal(calls, 1)

        button.setProps({label: 'Save', disabled: true, onClick: () => calls += 1})
        assert.equal(element.disabled, true)
        element.click()
        assert.equal(calls, 1)
    })

    test('Button busy state preserves its native node and blocks activation', () => {
        let calls = 0
        const button = Button.new({
            label: 'Refresh',
            busy: true,
            busyLabel: 'Refreshing…',
            onClick: () => calls += 1,
        }).attachTo(document.body)
        const element = requiredQuery<HTMLButtonElement>('button')
        assert.equal(element.disabled, true)
        assert.equal(element.getAttribute('aria-busy'), 'true')
        assert.equal(element.textContent, 'Refreshing…')
        element.click()
        assert.equal(calls, 0)

        button.setProps({label: 'Refresh', onClick: () => calls += 1})
        assert.equal(requiredQuery('button'), element)
        assert.equal(element.disabled, false)
        assert.equal(element.hasAttribute('aria-busy'), false)
        element.click()
        assert.equal(calls, 1)
    })

    test('Toolbar supplies role, name, orientation, and children', () => {
        Toolbar.new({
            label: 'Document actions',
            orientation: 'vertical',
            children: [h(Button, {label: 'Save'})],
        }).attachTo(document.body)

        const toolbar = requiredQuery<HTMLElement>('[role="toolbar"]')
        assert.equal(toolbar.localName, 'fray-toolbar')
        assert.equal(toolbar.className, 'toolbarlike')
        assert.equal(toolbar.getAttribute('aria-label'), 'Document actions')
        assert.equal(toolbar.getAttribute('aria-orientation'), 'vertical')
        assert.equal(requiredQuery('button', toolbar).textContent, 'Save')
    })

    test('Textbox supports internal state, callbacks, labels, and errors', () => {
        const changes: string[] = []
        const textbox = Textbox.new({
            label: 'Name',
            defaultValue: 'Ada',
            required: true,
            error: 'Use a full name',
            onInput: (value) => changes.push(value),
        }).attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')
        const label = requiredQuery<HTMLLabelElement>('label')

        assert.equal(input.parentElement?.localName, 'fray-textbox')
        assert.equal(label.htmlFor, input.id)
        assert.equal(input.value, 'Ada')
        assert.equal(input.required, true)
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.equal(
            input.getAttribute('aria-describedby'),
            requiredQuery<HTMLElement>('[role="alert"]').id,
        )

        input.value = 'Ada Lovelace'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        assert.equal(textbox.valueEmitter.get(), 'Ada Lovelace')
        assert.deepEqual(changes, ['Ada Lovelace'])
    })

    test('Textbox follows an external emitter and releases it on destroy', () => {
        const valueEmitter = new Emitter('first')
        const textbox = Textbox.new({label: 'Value', valueEmitter})
            .attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')

        valueEmitter.set('second')
        assert.equal(input.value, 'second')
        assert.equal(valueEmitter.subscriberCount, 1)
        textbox.destroy()
        assert.equal(valueEmitter.subscriberCount, 0)
    })
})

describe('choice controls', () => {
    test('theme and color pickers update independent stylesheet links', () => {
        const theme = new Emitter('minimal')
        const colors = new Emitter('iceblue')
        ThemePicker.new({label: 'Theme', valueEmitter: theme}).attachTo(document.body)
        ColorPicker.new({label: 'Colors', valueEmitter: colors}).attachTo(document.body)

        assert.equal(document.querySelectorAll('select').length, 2)
        assert.ok([...document.querySelectorAll('fray-themepicker, fray-colorpicker')]
            .every((picker) => picker.classList.contains('selectshell')))
        assert.equal(document.documentElement.dataset.theme, 'minimal')
        assert.equal(document.documentElement.dataset.color, 'iceblue')
        assert.equal(document.head.querySelectorAll('link[data-fray-stylesheet]').length, 2)

        theme.set('shiny')
        colors.set('purple')
        assert.equal(document.documentElement.dataset.theme, 'shiny')
        assert.equal(document.documentElement.dataset.color, 'purple')
        assert.equal(
            document.head.querySelector<HTMLLinkElement>(
                'link[data-fray-stylesheet="theme"]',
            )?.dataset.fraySelection,
            'shiny',
        )
    })

    test('Dropdown tracks options, typed values, and external updates', () => {
        const options = new Emitter([
            {value: 1, label: 'One'},
            {value: 2, label: 'Two'},
        ])
        const value = new Emitter(1)
        const changes: number[] = []
        Dropdown.new({
            label: 'Number',
            options,
            valueEmitter: value,
            onChange: (next) => {
                if (typeof next !== 'number') throw new TypeError('Expected a numeric option')
                changes.push(next)
            },
        }).attachTo(document.body)
        const select = requiredQuery<HTMLSelectElement>('select')

        assert.equal(select.parentElement?.localName, 'fray-dropdown')
        assert.ok(select.parentElement?.classList.contains('selectshell'))
        assert.equal(select.value, '1')
        select.value = '2'
        select.dispatchEvent(new Event('change', {bubbles: true}))
        assert.equal(value.get(), 2)
        assert.deepEqual(changes, [2])

        options.set([{value: 2, label: 'Second'}])
        assert.equal(select.options.length, 1)
        assert.equal(requiredAt(select.options, 0).textContent, 'Second')
    })

    test('Toggle is a keyboard-operable radio group', () => {
        const value = new Emitter('a')
        const toggle = Toggle.new({
            label: 'Mode',
            options: [['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma']],
            valueEmitter: value,
        }).attachTo(document.body)
        const radios = [...document.querySelectorAll<HTMLElement>('[role="radio"]')]

        assert.equal(requiredQuery('fieldset').dataset.frayComponent, 'toggle')
        assert.equal(document.querySelector('[role="radiogroup"]') != null, true)
        assert.deepEqual(radios.map((node) => node.getAttribute('aria-checked')),
            ['true', 'false', 'false'])
        requiredAt(radios, 0).focus()
        requiredAt(radios, 0).dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
        }))
        assert.equal(value.get(), 'b')
        assert.equal(document.activeElement, requiredAt(radios, 1))
        assert.equal(requiredAt(radios, 1).getAttribute('aria-checked'), 'true')
        toggle.destroy()
    })

    test('RadioGroup renders native grouped radio inputs', () => {
        const value = new Emitter('list')
        const group = RadioGroup.new({
            label: 'View',
            options: [['list', 'List'], ['grid', 'Grid']],
            valueEmitter: value,
        }).attachTo(document.body)
        const radios = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')]

        assert.equal(requiredQuery('fray-radiogroup').dataset.frayComponent, 'radio-group')
        assert.equal(radios.length, 2)
        assert.equal(radios[0]?.checked, true)
        assert.equal(radios[0]?.name, radios[1]?.name)
        assert.equal(requiredQuery('fray-radiobutton').localName, 'fray-radiobutton')

        requiredAt(radios, 1).checked = true
        requiredAt(radios, 1).dispatchEvent(new Event('change', {bubbles: true}))
        assert.equal(value.get(), 'grid')
        assert.equal(requiredAt(radios, 1).checked, true)
        group.destroy()
    })

    test('RadioGroup binds only its declared live boolean props', () => {
        const disabled = new Emitter(false)
        const required = new Emitter(false)
        const error = new Emitter<unknown>(null)
        let parentRenders = 0

        class RadioOwner extends Component {
            render() {
                parentRenders += 1
                return h(RadioGroup, {
                    label: 'View',
                    options: [['list', 'List'], ['grid', 'Grid']],
                    disabled: live(disabled),
                    required: live(required),
                    error: live(error),
                })
            }
        }

        const owner = RadioOwner.new().attachTo(document.body)
        const host = requiredQuery<HTMLElement>('fray-radiogroup')
        const fieldset = requiredQuery<HTMLFieldSetElement>('fieldset')
        const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')]

        assert.equal(parentRenders, 1)
        assert.equal(host.hasAttribute('data-disabled'), false)
        assert.equal(host.hasAttribute('data-required'), false)
        assert.equal(fieldset.disabled, false)
        assert.equal(fieldset.getAttribute('aria-required'), null)

        disabled.set(true)
        required.set(true)
        error.set('Choose a view')

        assert.equal(parentRenders, 1)
        assert.equal(host.hasAttribute('data-disabled'), true)
        assert.equal(host.hasAttribute('data-required'), true)
        assert.equal(fieldset.disabled, true)
        assert.equal(fieldset.getAttribute('aria-required'), 'true')
        assert.equal(fieldset.getAttribute('aria-invalid'), 'true')
        const alert = requiredQuery<HTMLElement>('[role="alert"]')
        assert.equal(fieldset.getAttribute('aria-describedby'), alert.id)
        assert.match(alert.textContent ?? '', /Choose a view/)
        assert.ok(inputs.every((input) => input.disabled && input.required))

        owner.destroy()
        assert.equal(disabled.subscriberCount, 0)
        assert.equal(required.subscriberCount, 0)
        assert.equal(error.subscriberCount, 0)
    })

    test('RadioGroup rejects a live options binding at runtime', () => {
        const options = new Emitter([
            ['list', 'List'],
            ['grid', 'Grid'],
        ] as const)

        class InvalidRadioOwner extends Component {
            render() {
                return h(RadioGroup, {
                    options: live(options),
                } as never)
            }
        }

        const owner = new InvalidRadioOwner()
        assert.throws(
            () => owner.mount(),
            /RadioGroup prop "options" does not support live\(\)/,
        )
        owner.destroy()
        assert.equal(options.subscriberCount, 0)
    })

    test('an owner can explicitly rerender RadioGroup with changing options', () => {
        const options = new Emitter<readonly RadioOption[]>([
            ['list', 'List'],
            ['grid', 'Grid'],
        ])
        let ownerRenders = 0

        class RadioOwner extends Component {
            render() {
                ownerRenders += 1
                return h(RadioGroup, {
                    label: 'View',
                    options: this.read(options),
                })
            }
        }

        const owner = RadioOwner.new().attachTo(document.body)
        assert.equal(ownerRenders, 1)
        assert.deepEqual(
            [...document.querySelectorAll('fray-radiobutton')]
                .map(({textContent}) => textContent),
            ['List', 'Grid'],
        )

        options.set([['cards', 'Cards']])

        assert.equal(ownerRenders, 2)
        assert.deepEqual(
            [...document.querySelectorAll('fray-radiobutton')]
                .map(({textContent}) => textContent),
            ['Cards'],
        )

        owner.destroy()
        assert.equal(options.subscriberCount, 0)
    })

    test('RadioButton exposes a native standalone input', () => {
        const radio = RadioButton.new({label: 'Enabled', name: 'setting', value: 'enabled'})
            .attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input[type="radio"]')

        assert.equal(input.name, 'setting')
        assert.equal(input.value, 'enabled')
        assert.equal(input.parentElement?.parentElement?.localName, 'fray-radiobutton')
        radio.destroy()
    })

    test('Checkbox variants expose semantic state and keyboard cycling', () => {
        const basic = Checkbox.new({label: 'Basic'}).attachTo(document.body)
        const control = requiredQuery<HTMLInputElement>('input[type="checkbox"]')
        assert.equal(requiredQuery('fray-checkbox').dataset.frayComponent, 'check-box')
        assert.equal(control.closest('fray-checkbox'), requiredQuery('fray-checkbox'))
        assert.equal(control.nextElementSibling?.className, 'checkboxshell')
        assert.equal(control.nextElementSibling?.textContent, '☐')
        assert.equal(basic.valueEmitter.get(), FilterMode.Neutral)
        control.dispatchEvent(new Event('change', {bubbles: true}))
        assert.equal(basic.valueEmitter.get(), FilterMode.Prefer)
        assert.equal(control.checked, true)
        assert.equal(control.nextElementSibling?.textContent, '✓')
        assert.match((control.closest('fray-checkbox') as HTMLElement | null)?.dataset.state ?? '',
            /prefer/)

        assert.equal(control.closest('label')?.lastElementChild?.textContent, 'Basic')

        basic.destroy()
        document.body.replaceChildren()
        const tri = TriCheckbox.new({label: 'Tri'}).attachTo(document.body)
        assert.equal(requiredQuery('fray-tricheckbox').dataset.frayComponent, 'tri-checkbox')
        assert.equal(tri.valueEmitter.get(), FilterMode.Neutral)
        requiredQuery<HTMLInputElement>('input[type="checkbox"]').dispatchEvent(
            new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}),
        )
        assert.equal(tri.valueEmitter.get(), FilterMode.Deny)

        tri.destroy()
        document.body.replaceChildren()
        const quad = QuadCheckbox.new({label: 'Quad'}).attachTo(document.body)
        assert.equal(requiredQuery('fray-quadcheckbox').dataset.frayComponent, 'quad-checkbox')
        const quadControl = requiredQuery<HTMLInputElement>('input[type="checkbox"]')
        quadControl.dispatchEvent(new Event('change', {bubbles: true}))
        quadControl.dispatchEvent(new Event('change', {bubbles: true}))
        assert.equal(quad.valueEmitter.get(), FilterMode.Require)
    })
})

describe('layout controls', () => {
    test('DescriptionList renders native term/value semantics', () => {
        DescriptionList.new({
            label: 'Record details',
            children: [
                h(DescriptionItem, {term: 'Severity', value: 'High'}),
                h(DescriptionItem, {term: 'Owner'}, 'Example team'),
            ],
        }).attachTo(document.body)

        const list = requiredQuery<HTMLDListElement>('dl[data-fray-component="description-list"]')
        assert.ok(list.classList.contains('datacomponentlike'))
        assert.equal(list.getAttribute('aria-label'), 'Record details')
        assert.deepEqual([...list.querySelectorAll('dt')].map(({textContent}) => textContent), [
            'Severity',
            'Owner',
        ])
        assert.deepEqual([...list.querySelectorAll('dd')].map(({textContent}) => textContent), [
            'High',
            'Example team',
        ])
    })

    test('SplitView owns two labelled panes and validates direction', () => {
        SplitView.new({
            direction: 'horizontal',
            primarySize: '18rem',
            primaryLabel: 'Project navigation',
            secondaryLabel: 'Project details',
            primary: h('p', null, 'Tree'),
            secondary: h('p', null, 'Details'),
        }).attachTo(document.body)

        const split = requiredQuery<HTMLElement>('fray-splitview')
        assert.equal(split.dataset.direction, 'horizontal')
        assert.equal(split.style.getPropertyValue('--split-primary-size'), '18rem')
        assert.equal(requiredQuery('[data-part="primary"]', split).textContent, 'Tree')
        assert.equal(
            requiredQuery('[data-part="secondary"]', split).getAttribute('aria-label'),
            'Project details',
        )
        assert.throws(() => SplitView.new({direction: 'diagonal' as 'horizontal'}).mount(),
            /direction/)
    })

    test('ProgressBar tracks an emitter in determinate and indeterminate modes', () => {
        const value = new Emitter<number | null>(null)
        const progressBar = ProgressBar.new({
            label: 'Project refresh',
            valueEmitter: value,
            max: 4,
        }).attachTo(document.body)
        const progress = requiredQuery<HTMLProgressElement>('progress')
        assert.equal(progress.hasAttribute('value'), false)
        assert.equal(progress.getAttribute('aria-valuetext'), 'In progress')

        value.set(2)
        assert.equal(progress.value, 2)
        assert.equal(progress.getAttribute('aria-valuetext'), '50%')
        assert.equal(requiredQuery('output').textContent, '50%')
        progressBar.destroy()
        assert.equal(value.subscriberCount, 0)
    })

    test('Panel uses a labelled component host and explicit orientation', () => {
        Panel.new({
            header: 'Profile',
            orientation: 'horizontal',
            children: [h('p', null, 'Details')],
        }).attachTo(document.body)

        const section = requiredQuery<HTMLElement>('fray-panel')
        const title = requiredQuery<HTMLElement>('h2')
        assert.equal(section.getAttribute('role'), 'region')
        assert.equal(section.className, 'panellike')
        assert.equal(section.getAttribute('aria-labelledby'), title.id)
        assert.equal(section.dataset.orientation, 'horizontal')
        assert.equal(requiredQuery('[data-part="content"]', section).textContent, 'Details')
    })

    test('Sidebar labels a native aside and separates fixed controls from content', () => {
        Sidebar.new({
            id: 'change-requests',
            header: 'Change requests',
            ariaLabel: 'Ignored fallback',
            toolbar: h(Toolbar, {label: 'Request filters'}, h(Button, {label: 'Refresh'})),
            children: [h('ol', null, h('li', null, 'First request'))],
        }).attachTo(document.body)

        const sidebar = requiredQuery<HTMLElement>('aside[data-fray-component="sidebar"]')
        const heading = requiredQuery<HTMLElement>('h2', sidebar)
        const toolbar = requiredQuery<HTMLElement>('[data-part="toolbar"]', sidebar)
        const content = requiredQuery<HTMLElement>('[data-part="content"]', sidebar)
        assert.equal(sidebar.id, 'change-requests')
        assert.equal(sidebar.getAttribute('aria-labelledby'), heading.id)
        assert.equal(sidebar.hasAttribute('aria-label'), false)
        assert.equal(requiredQuery('[role="toolbar"]', toolbar).textContent, 'Refresh')
        assert.equal(content.textContent, 'First request')
        assert.equal(content.tabIndex, 0)
        assert.equal(sidebar.children[0], heading.parentElement)
        assert.equal(sidebar.children[1], toolbar)
        assert.equal(sidebar.children[2], content)
    })

    test('Sidebar uses ariaLabel when no visible header exists', () => {
        Sidebar.new({
            ariaLabel: 'Saved views',
            children: 'No saved views',
        }).attachTo(document.body)

        const sidebar = requiredQuery<HTMLElement>('aside[data-fray-component="sidebar"]')
        assert.equal(sidebar.getAttribute('aria-label'), 'Saved views')
        assert.equal(sidebar.hasAttribute('aria-labelledby'), false)
        assert.equal(sidebar.querySelector('[data-part="header"]'), null)
    })

    test('TabPanel wires tab semantics, content, clicks, and arrow keys', () => {
        const active = new Emitter('first')
        TabPanel.new({
            id: 'settings',
            label: 'Settings sections',
            valueEmitter: active,
            children: [
                h(Tab, {id: 'first', label: 'First'}, h('p', null, 'First content')),
                h(Tab, {id: 'second', label: 'Second'}, h('p', null, 'Second content')),
            ],
        }).attachTo(document.body)

        const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
        assert.equal(requiredQuery('fray-tabpanel').dataset.frayComponent, 'tab-panel')
        assert.equal(requiredQuery('fray-tabline').dataset.frayComponent, 'tab-line')
        let panel = requiredQuery<HTMLElement>('[role="tabpanel"]')
        assert.equal(requiredAt(tabs, 0).getAttribute('aria-selected'), 'true')
        assert.equal(requiredAt(tabs, 0).getAttribute('aria-controls'), panel.id)
        assert.equal(panel.getAttribute('aria-labelledby'), requiredAt(tabs, 0).id)
        assert.equal(panel.textContent, 'First content')

        requiredAt(tabs, 1).click()
        panel = requiredQuery<HTMLElement>('[role="tabpanel"]')
        assert.equal(active.get(), 'second')
        assert.equal(requiredAt(tabs, 1).getAttribute('aria-selected'), 'true')
        assert.equal(panel.textContent, 'Second content')

        requiredAt(tabs, 1).focus()
        requiredAt(tabs, 1).dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            bubbles: true,
        }))
        assert.equal(active.get(), 'first')
        assert.equal(document.activeElement, requiredAt(tabs, 0))
    })

    test('nested components use fixed Fray host names', () => {
        const runtime = createFrayRuntime()
        const panel = runtime.create(Panel, {
            children: [h(Textbox, {label: 'Name'})],
        })
        runtime.mount(panel, document.body)
        assert.ok(document.querySelector('fray-panel'))
        assert.ok(document.querySelector('fray-textbox'))
        assert.ok(document.querySelector('fray-panel[data-fray]'))
        panel.destroy()
    })
})
