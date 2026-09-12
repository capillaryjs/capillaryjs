import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter, FetchState} from '@sylwellsoftware/glue'
import {
    Breadcrumb,
    Button,
    Checkbox,
    ColorPicker,
    Component,
    DeclarativeRegion,
    DescriptionItem,
    DescriptionList,
    Dropdown,
    InfoField,
    InfoPanel,
    FilterMode,
    GroupPanel,
    Header,
    Label,
    Layout,
    OptionGroup,
    OptionGroupHeaderEnd,
    Panel,
    PanelToolbar,
    Placeholder,
    ProgressBar,
    QuadCheckbox,
    RadioButton,
    RadioGroup,
    Sidebar,
    SidebarToolbar,
    SplitPrimary,
    SplitSecondary,
    SplitView,
    Tab,
    TabLine,
    TabPanel,
    Textbox,
    ThemePicker,
    Toggle,
    Toolbar,
    TriCheckbox,
    createFrayRuntime,
    h,
    live,
    readDeclarativeRegions,
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
    test('Label keeps native association while supporting live and rich content', () => {
        const text = new Emitter('Search the change register')
        class LabelOwner extends Component {
            render() {
                return h(Label, {htmlFor: 'register-search', text: live(text)})
            }
        }
        LabelOwner.new().attachTo(document.body)
        const label = requiredQuery<HTMLLabelElement>('label')

        assert.equal(label.htmlFor, 'register-search')
        assert.equal(label.textContent, 'Search the change register')
        assert.equal(label.dataset.frayComponent, 'label')

        text.set('Search active Meridian changes')
        assert.equal(label.textContent, 'Search active Meridian changes')

        Label.new({
            htmlFor: 'register-search',
            children: h('strong', null, 'A deliberately long native-label description'),
        }).attachTo(document.body)
        assert.equal(requiredAt(document.querySelectorAll<HTMLLabelElement>('label'), 1).innerHTML,
            '<strong data-fray="">A deliberately long native-label description</strong>')
    })

    test('Button uses a fixed host around its native, disableable action', () => {
        let calls = 0
        const button = Button.new({label: 'Save', onClick: () => calls += 1})
            .attachTo(document.body)
        const host = requiredQuery<HTMLElement>('fray-button')
        const element = requiredQuery<HTMLButtonElement>('button', host)

        assert.equal(element.type, 'button')
        assert.equal(host.dataset.frayComponent, 'button')
        assert.equal(host.hasAttribute('data-fray'), true)
        assert.equal(host.hasAttribute('class'), false)
        assert.equal(element.hasAttribute('data-fray-component'), false)
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
        const host = requiredQuery<HTMLElement>('fray-button')
        const element = requiredQuery<HTMLButtonElement>('button', host)
        assert.equal(element.disabled, true)
        assert.equal(element.getAttribute('aria-busy'), 'true')
        assert.equal(element.textContent, 'Refreshing…')
        element.click()
        assert.equal(calls, 0)

        button.setProps({label: 'Refresh', onClick: () => calls += 1})
        assert.equal(requiredQuery('button', host), element)
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
        assert.equal(toolbar.className, '')
        assert.equal(toolbar.getAttribute('aria-label'), 'Document actions')
        assert.equal(toolbar.getAttribute('aria-orientation'), 'vertical')
        assert.equal(toolbar.hasAttribute('data-orientation'), false)
        assert.equal(toolbar.querySelector('div'), null)
        assert.equal(requiredQuery('button', toolbar).textContent, 'Save')
    })

    test('Textbox supports internal state, callbacks, labels, and errors', () => {
        const inputs: string[] = []
        const changes: string[] = []
        const textbox = Textbox.new({
            label: 'Name',
            defaultValue: 'Ada',
            required: true,
            error: 'Use a full name',
            onInput: (value) => inputs.push(value),
            onChange: (value) => changes.push(value),
        }).attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')
        const label = requiredQuery<HTMLLabelElement>('label')

        assert.equal(input.parentElement?.localName, 'fray-textbox')
        assert.equal(input.parentElement?.hasAttribute('data-disabled'), false)
        assert.equal(input.parentElement?.hasAttribute('data-required'), false)
        assert.equal(input.parentElement?.hasAttribute('data-error'), false)
        assert.equal(label.htmlFor, input.id)
        assert.equal(input.value, 'Ada')
        assert.equal(input.required, true)
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.equal(input.parentElement?.hasAttribute('data-error'), false)
        assert.equal(
            input.getAttribute('aria-describedby'),
            requiredQuery<HTMLElement>('[role="alert"]').id,
        )

        input.value = 'Ada Lovelace'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        assert.equal(textbox.valueEmitter.get(), 'Ada Lovelace')
        assert.deepEqual(inputs, ['Ada Lovelace'])
        assert.deepEqual(changes, [])

        input.dispatchEvent(new Event('change', {bubbles: true}))
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

    test('Textbox forwards native input modes and live availability', () => {
        const value = new Emitter('CR-104')
        const disabled = new Emitter(false)
        const required = new Emitter(false)
        const readOnly = new Emitter(false)
        const error = new Emitter<string | null>(null)
        class TextboxOwner extends Component {
            render() {
                return h(Textbox, {
                    label: 'Search changes',
                    valueEmitter: value,
                    type: 'search',
                    placeholder: 'Search by title or change ID',
                    minLength: 2,
                    maxLength: 80,
                    pattern: '[A-Za-z0-9 -]*',
                    autoComplete: 'off',
                    inputMode: 'search',
                    disabled: live(disabled),
                    required: live(required),
                    readOnly: live(readOnly),
                    error: live(error),
                })
            }
        }
        TextboxOwner.new().attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')

        assert.equal(input.type, 'search')
        assert.equal(input.placeholder, 'Search by title or change ID')
        assert.equal(input.getAttribute('minlength'), '2')
        assert.equal(input.getAttribute('maxlength'), '80')
        assert.equal(input.pattern, '[A-Za-z0-9 -]*')
        assert.equal(input.getAttribute('autocomplete'), 'off')
        assert.equal(input.getAttribute('inputmode'), 'search')
        value.set('A deliberately very long external Meridian search value')
        assert.equal(input.value, 'A deliberately very long external Meridian search value')
        value.setWithState(value.get(), FetchState.Loading)
        assert.equal(input.value, 'A deliberately very long external Meridian search value')
        assert.equal(input.parentElement?.hasAttribute('data-loading'), false)

        disabled.set(true)
        required.set(true)
        readOnly.set(true)
        error.set('Search is temporarily unavailable')
        assert.equal(input.disabled, true)
        assert.equal(input.required, true)
        assert.equal(input.readOnly, true)
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.equal(requiredQuery<HTMLElement>('[role="alert"]').textContent,
            'Search is temporarily unavailable')
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
            .every((picker) => picker.querySelector(':scope > fray-selectshell > select') != null))
        assert.ok([...document.querySelectorAll('fray-themepicker, fray-colorpicker')]
            .every((picker) => !picker.hasAttribute('data-kind') && !picker.hasAttribute('data-disabled')))
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

        assert.equal(select.parentElement?.localName, 'fray-selectshell')
        assert.equal(select.parentElement?.parentElement?.localName, 'fray-dropdown')
        assert.equal(select.parentElement?.parentElement?.hasAttribute('data-disabled'), false)
        assert.equal(select.parentElement?.parentElement?.hasAttribute('data-required'), false)
        assert.equal(select.parentElement?.parentElement?.hasAttribute('data-error'), false)
        assert.equal(select.value, '1')
        select.value = '2'
        select.dispatchEvent(new Event('change', {bubbles: true}))
        assert.equal(value.get(), 2)
        assert.deepEqual(changes, [2])

        options.set([{value: 2, label: 'Second'}])
        assert.equal(select.options.length, 1)
        assert.equal(requiredAt(select.options, 0).textContent, 'Second')
    })

    test('Dropdown uses its native select for live availability and validation', () => {
        const value = new Emitter('all')
        const disabled = new Emitter(false)
        const required = new Emitter(false)
        const error = new Emitter<string | null>(null)
        class DropdownOwner extends Component {
            render() {
                return h(Dropdown, {
                    label: 'Risk focus',
                    valueEmitter: value,
                    options: [
                        {value: 'all', label: 'All risks'},
                        {value: 'Critical', label: 'Critical'},
                    ],
                    disabled: live(disabled),
                    required: live(required),
                    error: live(error),
                })
            }
        }
        DropdownOwner.new().attachTo(document.body)
        const host = requiredQuery<HTMLElement>('fray-dropdown')
        const select = requiredQuery<HTMLSelectElement>('select', host)

        assert.equal(host.querySelector('div, .selectshell'), null)
        assert.equal(host.hasAttribute('data-disabled'), false)
        assert.equal(host.hasAttribute('data-required'), false)
        assert.equal(host.hasAttribute('data-error'), false)
        assert.equal(select.disabled, false)
        assert.equal(select.required, false)

        disabled.set(true)
        required.set(true)
        error.set('Choose a permitted risk focus')
        value.set('Critical')

        assert.equal(select.disabled, true)
        assert.equal(select.required, true)
        assert.equal(select.value, 'Critical')
        assert.equal(select.getAttribute('aria-invalid'), 'true')
        const alert = requiredQuery<HTMLElement>('[role="alert"]', host)
        assert.equal(select.getAttribute('aria-describedby'), alert.id)
        assert.equal(alert.textContent, 'Choose a permitted risk focus')
    })

    test('Toggle is a keyboard-operable radio group', () => {
        const value = new Emitter('a')
        const toggle = Toggle.new({
            label: 'Mode',
            options: [['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma']],
            valueEmitter: value,
        }).attachTo(document.body)
        const radios = [...document.querySelectorAll<HTMLElement>('[role="radio"]')]

        const host = requiredQuery<HTMLElement>('fray-toggle')
        const label = requiredQuery<HTMLElement>('fray-label', host)
        const radiogroup = requiredQuery<HTMLElement>('fray-options[role="radiogroup"]', host)
        assert.equal(host.dataset.frayComponent, 'toggle')
        assert.equal(host.id.startsWith('fray-toggle-'), true)
        assert.equal(label.textContent, 'Mode')
        assert.equal(radiogroup.getAttribute('aria-labelledby'), label.id)
        assert.equal(host.querySelector('fieldset, div'), null)
        assert.equal(host.querySelector('[data-part]'), null)
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
        value.set('c')
        assert.equal(requiredAt(radios, 2).getAttribute('aria-checked'), 'true')
        toggle.setProps({
            label: 'Mode',
            options: [['d', 'Delta'], ['e', 'Epsilon']],
            valueEmitter: value,
        })
        const replacedRadios = [...document.querySelectorAll<HTMLElement>('[role="radio"]')]
        assert.equal(value.get(), 'd')
        assert.deepEqual(replacedRadios.map((node) => node.getAttribute('aria-checked')),
            ['true', 'false'])
        toggle.destroy()
    })

    test('Toggle follows live availability and validation state through native semantics', () => {
        const disabled = new Emitter(false)
        const required = new Emitter(false)
        const error = new Emitter<unknown>(null)
        class ToggleOwner extends Component {
            render() {
                return h(Toggle, {
                    label: 'Status focus',
                    options: [['all', 'All'], ['active', 'Active']],
                    disabled: live(disabled),
                    required: live(required),
                    error: live(error),
                })
            }
        }
        ToggleOwner.new().attachTo(document.body)

        const host = requiredQuery<HTMLElement>('fray-toggle')
        const radiogroup = requiredQuery<HTMLElement>('fray-options[role="radiogroup"]', host)
        const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
        assert.equal(host.hasAttribute('data-disabled'), false)
        assert.equal(host.hasAttribute('data-error'), false)
        assert.equal(radiogroup.getAttribute('aria-required'), null)

        disabled.set(true)
        required.set(true)
        error.set('Choose a status')
        assert.equal(radiogroup.getAttribute('aria-required'), 'true')
        assert.equal(radiogroup.getAttribute('aria-invalid'), 'true')
        assert.equal(radios.every((radio) => radio.disabled), true)
        assert.equal(requiredQuery<HTMLElement>('fray-error[role="alert"]', host).textContent,
            'Choose a status')
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
        const fieldset = requiredQuery<HTMLFieldSetElement>('fieldset')
        assert.equal(requiredQuery('legend', fieldset).textContent, 'View')
        assert.equal(fieldset.querySelector(':scope > div, [role="radiogroup"], [data-part]'), null)
        assert.equal(requiredQuery('fray-radiobutton', fieldset).localName, 'fray-radiobutton')

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
        assert.equal(host.hasAttribute('data-error'), false)
        assert.equal(fieldset.disabled, false)
        assert.equal(fieldset.getAttribute('aria-required'), null)

        disabled.set(true)
        required.set(true)
        error.set('Choose a view')

        assert.equal(parentRenders, 1)
        assert.equal(host.hasAttribute('data-disabled'), false)
        assert.equal(host.hasAttribute('data-required'), false)
        assert.equal(host.hasAttribute('data-error'), false)
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
        assert.equal(requiredQuery<HTMLInputElement>('input[type="radio"]').checked, true)

        owner.destroy()
        assert.equal(options.subscriberCount, 0)
    })

    test('RadioButton exposes a native standalone input', () => {
        const radio = RadioButton.new({label: 'Enabled', name: 'setting', value: 'enabled'})
            .attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input[type="radio"]')
        const host = requiredQuery<HTMLElement>('fray-radiobutton')

        assert.equal(input.name, 'setting')
        assert.equal(input.value, 'enabled')
        assert.equal(input.parentElement?.parentElement?.localName, 'fray-radiobutton')
        assert.equal(input.nextElementSibling?.localName, 'fray-checkshell')
        assert.equal(host.querySelector('div, span, [data-disabled], [data-required], [data-error]'), null)
        radio.destroy()
    })

    test('Checkbox variants expose semantic state and keyboard cycling', () => {
        const basic = Checkbox.new({label: 'Basic'}).attachTo(document.body)
        const control = requiredQuery<HTMLInputElement>('input[type="checkbox"]')
        const host = requiredQuery<HTMLElement>('fray-checkbox')
        assert.equal(host.dataset.frayComponent, 'check-box')
        assert.equal(control.closest('fray-checkbox'), host)
        assert.equal(control.nextElementSibling?.localName, 'fray-checkshell')
        assert.equal(control.nextElementSibling?.textContent, '')
        assert.equal(host.querySelector('div, span, [data-state]'), null)
        assert.equal(host.hasAttribute('data-disabled'), false)
        assert.equal(host.hasAttribute('data-required'), false)
        assert.equal(host.hasAttribute('data-error'), false)
        assert.equal(host.dataset.state, 'neutral')
        assert.equal(basic.valueEmitter.get(), FilterMode.Neutral)
        control.dispatchEvent(new Event('change', {bubbles: true}))
        assert.equal(basic.valueEmitter.get(), FilterMode.Prefer)
        assert.equal(control.checked, true)
        assert.equal(control.nextElementSibling?.textContent, '✓')
        assert.equal(host.dataset.state, 'prefer')
        assert.equal(control.getAttribute('aria-label'), 'Basic: prefer')
        assert.match(control.closest('label')?.textContent ?? '', /Basic/)

        basic.destroy()
        document.body.replaceChildren()
        const tri = TriCheckbox.new({label: 'Tri'}).attachTo(document.body)
        assert.equal(requiredQuery('fray-tricheckbox').dataset.frayComponent, 'tricheckbox')
        assert.equal(tri.valueEmitter.get(), FilterMode.Neutral)
        requiredQuery<HTMLInputElement>('input[type="checkbox"]').dispatchEvent(
            new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}),
        )
        assert.equal(tri.valueEmitter.get(), FilterMode.Deny)

        tri.destroy()
        document.body.replaceChildren()
        const quad = QuadCheckbox.new({label: 'Quad'}).attachTo(document.body)
        assert.equal(requiredQuery('fray-quadcheckbox').dataset.frayComponent, 'quadcheckbox')
        const quadControl = requiredQuery<HTMLInputElement>('input[type="checkbox"]')
        const nativeClick = () => {
            quadControl.checked = !quadControl.checked
            quadControl.dispatchEvent(new Event('change', {bubbles: true}))
        }
        nativeClick()
        assert.equal(quad.valueEmitter.get(), FilterMode.Prefer)
        assert.equal(quadControl.checked, true)
        nativeClick()
        assert.equal(quad.valueEmitter.get(), FilterMode.Require)
        assert.equal(quadControl.checked, true)
        nativeClick()
        assert.equal(quad.valueEmitter.get(), FilterMode.Deny)
        assert.equal(quadControl.checked, false)
        nativeClick()
        assert.equal(quad.valueEmitter.get(), FilterMode.Neutral)
        assert.equal(quadControl.checked, false)
        quadControl.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}))
        assert.equal(quad.valueEmitter.get(), FilterMode.Deny)
        assert.equal(quadControl.checked, false)
    })
})

