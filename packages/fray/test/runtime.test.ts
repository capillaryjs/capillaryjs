import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter, FetchState} from '@sylwellsoftware/glue'
import {Component, Fragment, h, live} from '../src/Components/component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../src/Components/component.js'
import {createPrebuiltElement, jsx} from '../src/jsx-runtime.js'
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

after(() => {
    window.close()
})

describe('Component lifecycle', () => {
    test('constructs without side effects and mounts/destroys exactly once', () => {
        const value = new Emitter('first')
        const calls = {initialize: 0, render: 0, mount: 0, destroy: 0}

        interface ProbeProps extends ComponentProps {
            value: Emitter<string>
        }

        class Probe extends Component<ProbeProps> {
            initialize() {
                calls.initialize += 1
                this.watch(this.props.value)
            }

            render() {
                calls.render += 1
                return h('output', null, this.props.value.get())
            }

            afterMount() {
                calls.mount += 1
            }

            onDestroy() {
                calls.destroy += 1
            }
        }

        const probe = new Probe({value})
        assert.deepEqual(calls, {initialize: 0, render: 0, mount: 0, destroy: 0})
        assert.equal(probe.dom, null)

        probe.mount(document.body)
        probe.mount()
        assert.deepEqual(calls, {initialize: 1, render: 1, mount: 1, destroy: 0})
        assert.equal(document.body.textContent, 'first')
        assert.equal(value.subscriberCount, 1)

        value.set('second')
        assert.equal(document.body.textContent, 'second')
        assert.equal(calls.render, 2)
        assert.equal(value.subscriberCount, 1)

        probe.destroy()
        probe.destroy()
        assert.deepEqual(calls, {initialize: 1, render: 2, mount: 1, destroy: 1})
        assert.equal(value.subscriberCount, 0)
        assert.equal(document.body.childNodes.length, 0)
    })

    test('reuses nested components and patches their props', () => {
        const label = new Emitter('alpha')
        const calls = {initialize: 0, destroy: 0}

        interface ChildProps extends ComponentProps, LivePropContract<'label'> {
            label: string
        }

        class Child extends Component<ChildProps> {
            initialize() {
                calls.initialize += 1
            }
            render() {
                return h('span', null, this.props.label)
            }
            onDestroy() {
                calls.destroy += 1
            }
        }

        class Parent extends Component {
            initialize() {
                this.watch(label)
            }
            render() {
                return h('div', null, h(Child, {key: 'child', label: label.get()}))
            }
        }

        const parent = Parent.new().attachTo(document.body)
        const childNode = requiredQuery('span')
        label.set('beta')

        assert.equal(document.querySelector('span'), childNode)
        assert.equal(childNode.textContent, 'beta')
        assert.equal(calls.initialize, 1)

        parent.destroy()
        assert.equal(calls.destroy, 1)
    })

    test('destroys removed child components and their watchers', () => {
        const visible = new Emitter(true)
        const source = new Emitter('value')
        let destroyed = 0

        interface ChildProps extends ComponentProps {
            source: Emitter<string>
        }

        class Child extends Component<ChildProps> {
            initialize() {
                this.watch(this.props.source)
            }
            render() {
                return h('span', null, this.props.source.get())
            }
            onDestroy() {
                destroyed += 1
            }
        }

        class Parent extends Component {
            initialize() {
                this.watch(visible)
            }
            render() {
                return h('div', null,
                    visible.get()
                        ? h(Child, {key: 'conditional', source})
                        : h('em', null, 'hidden'))
            }
        }

        const parent = Parent.new().attachTo(document.body)
        assert.equal(source.subscriberCount, 1)
        visible.set(false)
        assert.equal(source.subscriberCount, 0)
        assert.equal(destroyed, 1)
        assert.equal(document.body.textContent, 'hidden')
        parent.destroy()
        assert.equal(destroyed, 1)
    })

    test('cleans up registered global listeners', () => {
        let calls = 0
        class Listening extends Component {
            initialize() {
                this.listen(document, 'probe', () => calls += 1)
            }
            render() {
                return h('div')
            }
        }

        const component = Listening.new()
        document.dispatchEvent(new Event('probe'))
        component.destroy()
        document.dispatchEvent(new Event('probe'))
        assert.equal(calls, 1)
    })
})

