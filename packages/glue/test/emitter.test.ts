import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {
    DerivedEmitter,
    Emitter,
    EventBubble,
    EventBus,
    FetchState,
} from '../src/index.js'
import type {EmitterNotification, EventBubble as EventBubbleType} from '../src/index.js'

describe('Emitter', () => {
    test('uses ready local state and one structured payload shape', () => {
        const emitter = new Emitter('first')
        const notifications: Array<EmitterNotification<string>> = []

        const unsubscribe = emitter.subscribe((notification) => {
            notifications.push(notification)
        })
        emitter.set('second')

        assert.equal(emitter.getFetchState(), FetchState.Ready)
        assert.deepEqual(notifications.map(withoutEvent), [
            {value: 'first', fetchState: FetchState.Ready, error: null},
            {value: 'second', fetchState: FetchState.Ready, error: null},
        ])
        assert.ok(notifications.every((notification) =>
            Object.keys(notification).sort().join(',') === 'error,event,fetchState,value'))

        unsubscribe()
        unsubscribe()
        emitter.set('third')
        assert.equal(notifications.length, 2)
    })

    test('future subscriptions skip current state', () => {
        const emitter = new Emitter(1)
        const values: number[] = []
        emitter.subscribeFutureValues(({value}) => values.push(value))
        assert.deepEqual(values, [])
        emitter.set(2)
        assert.deepEqual(values, [2])
    })

    test('notifies for state and error changes when value is equal', () => {
        const error = new Error('offline')
        const emitter = new Emitter<string, Error>('cached')
        const notifications: Array<EmitterNotification<string, Error>> = []
        emitter.subscribeFutureValues((notification) => notifications.push(notification))

        assert.equal(
            emitter.setWithState('cached', FetchState.Loading, null),
            true,
        )
        assert.equal(
            emitter.setWithState('cached', FetchState.Error, error),
            true,
        )
        assert.equal(
            emitter.setWithState('cached', FetchState.Error, error),
            false,
        )

        assert.deepEqual(notifications.map(({fetchState}) => fetchState), [
            FetchState.Loading,
            FetchState.Error,
        ])
    })

    test('supports a custom value comparator', () => {
        const emitter = new Emitter({id: 1, label: 'first'}, {
            equals: (left, right) => left?.id === right?.id,
        })
        let count = 0
        emitter.subscribeFutureValues(() => count += 1)

        emitter.set({id: 1, label: 'equivalent'})
        emitter.set({id: 2, label: 'different'})

        assert.equal(count, 1)
        assert.equal(emitter.get().id, 2)
    })

    test('disposal is idempotent and blocks new subscriptions', () => {
        const emitter = new Emitter(1)
        let calls = 0
        emitter.subscribeFutureValues(() => calls += 1)

        emitter.dispose()
        emitter.dispose()
        emitter.set(2)

        assert.equal(calls, 0)
        assert.equal(emitter.subscriberCount, 0)
        assert.throws(() => emitter.subscribe(() => {}), /disposed/)
    })
})