describe('layout controls', () => {
    test('Placeholder renders one hidden fixed host with a bounded width', () => {
        Placeholder.new({width: 4}).attachTo(document.body)
        const lowerBound = requiredQuery<HTMLElement>('fray-placeholder')
        assert.equal(lowerBound.style.width, '10%')
        assert.equal(lowerBound.getAttribute('aria-hidden'), 'true')
        assert.equal(lowerBound.querySelector('div, [data-part], [data-state]'), null)

        document.body.replaceChildren()
        Placeholder.new({width: '140'}).attachTo(document.body)
        assert.equal(requiredQuery<HTMLElement>('fray-placeholder').style.width, '100%')

        document.body.replaceChildren()
        Placeholder.new().attachTo(document.body)
        assert.equal(requiredQuery<HTMLElement>('fray-placeholder').style.width, '65%')
        assert.throws(
            () => Placeholder.new({width: 'not a width'}).attachTo(document.body),
            /Placeholder width must be numeric/,
        )
    })

    test('DescriptionList renders native term/value semantics', () => {
        DescriptionList.new({
            label: 'Record details',
            children: [
                h(DescriptionItem, {term: 'Severity', value: 'High'}),
                h(DescriptionItem, {term: 'Owner'}, 'Example team'),
            ],
        }).attachTo(document.body)

        const host = requiredQuery('fray-descriptionlist')
        const list = requiredQuery<HTMLDListElement>('dl', host)
        assert.equal(host.querySelector('div, [data-fray-component]'), null)
        assert.equal(list.getAttribute('aria-label'), 'Record details')
        assert.equal(list.querySelector('div'), null)
        assert.deepEqual([...list.querySelectorAll('dt')].map(({textContent}) => textContent), [
            'Severity',
            'Owner',
        ])
        assert.deepEqual([...list.querySelectorAll('dd')].map(({textContent}) => textContent), [
            'High',
            'Example team',
        ])
    })

    test('InfoPanel renders panel chrome with optional title and key-value fields', () => {
        InfoPanel.new({
            title: 'Employee',
            label: 'Employee details',
            children: [
                h(InfoField, {label: 'Name', value: 'Arthur Morgan'}),
                h(InfoField, {label: 'Role'}, 'Project Manager'),
            ],
        }).attachTo(document.body)

        const host = requiredQuery('fray-infopanel')
        assert.equal(host.getAttribute('role'), 'region')
        assert.ok(host.getAttribute('aria-labelledby'))
        const header = requiredQuery('fray-header', host)
        assert.ok(header, 'header rendered when title is provided')
        const list = requiredQuery<HTMLDListElement>('dl', host)
        assert.equal(list.getAttribute('aria-label'), 'Employee details')
        assert.deepEqual([...list.querySelectorAll('dt')].map(({textContent}) => textContent), [
            'Name',
            'Role',
        ])
        assert.deepEqual([...list.querySelectorAll('dd')].map(({textContent}) => textContent), [
            'Arthur Morgan',
            'Project Manager',
        ])
    })

    test('InfoPanel without title omits header and region role', () => {
        InfoPanel.new({
            children: [
                h(InfoField, {label: 'Team', value: 'Accounting'}),
            ],
        }).attachTo(document.body)

        const host = requiredQuery('fray-infopanel')
        assert.equal(host.getAttribute('role'), null)
        assert.equal(host.querySelector('fray-header'), null)
        const list = requiredQuery<HTMLDListElement>('dl', host)
        assert.equal(list.querySelector('dt')?.textContent, 'Team')
        assert.equal(list.querySelector('dd')?.textContent, 'Accounting')
    })

    test('Breadcrumb renders an ordered path with the last item current', () => {
        let clicked = 0
        Breadcrumb.new({
            items: [
                {id: 'a', label: 'Projects', onClick: () => clicked++},
                {id: 'b', label: 'Factory East 1', onClick: () => clicked++},
                {id: 'c', label: 'Tower A'},
            ],
        }).attachTo(document.body)

        const host = requiredQuery('fray-breadcrumb')
        const nav = requiredQuery('nav', host)
        assert.equal(nav.getAttribute('aria-label'), 'Breadcrumb')
        const items = [...nav.querySelectorAll('ol > li')]
        assert.equal(items.length, 3)
        // ancestors are anchors, the last item is current text
        assert.ok(requiredAt(items, 0).querySelector('a'))
        assert.ok(requiredAt(items, 1).querySelector('a'))
        const current = requiredAt(items, 2).querySelector('[aria-current="page"]')
        assert.ok(current, 'last item is marked current')
        assert.equal(current?.textContent, 'Tower A')
        assert.equal(requiredAt(items, 2).querySelector('a'), null)
        requiredAt(items, 0).querySelector('a')!.click()
        assert.equal(clicked, 1)
    })

    test('Layout owns generic direction, allocation, and explicit scrolling', () => {
        Layout.new({
            horizontal: true,
            allocation: 'flexible',
            scroll: true,
            ariaLabel: 'Comparison layout',
            children: h('p', null, 'Content'),
        }).attachTo(document.body)

        const layout = requiredQuery<HTMLElement>('fray-layout')
        assert.equal(
            layout.className,
            'fray-layout-horizontal fray-size-flexible fray-scroll',
        )
        assert.equal(layout.getAttribute('role'), 'region')
        assert.equal(layout.getAttribute('aria-label'), 'Comparison layout')
        assert.equal(layout.textContent, 'Content')
        assert.throws(
            () => Layout.new({horizontal: true, vertical: true} as never).mount(),
            /cannot be both horizontal and vertical/,
        )
        assert.throws(() => Layout.new().mount(), /requires either horizontal or vertical/)
    })

    test('SplitView owns two Layout panes, an accessible separator, and validation', () => {
        let resizedTo = ''
        SplitView.new({
            horizontal: true,
            primarySize: '18rem',
            onResize: (size) => resizedTo = size,
            children: [
                h(SplitPrimary, {label: 'Project navigation'}, h('p', null, 'Tree')),
                h(SplitSecondary, {label: 'Project details'}, h('p', null, 'Details')),
            ],
        }).attachTo(document.body)

        const split = requiredQuery<HTMLElement>('fray-splitview')
        assert.equal(split.className, 'horizontal')
        assert.equal(split.style.getPropertyValue('--split-primary-size'), '18rem')
        assert.equal(requiredQuery('fray-primary', split).textContent, 'Tree')
        assert.equal(
            requiredQuery('fray-secondary', split).getAttribute('aria-label'),
            'Project details',
        )
        assert.equal(requiredQuery('fray-primary', split).getAttribute('role'), 'region')
        assert.equal(requiredQuery<HTMLElement>('fray-primary', split).tabIndex, 0)
        assert.equal(requiredQuery<HTMLElement>('fray-secondary', split).tabIndex, 0)
        assert.equal(split.querySelector('div'), null)
        assert.match(requiredQuery('fray-primary', split).className, /fray-layout-vertical/)
        const separator = requiredQuery<HTMLElement>('fray-separator', split)
        assert.equal(separator.getAttribute('role'), 'separator')
        assert.equal(separator.getAttribute('aria-orientation'), 'vertical')
        assert.equal(separator.tabIndex, 0)

        Object.defineProperty(split, 'clientWidth', {configurable: true, value: 600})
        Object.defineProperty(separator, 'offsetWidth', {configurable: true, value: 8})
        const primary = requiredQuery<HTMLElement>('fray-primary', split)
        primary.getBoundingClientRect = () => ({
            x: 0, y: 0, width: 240, height: 400,
            top: 0, right: 240, bottom: 400, left: 0,
            toJSON: () => ({}),
        })
        separator.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}))
        assert.equal(split.style.getPropertyValue('--split-primary-size'), '256px')
        assert.equal(resizedTo, '256px')

        SplitView.new({
            direction: 'vertical',
            primarySize: '45%',
            children: [
                h(SplitPrimary, null, 'Navigation'),
                h(SplitSecondary, null, 'Details from children'),
            ],
        }).attachTo(document.body)
        const vertical = requiredQuery<HTMLElement>('fray-splitview.vertical')
        assert.equal(vertical.style.getPropertyValue('--split-primary-size'), '45%')
        assert.equal(requiredQuery('fray-primary', vertical).textContent, 'Navigation')
        assert.equal(requiredQuery('fray-secondary', vertical).textContent, 'Details from children')
        assert.equal(requiredQuery('fray-primary', vertical).hasAttribute('role'), false)
        assert.equal(requiredQuery('fray-secondary', vertical).hasAttribute('aria-label'), false)

        assert.throws(() => SplitView.new().mount(), /requires SplitPrimary/)
        assert.throws(() => SplitView.new({primarySize: ''}).mount(), /primarySize/)
        assert.throws(() => SplitView.new({direction: 'diagonal' as 'horizontal'}).mount(),
            /direction/)
        assert.throws(
            () => SplitView.new({children: 'Unnamed'}).mount(),
            /only direct SplitPrimary and SplitSecondary/,
        )
        assert.throws(
            () => SplitView.new({primary: 'Legacy'} as never).mount(),
            /SplitPrimary and SplitSecondary/,
        )
        assert.throws(
            () => SplitPrimary.new({allocation: 'flexible'} as never).mount(),
            /SplitView owns.*allocation/,
        )
    })

    test('ProgressBar tracks an emitter in determinate and indeterminate modes', () => {
        const value = new Emitter<number | null>(null)
        const progressBar = ProgressBar.new({
            label: 'Project refresh',
            valueEmitter: value,
            max: 4,
        }).attachTo(document.body)
        const progress = requiredQuery<HTMLProgressElement>('progress')
        const host = requiredQuery<HTMLElement>('fray-progressbar')
        assert.equal(host.querySelector('div'), null)
        assert.equal(requiredQuery<HTMLLabelElement>('label', host).htmlFor, progress.id)
        assert.equal(requiredQuery('fray-content', host).getAttribute('aria-hidden'), 'true')
        assert.equal(requiredQuery('fray-label', host).textContent, 'Project refresh')
        assert.equal(requiredQuery('fray-inverse', host).textContent, 'Project refresh')
        assert.equal(progress.hasAttribute('value'), false)
        assert.equal(progress.getAttribute('aria-valuetext'), 'In progress')

        value.set(2)
        assert.equal(progress.value, 2)
        assert.equal(progress.getAttribute('aria-valuetext'), '50%')
        const visualProgress = requiredQuery<HTMLElement>('fray-progress', host)
        assert.equal(visualProgress.style.getPropertyValue('--progress-width'), '50%')
        assert.equal(visualProgress.style.getPropertyValue('--progress-inverse-width'), '200%')
        progressBar.destroy()
        assert.equal(value.subscriberCount, 0)

        ProgressBar.new({
            label: h('strong', null, 'Rich refresh label'),
        }).attachTo(document.body)
        const richHost = requiredQuery<HTMLElement>('fray-progressbar')
        assert.equal(requiredQuery('label > strong', richHost).textContent, 'Rich refresh label')
        assert.equal(requiredQuery('fray-label > strong', richHost).textContent, 'Rich refresh label')
        assert.equal(requiredQuery('fray-inverse > strong', richHost).textContent, 'Rich refresh label')
    })

    test('Header renders native heading levels inside its component host', () => {
        Header.new({
            id: 'summary-header',
            headingId: 'summary-title',
            children: 'Portfolio summary',
        }).attachTo(document.body)
        const header = requiredQuery<HTMLElement>('fray-header')
        const defaultHeading = requiredQuery<HTMLHeadingElement>('h2', header)
        assert.equal(header.id, 'summary-header')
        assert.equal(defaultHeading.id, 'summary-title')
        assert.equal(defaultHeading.textContent, 'Portfolio summary')

        Header.new({
            level: 6,
            children: h('span', null, 'Deep heading'),
        }).attachTo(document.body)
        assert.equal(requiredQuery<HTMLHeadingElement>('fray-header h6').textContent,
            'Deep heading')
        assert.throws(() => Header.new({level: 7 as never}).mount(), /integer from 1 to 6/)
    })

    test('GroupPanel labels a bordered group through a vertical Header', () => {
        GroupPanel.new({
            header: 'Select and order splits',
            children: h('ol', null, h('li', null, 'Severity')),
        }).attachTo(document.body)

        const group = requiredQuery<HTMLElement>('fray-grouppanel')
        const header = requiredQuery<HTMLElement>(':scope > fray-header', group)
        const title = requiredQuery<HTMLHeadingElement>(':scope > h2', header)
        const content = requiredQuery<HTMLElement>(':scope > fray-content', group)
        assert.equal(group.getAttribute('role'), 'group')
        assert.equal(group.getAttribute('aria-labelledby'), title.id)
        assert.equal(title.textContent, 'Select and order splits')
        assert.equal(content.textContent, 'Severity')
        assert.equal(group.querySelector('div'), null)
    })

    test('Panel uses a labelled component host and explicit orientation', () => {
        Panel.new({
            header: 'Profile',
            orientation: 'horizontal',
            children: [
                h(PanelToolbar, null, h(Button, {label: 'Save'})),
                h('p', null, 'Details'),
            ],
        }).attachTo(document.body)

        const section = requiredQuery<HTMLElement>('fray-panel')
        const header = requiredQuery<HTMLElement>('fray-header', section)
        const title = requiredQuery<HTMLElement>('h2', header)
        const content = requiredQuery<HTMLElement>('fray-layout', section)
        assert.equal(section.getAttribute('role'), 'region')
        assert.equal(section.className, '')
        assert.equal(section.getAttribute('aria-labelledby'), title.id)
        assert.equal(section.hasAttribute('data-orientation'), false)
        assert.equal(
            content.className,
            'panel-content fray-layout-horizontal fray-scroll',
        )
        assert.equal(content.textContent, 'Details')
        assert.equal(requiredQuery(':scope > fray-button', section).textContent, 'Save')
        assert.equal(section.querySelector('div'), null)
        assert.throws(
            () => Panel.new({toolbar: 'Legacy toolbar'} as never).mount(),
            /PanelToolbar/,
        )
    })

    test('parent-specific declarative regions expose named anatomy without string slots', () => {
        class ShellHeader extends DeclarativeRegion {}
        class ShellContent extends DeclarativeRegion {}
        class ForeignRegion extends DeclarativeRegion {}
        const result = readDeclarativeRegions('ApplicationShell', [
            h(ShellHeader, null, h('strong', null, 'Product')),
            h(ShellContent, null, h('main', null, 'Workspace')),
        ], {header: ShellHeader, content: ShellContent}, {
            allowContent: false,
            required: ['header', 'content'],
        })

        assert.equal(result.regions.header?.length, 1)
        assert.equal(result.regions.content?.length, 1)
        assert.equal(result.content.length, 0)
        assert.throws(
            () => readDeclarativeRegions('ApplicationShell', h(ForeignRegion), {
                header: ShellHeader,
            }),
            /does not support region: ForeignRegion/,
        )
        assert.throws(
            () => readDeclarativeRegions('ApplicationShell', [
                h(ShellHeader, null, 'One'),
                h(ShellHeader, null, 'Two'),
            ], {header: ShellHeader}),
            /duplicate region: header/,
        )
        assert.throws(() => ForeignRegion.new().mount(), /direct child/)
    })

    test('OptionGroup uses a named marker for trailing legend content', () => {
        OptionGroup.new({
            label: 'Severity',
            children: [
                h(OptionGroupHeaderEnd, null, h('small', null, 'Required')),
                h('p', null, 'Options'),
            ],
        }).attachTo(document.body)

        const group = requiredQuery('fray-optiongroup')
        assert.equal(requiredQuery('legend', group).textContent, 'SeverityRequired')
        assert.equal(requiredQuery('fieldset > p', group).textContent, 'Options')
        assert.throws(
            () => OptionGroup.new({label: 'Legacy', headerEnd: 'Required'} as never).mount(),
            /OptionGroupHeaderEnd/,
        )
    })

    test('shell components map explicit allocation to their intentional hosts', () => {
        const panel = Panel.new({allocation: 'flexible', children: 'Flexible'})
        panel.attachTo(document.body)
        assert.equal(requiredQuery<HTMLElement>('fray-panel').className, 'fray-size-flexible')
        assert.equal(
            requiredQuery<HTMLElement>('fray-panel > fray-layout').className,
            'panel-content fray-layout-vertical fray-scroll',
        )
        panel.destroy()

        const sidebar = Sidebar.new({allocation: 'natural', children: 'Natural'})
        sidebar.attachTo(document.body)
        assert.equal(requiredQuery<HTMLElement>('fray-sidebar').className, 'fray-size-natural')
        sidebar.destroy()

        assert.throws(
            () => Panel.new({allocation: 'fixed' as never}),
            /Layout allocation must be natural or flexible/,
        )
    })

    test('fixed component hosts opt into island treatment explicitly', () => {
        const panel = Panel.new({
            className: 'portfolio-summary',
            island: true,
            children: 'Summary',
        }).attachTo(document.body)
        const host = requiredQuery<HTMLElement>('fray-panel')

        assert.equal(host.className, 'portfolio-summary island')

        panel.setProps({className: 'portfolio-summary', island: false, children: 'Summary'})
        assert.equal(host.className, 'portfolio-summary')
    })

    test('island components reject another island anywhere below them', () => {
        class NestedIslandProbe extends Component {
            render() {
                return h(Panel, {
                    island: true,
                    children: h('div', null, h(Panel, {island: true, children: 'Nested'})),
                })
            }
        }

        assert.throws(
            () => NestedIslandProbe.new().mount(),
            /island component cannot be nested inside another island/,
        )

        const parent = Panel.new({
            children: h(Panel, {className: 'island', children: 'Existing child island'}),
        }).mount()
        assert.throws(
            () => parent.setProps({
                island: true,
                children: h(Panel, {className: 'island', children: 'Existing child island'}),
            }),
            /island component cannot contain another island/,
        )
        parent.destroy()
    })

    test('runtime leaves root sizing policy to the application', () => {
        const target = document.createElement('div')
        document.body.append(target)
        const runtime = createFrayRuntime()
        const panel = runtime.mount(runtime.create(Panel), target)
        assert.equal(target.className, '')
        panel.destroy()
    })

    test('Panel tracks a live disabled state', () => {
        const disabled = new Emitter(false)
        class PanelOwner extends Component {
            render() {
                return h(Panel, {
                    header: 'Review state',
                    disabled: live(disabled),
                    children: 'Panel content',
                })
            }
        }
        PanelOwner.new().attachTo(document.body)

        const panel = requiredQuery<HTMLElement>('fray-panel')
        assert.equal(panel.hasAttribute('aria-disabled'), false)
        assert.equal(panel.getAttribute('aria-disabled'), null)

        disabled.set(true)
        assert.equal(panel.getAttribute('aria-disabled'), 'true')
    })

    test('Sidebar labels a native aside and separates fixed controls from content', () => {
        Sidebar.new({
            id: 'change-requests',
            header: 'Change requests',
            ariaLabel: 'Ignored fallback',
            children: [
                h(SidebarToolbar, null,
                    h(Toolbar, {label: 'Request filters'}, h(Button, {label: 'Refresh'}))),
                h('ol', null, h('li', null, 'First request')),
            ],
        }).attachTo(document.body)

        const sidebar = requiredQuery<HTMLElement>('fray-sidebar')
        const region = requiredQuery<HTMLElement>('aside', sidebar)
        const heading = requiredQuery<HTMLElement>('h2', sidebar)
        const toolbar = requiredQuery<HTMLElement>('fray-toolbarcontent', region)
        const content = requiredQuery<HTMLElement>('fray-content', region)
        assert.equal(region.id, 'change-requests')
        assert.equal(region.getAttribute('aria-labelledby'), heading.id)
        assert.equal(region.hasAttribute('aria-label'), false)
        assert.equal(requiredQuery('[role="toolbar"]', toolbar).textContent, 'Refresh')
        assert.equal(content.textContent, 'First request')
        assert.equal(content.tabIndex, 0)
        assert.equal(sidebar.children[0], region)
        assert.equal(region.children[0], heading.parentElement)
        assert.equal(region.children[1], toolbar)
        assert.equal(region.children[2], content)
        assert.equal(sidebar.querySelector('div'), null)
    })

    test('Sidebar uses ariaLabel when no visible header exists', () => {
        Sidebar.new({
            ariaLabel: 'Saved views',
            children: 'No saved views',
        }).attachTo(document.body)

        const sidebar = requiredQuery<HTMLElement>('fray-sidebar')
        const region = requiredQuery<HTMLElement>('aside', sidebar)
        assert.equal(region.getAttribute('aria-label'), 'Saved views')
        assert.equal(region.hasAttribute('aria-labelledby'), false)
        assert.equal(region.querySelector('fray-header'), null)
        assert.throws(
            () => Sidebar.new({toolbar: 'Legacy toolbar'} as never).mount(),
            /SidebarToolbar/,
        )
    })

    test('TabPanel wires tab semantics, content, clicks, and arrow keys', () => {
        const active = new Emitter('first')
        TabPanel.new({
            id: 'settings',
            label: 'Settings sections',
            valueEmitter: active,
            tabs: [
                {id: 'first', label: 'First', content: h('p', null, 'First content')},
                {id: 'second', label: 'Second', content: h('p', null, 'Second content')},
            ],
        }).attachTo(document.body)

        const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
        assert.equal(requiredQuery('fray-tabpanel').dataset.frayComponent, 'tab-panel')
        assert.equal(requiredQuery('fray-tabline').dataset.frayComponent, 'tab-line')
        const firstPanel = requiredQuery<HTMLElement>('#settings-panel-first')
        const secondPanel = requiredQuery<HTMLElement>('#settings-panel-second')
        assert.equal(requiredAt(tabs, 0).getAttribute('aria-selected'), 'true')
        assert.equal(requiredAt(tabs, 0).getAttribute('aria-controls'), firstPanel.id)
        assert.equal(firstPanel.getAttribute('aria-labelledby'), requiredAt(tabs, 0).id)
        assert.equal(firstPanel.textContent, 'First content')
        assert.equal(firstPanel.hidden, false)
        assert.equal(secondPanel.textContent, 'Second content')
        assert.equal(secondPanel.hidden, true)

        requiredAt(tabs, 1).click()
        assert.equal(active.get(), 'second')
        assert.equal(requiredAt(tabs, 1).getAttribute('aria-selected'), 'true')
        assert.equal(firstPanel.hidden, true)
        assert.equal(secondPanel.hidden, false)
        assert.equal(secondPanel.textContent, 'Second content')

        active.set('first')
        assert.equal(firstPanel.hidden, false)
        assert.equal(secondPanel.hidden, true)
        assert.equal(requiredQuery('#settings-panel-first'), firstPanel)

        requiredAt(tabs, 1).focus()
        requiredAt(tabs, 1).dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            bubbles: true,
        }))
        assert.equal(active.get(), 'first')
        assert.equal(document.activeElement, requiredAt(tabs, 0))
    })

    test('TabPanel lazily mounts content once and retains visited components', () => {
        const active = new Emitter('first')
        const lifecycle: string[] = []
        class Probe extends Component<{name: string}> {
            initialize(): void {
                lifecycle.push(`initialize ${this.props.name}`)
            }

            render() {
                return h('p', null, this.props.name)
            }

            override onDestroy(): void {
                lifecycle.push(`destroy ${this.props.name}`)
            }
        }
        const panel = TabPanel.new({
            id: 'lazy-tabs',
            mountPolicy: 'lazy',
            valueEmitter: active,
            tabs: [
                {id: 'first', content: h(Probe, {name: 'first'})},
                {id: 'second', content: h(Probe, {name: 'second'})},
            ],
        }).attachTo(document.body)
        const firstPanel = requiredQuery<HTMLElement>('#lazy-tabs-panel-first')
        const secondPanel = requiredQuery<HTMLElement>('#lazy-tabs-panel-second')

        assert.deepEqual(lifecycle, ['initialize first'])
        assert.equal(firstPanel.textContent, 'first')
        assert.equal(secondPanel.textContent, '')
        active.set('second')
        assert.deepEqual(lifecycle, ['initialize first', 'initialize second'])
        assert.equal(firstPanel.textContent, 'first')
        assert.equal(secondPanel.textContent, 'second')
        active.set('first')
        assert.deepEqual(lifecycle, ['initialize first', 'initialize second'])

        panel.destroy()
        assert.deepEqual(lifecycle, [
            'initialize first',
            'initialize second',
            'destroy first',
            'destroy second',
        ])
    })

    test('TabPanel active-only policy destroys and recreates selected content', () => {
        const active = new Emitter('first')
        const lifecycle: string[] = []
        class Probe extends Component<{name: string}> {
            initialize(): void {
                lifecycle.push(`initialize ${this.props.name}`)
            }

            render() {
                return h('p', null, this.props.name)
            }

            override onDestroy(): void {
                lifecycle.push(`destroy ${this.props.name}`)
            }
        }
        const panel = TabPanel.new({
            id: 'active-tabs',
            mountPolicy: 'active-only',
            valueEmitter: active,
            tabs: [
                {id: 'first', content: h(Probe, {name: 'first'})},
                {id: 'second', content: h(Probe, {name: 'second'})},
            ],
        }).attachTo(document.body)
        const firstPanel = requiredQuery<HTMLElement>('#active-tabs-panel-first')
        const secondPanel = requiredQuery<HTMLElement>('#active-tabs-panel-second')

        assert.deepEqual(lifecycle, ['initialize first'])
        assert.equal(secondPanel.textContent, '')
        active.set('second')
        assert.deepEqual(lifecycle, [
            'initialize first',
            'destroy first',
            'initialize second',
        ])
        assert.equal(firstPanel.textContent, '')
        assert.equal(secondPanel.textContent, 'second')
        active.set('first')
        assert.equal(lifecycle.filter((event) => event === 'initialize first').length, 2)
        assert.equal(lifecycle.filter((event) => event === 'destroy first').length, 1)
        assert.equal(lifecycle.filter((event) => event === 'initialize second').length, 1)
        assert.equal(lifecycle.filter((event) => event === 'destroy second').length, 1)
        assert.equal(firstPanel.textContent, 'first')
        assert.equal(secondPanel.textContent, '')

        panel.destroy()
        assert.equal(lifecycle.at(-1), 'destroy first')
    })

    test('TabPanel prunes removed lazy content and applies policy changes', () => {
        const active = new Emitter('first')
        const lifecycle: string[] = []
        class Probe extends Component<{name: string}> {
            initialize(): void {
                lifecycle.push(`initialize ${this.props.name}`)
            }

            render() {
                return this.props.name
            }

            override onDestroy(): void {
                lifecycle.push(`destroy ${this.props.name}`)
            }
        }
        const tabs = [
            {id: 'first', content: h(Probe, {name: 'first'})},
            {id: 'second', content: h(Probe, {name: 'second'})},
            {id: 'third', content: h(Probe, {name: 'third'})},
        ]
        const panel = TabPanel.new({mountPolicy: 'lazy', valueEmitter: active, tabs})
            .attachTo(document.body)

        active.set('second')
        assert.deepEqual(lifecycle, ['initialize first', 'initialize second'])
        panel.setProps({mountPolicy: 'lazy', valueEmitter: active, tabs: tabs.slice(1)})
        assert.deepEqual(lifecycle, [
            'initialize first',
            'initialize second',
            'destroy first',
        ])

        panel.setProps({mountPolicy: 'active-only', valueEmitter: active, tabs: tabs.slice(1)})
        active.set('third')
        assert.equal(lifecycle.filter((event) => event === 'destroy second').length, 1)
        assert.equal(lifecycle.filter((event) => event === 'initialize third').length, 1)
        assert.equal(requiredQuery('[role="tabpanel"]:not([hidden])').textContent, 'third')

        panel.destroy()
    })

    test('TabPanel rejects unsupported mount policies', () => {
        assert.throws(() => TabPanel.new({
            // @ts-expect-error Runtime validation remains for JavaScript consumers.
            mountPolicy: 'sometimes',
            tabs: [{id: 'first', content: 'First'}],
        }), /eager, lazy, or active-only/)
    })

    test('TabLine uses native disabled tabs and skips them while roving', () => {
        const active = new Emitter('portfolio')
        TabLine.new({
            baseId: 'meridian-area',
            valueEmitter: active,
            tabs: [
                {id: 'portfolio', label: 'Portfolio'},
                {id: 'register', label: 'Register'},
                {id: 'analysis', label: 'Analysis', disabled: true},
            ],
        }).attachTo(document.body)

        const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        assert.equal(requiredAt(tabs, 0).getAttribute('aria-selected'), 'true')
        assert.equal(requiredAt(tabs, 0).tabIndex, 0)
        assert.equal(requiredAt(tabs, 2).disabled, true)
        assert.equal(requiredAt(tabs, 2).getAttribute('aria-selected'), 'false')
        assert.equal(requiredAt(tabs, 2).tabIndex, -1)

        requiredAt(tabs, 2).click()
        assert.equal(active.get(), 'portfolio')

        requiredAt(tabs, 0).focus()
        requiredAt(tabs, 0).dispatchEvent(new KeyboardEvent('keydown', {
            key: 'End',
            bubbles: true,
        }))
        assert.equal(active.get(), 'register')
        assert.equal(document.activeElement, requiredAt(tabs, 1))
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