describe('DOM patching', () => {
    test('typing preserves node identity, focus, and cursor position', () => {
        const value = new Emitter('hello')

        class InputProbe extends Component {
            initialize() {
                this.watch(value)
            }
            render() {
                return h('input', {
                    'aria-label': 'Message',
                    value: value.get(),
                    onInput: (event: Event) => value.set(
                        (event.currentTarget as HTMLInputElement).value,
                    ),
                })
            }
        }

        InputProbe.new().attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')
        input.focus()
        input.value = 'hello!'
        input.setSelectionRange(6, 6)
        input.dispatchEvent(new Event('input', {bubbles: true}))

        assert.equal(document.querySelector('input'), input)
        assert.equal(document.activeElement, input)
        assert.equal(input.selectionStart, 6)
        assert.equal(input.selectionEnd, 6)
        assert.equal(value.get(), 'hello!')
    })

    test('replaces event handlers without stacking listeners', () => {
        const revision = new Emitter(0)
        let clicks = 0

        class Action extends Component {
            initialize() {
                this.watch(revision)
            }
            render() {
                const renderedRevision = revision.get()
                return h('button', {
                    onClick: () => {
                        assert.equal(renderedRevision, revision.get())
                        clicks += 1
                    },
                }, 'Act')
            }
        }

        Action.new().attachTo(document.body)
        const button = requiredQuery<HTMLButtonElement>('button')
        for (let index = 1; index <= 5; index += 1) revision.set(index)
        button.dispatchEvent(new MouseEvent('click', {bubbles: true}))

        assert.equal(document.querySelector('button'), button)
        assert.equal(clicks, 1)
    })

    test('updates boolean attributes and stateful DOM properties', () => {
        const enabled = new Emitter(true)

        class BooleanProbe extends Component {
            initialize() {
                this.watch(enabled)
            }
            render() {
                return h('input', {
                    type: 'checkbox',
                    checked: enabled.get(),
                    disabled: enabled.get(),
                    required: enabled.get(),
                })
            }
        }

        BooleanProbe.new().attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')
        assert.equal(input.checked, true)
        assert.equal(input.disabled, true)
        assert.equal(input.hasAttribute('checked'), true)
        assert.equal(input.hasAttribute('disabled'), true)

        enabled.set(false)
        assert.equal(document.querySelector('input'), input)
        assert.equal(input.checked, false)
        assert.equal(input.disabled, false)
        assert.equal(input.required, false)
        assert.equal(input.hasAttribute('checked'), false)
        assert.equal(input.hasAttribute('disabled'), false)
        assert.equal(input.hasAttribute('required'), false)
    })

    test('preserves and reorders keyed child nodes', () => {
        const order = new Emitter(['a', 'b', 'c'])

        class KeyedList extends Component {
            initialize() {
                this.watch(order)
            }
            render() {
                return h('ol', null,
                    order.get().map((item) => h('li', {key: item}, item)))
            }
        }

        KeyedList.new().attachTo(document.body)
        const original = new Map(
            [...document.querySelectorAll<HTMLLIElement>('li')]
                .map((node) => [node.textContent ?? '', node] as const),
        )
        order.set(['c', 'a', 'b'])
        const reordered = [...document.querySelectorAll('li')]

        assert.deepEqual(reordered.map((node) => node.textContent), ['c', 'a', 'b'])
        assert.equal(requiredAt(reordered, 0), original.get('c'))
        assert.equal(requiredAt(reordered, 1), original.get('a'))
        assert.equal(requiredAt(reordered, 2), original.get('b'))
    })

    test('normalizes class, labels, dataset, ARIA, style, and refs', () => {
        const ref: {current: HTMLLabelElement | null} = {current: null}

        class PropsProbe extends Component {
            render() {
                return h('label', {
                    className: 'field',
                    htmlFor: 'name',
                    dataset: {testId: 'label'},
                    ariaLabel: 'Name field',
                    style: {color: 'red', '--accent': 'blue'},
                    ref,
                }, 'Name')
            }
        }

        const component = PropsProbe.new().attachTo(document.body)
        const label = requiredQuery<HTMLLabelElement>('label')
        assert.equal(label.className, 'field')
        assert.equal(label.htmlFor, 'name')
        assert.equal(label.dataset.testId, 'label')
        assert.equal(label.getAttribute('aria-label'), 'Name field')
        assert.equal(label.style.color, 'red')
        assert.equal(label.style.getPropertyValue('--accent'), 'blue')
        assert.equal(ref.current, label)
        component.destroy()
        assert.equal(ref.current, null)
    })
})