describe('DerivedEmitter', () => {
    test('uses error > loading > initial > ready precedence', () => {
        const ready = new Emitter(1)
        const initial = new Emitter(2, {fetchState: FetchState.Initial})
        const loading = new Emitter(3, {fetchState: FetchState.Loading})
        const failed = new Emitter(4, {
            fetchState: FetchState.Error,
            error: new Error('failed'),
        })

        const derived = new DerivedEmitter(
            [ready, initial, loading, failed] as const,
            (values) => values.reduce((sum, value) => sum + value, 0),
        )

        assert.equal(derived.get(), 10)
        assert.equal(derived.getFetchState(), FetchState.Error)
        assert.deepEqual(derived.getError()?.map(({sourceIndex}) => sourceIndex), [3])

        failed.set(4)
        assert.equal(derived.getFetchState(), FetchState.Loading)
        loading.set(3)
        assert.equal(derived.getFetchState(), FetchState.Initial)
        initial.set(2)
        assert.equal(derived.getFetchState(), FetchState.Ready)
    })

    test('keeps an equivalent error aggregate stable', () => {
        const error = new Error('same')
        const source = new Emitter(1, {fetchState: FetchState.Error, error})
        const derived = new DerivedEmitter([source] as const, ([value]) => value)
        const aggregate = derived.getError()
        let notifications = 0
        derived.subscribeFutureValues(() => notifications += 1)

        // A custom source update that computes the same derived value/error.
        source.setWithState(2, FetchState.Error, error)
        source.setWithState(1, FetchState.Error, error)

        assert.equal(derived.getError(), aggregate)
        assert.equal(notifications, 2)
    })

    test('defines zero sources and thrown compute functions', () => {
        const empty = new DerivedEmitter([] as const, () => 42)
        assert.equal(empty.get(), 42)
        assert.equal(empty.getFetchState(), FetchState.Ready)
        assert.equal(empty.getError(), null)

        const failure = new Error('compute failed')
        const thrown = new DerivedEmitter([] as const, () => { throw failure })
        assert.equal(thrown.getFetchState(), FetchState.Error)
        assert.deepEqual(thrown.getError(), [{sourceIndex: null, error: failure}])
    })

    test('releases old sources during replacement and disposal', () => {
        const first = new Emitter(2)
        const second = new Emitter(3)
        const derived = new DerivedEmitter([first] as const, ([value]) => value * 2)

        assert.equal(first.subscriberCount, 1)
        derived.setSourcesAndCompute([second] as const, ([value]) => value * 3)
        assert.equal(first.subscriberCount, 0)
        assert.equal(second.subscriberCount, 1)
        assert.equal(derived.get(), 9)

        first.set(10)
        assert.equal(derived.get(), 9)
        derived.dispose()
        derived.dispose()
        assert.equal(second.subscriberCount, 0)
    })

    test('separates whole-value map from collection mapEach', () => {
        const scalar = new Emitter(2)
        const doubled = scalar.map((value) => value * 2)
        assert.equal(doubled.get(), 4)

        const collection = new Emitter([1, null, 3])
        const doubledMembers = collection.mapEach((value) => value * 2)
        assert.deepEqual(doubledMembers.get(), [2, null, 6])

        // @ts-expect-error Runtime guard retained for untyped JavaScript consumers.
        const invalid = scalar.mapEach((value) => value)
        assert.equal(invalid.getFetchState(), FetchState.Error)
        const invalidError = invalid.getError()?.[0]?.error
        assert.ok(invalidError instanceof Error)
        assert.match(invalidError.message, /array/)
    })
})

describe('diagnostic events', () => {
    test('supports multiple observers and parent-child causality', () => {
        const first: EventBubbleType<unknown>[] = []
        const second: EventBubbleType<unknown>[] = []
        const unsubscribeFirst = EventBus.subscribe((event) => first.push(event))
        const unsubscribeSecond = EventBus.subscribe((event) => second.push(event))
        const emitter = new Emitter(0, {purpose: 'count', trace: true})
        const notifications: Array<EmitterNotification<number>> = []
        emitter.subscribeFutureValues((notification) => notifications.push(notification))

        emitter.set(1, 'user action')
        assert.equal(first.length, 1)
        assert.equal(second.length, 1)
        assert.equal(first[0], second[0])
        const root = first[0]
        assert.ok(root)
        assert.match(root.id, /^event-\d+$/)
        assert.equal(typeof root.timestamp, 'number')

        const childEmitter = new Emitter('a', {trace: true})
        childEmitter.set('b', root)
        assert.equal(root.children.length, 1)
        assert.equal(root.children[0]?.parent, root)

        unsubscribeFirst()
        unsubscribeFirst()
        emitter.set(2)
        assert.equal(first.length, 1)
        assert.equal(second.length, 2)
        unsubscribeSecond()
    })

    test('does not allocate events when tracing has no observer or parent', () => {
        assert.equal(EventBus.subscriberCount, 0)
        const emitter = new Emitter(0)
        let notification: EmitterNotification<number> | undefined
        emitter.subscribeFutureValues((next) => { notification = next })
        emitter.set(1)
        assert.equal(notification?.event, null)
    })

    test('accepts explicit event options', () => {
        const owner = {}
        const parent = new EventBubble({owner, purpose: 'root', value: 1})
        const child = new EventBubble({owner, purpose: 'child', parent})
        assert.equal(child.owner, owner)
        assert.equal(parent.children[0], child)
    })
})

function withoutEvent<TValue, TError>({
    value,
    fetchState,
    error,
}: EmitterNotification<TValue, TError>) {
    return {value, fetchState, error}
}
