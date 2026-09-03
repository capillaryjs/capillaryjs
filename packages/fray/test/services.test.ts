import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Component, h} from '../src/Components/component.js'
import {createFrayRuntime} from '../src/runtime.js'
import {
    ServiceScope,
    createServiceScope,
    defineService,
    provideService,
} from '../src/services.js'

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
        DocumentFragment: window.DocumentFragment,
    })
})

afterEach(() => {
    document.body.replaceChildren()
})

after(() => {
    window.close()
})

describe('ServiceScope', () => {
    test('creates declared services lazily once and resolves explicit dependencies', () => {
        const events: string[] = []
        const transport = defineService<{request(): string; dispose(): void}>('transport')
        const projects = defineService<{load(): string; dispose(): void}>('projects')
        const scope = createServiceScope([
            provideService(transport, () => {
                events.push('create transport')
                return {
                    request: () => 'records',
                    dispose: () => events.push('dispose transport'),
                }
            }),
            provideService(projects, (services) => {
                events.push('create projects')
                const client = services.require(transport)
                return {
                    load: () => client.request(),
                    dispose: () => events.push('dispose projects'),
                }
            }),
        ])

        assert.deepEqual(events, [])
        const first = scope.require(projects)
        const second = scope.require(projects)
        assert.equal(first, second)
        assert.equal(first.load(), 'records')
        assert.deepEqual(events, ['create projects', 'create transport'])

        scope.dispose()
        scope.dispose()
        assert.deepEqual(events, [
            'create projects',
            'create transport',
            'dispose projects',
            'dispose transport',
        ])
        assert.equal(scope.isDisposed, true)
        assert.throws(() => scope.require(projects), /ServiceScope has been disposed/)
    })

    test('rejects duplicate, missing, circular, and invalid declarations', () => {
        const first = defineService<object>('first')
        const second = defineService<object>('second')
        const firstProvider = provideService(first, (services) => services.require(second))
        const secondProvider = provideService(second, (services) => services.require(first))

        assert.throws(
            () => createServiceScope([firstProvider, firstProvider]),
            /registered more than once/,
        )
        assert.throws(() => createServiceScope().require(first), /is not registered/)
        assert.throws(
            () => createServiceScope([firstProvider, secondProvider]).require(first),
            /first -> second -> first/,
        )
        assert.throws(() => defineService('   '), /non-empty string/)
        assert.throws(
            () => new ServiceScope([{} as never]),
            /created by provideService/,
        )
    })

    test('attempts every initialized service disposal and reports failures', () => {
        const events: string[] = []
        const first = defineService<{dispose(): void}>('first')
        const second = defineService<{dispose(): void}>('second')
        const scope = createServiceScope([
            provideService(first, () => ({
                dispose() {
                    events.push('first')
                    throw new Error('first failed')
                },
            })),
            provideService(second, () => ({
                dispose() {
                    events.push('second')
                    throw new Error('second failed')
                },
            })),
        ])
        scope.require(first)
        scope.require(second)

        assert.throws(() => scope.dispose(), AggregateError)
        assert.deepEqual(events, ['second', 'first'])
    })
})

describe('Fray service access', () => {
    test('propagates one runtime service through nested class components', () => {
        const greeting = defineService<{message: string}>('greeting')
        const service = {message: 'Hello from the runtime'}
        const scope = createServiceScope([provideService(greeting, () => service)])

        class Child extends Component {
            static requiredServices = [greeting]
            private message = ''

            initialize(): void {
                this.message = this.requireService(greeting).message
            }

            render() {
                return h('output', null, this.message)
            }
        }

        class Parent extends Component {
            render() {
                return h('section', null, h(Child))
            }
        }

        const runtime = createFrayRuntime({services: scope})
        const parent = runtime.mount(runtime.create(Parent), document.body)
        assert.equal(document.querySelector('output')?.textContent, service.message)
        assert.equal(scope.require(greeting), service)
        parent.destroy()
        scope.dispose()
    })

    test('fails before initialization when a declared service is unavailable', () => {
        const required = defineService<object>('required')
        let initialized = false

        class Consumer extends Component {
            static requiredServices = [required]
            initialize(): void {
                initialized = true
            }
            render() {
                return h('div')
            }
        }

        const runtime = createFrayRuntime()
        assert.throws(
            () => runtime.mount(runtime.create(Consumer), document.body),
            /Consumer requires unregistered service "required"/,
        )
        assert.equal(initialized, false)
    })

    test('requires dependencies to be declared and resolved after construction', () => {
        const required = defineService<object>('required')
        const scope = createServiceScope([provideService(required, () => ({}))])

        class Undeclared extends Component {
            initialize(): void {
                this.requireService(required)
            }
            render() {
                return h('div')
            }
        }

        class ConstructorConsumer extends Component {
            constructor() {
                super()
                this.requireService(required)
            }
            render() {
                return h('div')
            }
        }

        const runtime = createFrayRuntime({services: scope})
        assert.throws(
            () => runtime.mount(runtime.create(Undeclared), document.body),
            /must declare service "required"/,
        )
        assert.throws(
            () => runtime.create(ConstructorConsumer),
            /during initialize\(\) or later/,
        )
        scope.dispose()
    })
})