describe('vnode and JSX forms', () => {
    test('renders arrays, fragments, primitives, and ignored children', () => {
        class PrimitiveTree extends Component {
            render() {
                return [
                    h('span', null, 'a', 0),
                    h(Fragment, null, ['b', false, null, undefined, 2]),
                ]
            }
        }

        PrimitiveTree.new().attachTo(document.body)
        assert.equal(document.body.textContent, 'a0b2')
        assert.equal(document.querySelectorAll('span').length, 1)
    })

    test('supports stateless function components', () => {
        interface GreetingProps extends ComponentProps {
            name: string
        }

        function Greeting({name, children}: GreetingProps): FrayChild {
            return h('p', null, `Hello ${name}`, children)
        }

        class App extends Component {
            render() {
                return h(Greeting, {name: 'Ada'}, '!')
            }
        }

        App.new().attachTo(document.body)
        assert.equal(document.body.innerHTML, '<p>Hello Ada!</p>')
    })

    test('mounts a prebuilt instance only once', () => {
        let initialized = 0
        class Child extends Component {
            initialize() {
                initialized += 1
            }
            render() {
                return h('span', null, 'prebuilt')
            }
        }
        const child = new Child()

        class Parent extends Component {
            render() {
                return h('div', null, createPrebuiltElement(child))
            }
        }

        Parent.new().attachTo(document.body)
        assert.equal(initialized, 1)
        assert.equal(document.body.textContent, 'prebuilt')
    })

    test('makes h() and automatic JSX runtime output equivalent', () => {
        const hNode = h('div', {className: 'example'}, 'value', 0)
        const jsxNode = jsx('div', {className: 'example', children: ['value', 0]})

        class WithH extends Component {
            render() { return hNode }
        }
        class WithJsx extends Component {
            render() { return jsxNode }
        }

        const left = WithH.new()
        const right = WithJsx.new()
        assert.ok(left.dom instanceof Element)
        assert.ok(right.dom instanceof Element)
        assert.equal(left.dom.outerHTML, right.dom.outerHTML)
        left.destroy()
        right.destroy()
    })

    test('rejects invalid children and duplicate sibling keys clearly', () => {
        class Invalid extends Component {
            render() {
                // @ts-expect-error Deliberately exercise the runtime child validator.
                return h('div', null, {not: 'a vnode'})
            }
        }
        assert.throws(() => Invalid.new(), /Invalid Fray child/)

        class DuplicateKeys extends Component {
            render() {
                return h('div', null,
                    h('span', {key: 'same'}),
                    h('span', {key: 'same'}))
            }
        }
        assert.throws(() => DuplicateKeys.new(), /Duplicate sibling key/)
    })
})

describe('Glue template bindings', () => {
    test('renders emitter children as fine-grained binding ranges', () => {
        const content = new Emitter<FrayChild>('first')
        let renders = 0

        class Probe extends Component {
            render() {
                renders += 1
                return h('div', null, 'Value: ', content)
            }
        }

        const probe = Probe.new().attachTo(document.body)
        const root = requiredQuery('div')
        assert.equal(root.textContent, 'Value: first')
        assert.equal(content.subscriberCount, 1)

        content.set(h('strong', null, 'second'))
        assert.equal(root.textContent, 'Value: second')
        assert.equal(requiredQuery('strong'), root.querySelector('strong'))
        assert.equal(renders, 1)

        content.set([h('span', {key: 'a'}, 'A'), h('span', {key: 'b'}, 'B')])
        assert.equal(root.textContent, 'Value: AB')
        assert.equal(renders, 1)

        probe.destroy()
        assert.equal(content.subscriberCount, 0)
    })

    test('passes emitters raw to child props while children subscribe directly', () => {
        const title = new Emitter('Draft')
        let received: Emitter<string> | null = null

        interface PreviewProps extends ComponentProps {
            titleEmitter: Emitter<string>
        }

        class Preview extends Component<PreviewProps> {
            render() {
                received = this.props.titleEmitter
                return h('h2', null, this.props.titleEmitter)
            }
        }

        class Parent extends Component {
            render() {
                return h(Preview, {titleEmitter: title})
            }
        }

        const parent = Parent.new().attachTo(document.body)
        assert.equal(received, title)
        assert.equal(document.body.textContent, 'Draft')
        title.set('Submitted')
        assert.equal(document.body.textContent, 'Submitted')
        assert.equal(received, title)

        parent.destroy()
        assert.equal(title.subscriberCount, 0)
    })

    test('binds live DOM and component props without rerendering their parent', () => {
        const disabled = new Emitter(false)
        const label = new Emitter('Save')
        let parentRenders = 0
        let childRenders = 0

        interface ChildProps extends ComponentProps {
            label: string
        }

        interface LiveChildProps extends ComponentProps, LivePropContract<'label'> {
            label: string
        }

        class LiveChild extends Component<LiveChildProps> {
            static override liveProps = ['label'] as const

            render() {
                childRenders += 1
                return h('span', null, this.props.label)
            }
        }

        class Parent extends Component {
            render() {
                parentRenders += 1
                return h('div', null,
                    h('button', {disabled: live(disabled)}, 'Action'),
                    h(LiveChild, {label: live(label)}))
            }
        }

        const parent = Parent.new().attachTo(document.body)
        const button = requiredQuery<HTMLButtonElement>('button')
        assert.equal(button.disabled, false)
        assert.equal(document.body.textContent, 'ActionSave')

        disabled.set(true)
        label.set('Saved')
        assert.equal(button.disabled, true)
        assert.equal(document.body.textContent, 'ActionSaved')
        assert.equal(parentRenders, 1)
        assert.equal(childRenders, 2)

        parent.destroy()
        assert.equal(disabled.subscriberCount, 0)
        assert.equal(label.subscriberCount, 0)
    })

    test('supports two-way native value and checked bindings', () => {
        const value = new Emitter('Ada')
        const checked = new Emitter(false)

        class Form extends Component {
            render() {
                return h('form', null,
                    h('input', {'aria-label': 'Name', 'bind:value': value}),
                    h('input', {
                        type: 'checkbox',
                        'aria-label': 'Enabled',
                        'bind:checked': checked,
                    }))
            }
        }

        const form = Form.new().attachTo(document.body)
        const name = requiredQuery<HTMLInputElement>('[aria-label="Name"]')
        const enabled = requiredQuery<HTMLInputElement>('[aria-label="Enabled"]')
        assert.equal(name.value, 'Ada')
        assert.equal(enabled.checked, false)

        value.set('Grace')
        checked.set(true)
        assert.equal(name.value, 'Grace')
        assert.equal(enabled.checked, true)

        name.value = 'Linus'
        name.dispatchEvent(new Event('input', {bubbles: true}))
        enabled.checked = false
        enabled.dispatchEvent(new Event('change', {bubbles: true}))
        assert.equal(value.get(), 'Linus')
        assert.equal(checked.get(), false)

        form.destroy()
        assert.equal(value.subscriberCount, 0)
        assert.equal(checked.subscriberCount, 0)
    })

    test('tracks read and snapshot dependencies dynamically', () => {
        const usePrimary = new Emitter(true)
        const primary = new Emitter('primary')
        const secondary = new Emitter('secondary')
        let renders = 0

        class Probe extends Component {
            render() {
                renders += 1
                const selected = this.read(usePrimary) ? primary : secondary
                const snapshot = this.snapshot(selected)
                return h('output', null,
                    `${snapshot.value}:${snapshot.fetchState}:${snapshot.error ?? 'none'}`)
            }
        }

        const probe = Probe.new().attachTo(document.body)
        assert.equal(document.body.textContent, `primary:${FetchState.Ready}:none`)
        assert.equal(primary.subscriberCount, 1)
        assert.equal(secondary.subscriberCount, 0)

        usePrimary.set(false)
        assert.equal(document.body.textContent, `secondary:${FetchState.Ready}:none`)
        assert.equal(primary.subscriberCount, 0)
        assert.equal(secondary.subscriberCount, 1)

        secondary.setWithState('stale', FetchState.Error, 'offline')
        assert.equal(document.body.textContent, `stale:${FetchState.Error}:offline`)
        assert.equal(renders, 3)

        assert.throws(() => probe.read(primary), /only be called during render/)
        probe.destroy()
        assert.equal(usePrimary.subscriberCount, 0)
        assert.equal(secondary.subscriberCount, 0)
    })
})
