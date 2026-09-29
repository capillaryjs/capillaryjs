import assert from 'node:assert/strict'
import {test} from 'node:test'

import {
    AsyncCommand,
    bindCommand,
    connect,
    Emitter,
    FetchState,
    valueChanges,
    writableProjection,
} from '../src/index.js'

test('connect writes an explicit value only for future command success', async () => {
    const command = new AsyncCommand<number, number>({execute: (value) => value})
    const search = new Emitter('matching')
    const disconnect = connect({on: command.succeeded, target: search, value: () => ''})

    await command.run(1)
    assert.equal(search.get(), '')
    search.set('again')
    disconnect()
    await command.run(2)
    assert.equal(search.get(), 'again')
    command.dispose()
})

test('valueChanges omits state-only notifications and supports domain equality', () => {
    const source = new Emitter<{revision: number, state: string}>({revision: 1, state: 'ready'})
    const values: number[] = []
    const unsubscribe = valueChanges(source, {
        equals: (previous, next) => previous.revision === next.revision,
    }).subscribe(({value}) => values.push(value.revision))

    source.setWithState({revision: 1, state: 'loading'}, FetchState.Loading, null)
    source.set({revision: 2, state: 'ready'})
    assert.deepEqual(values, [2])
    unsubscribe()
})

test('connect filters occurrences, isolates action failures, and detects synchronous cycles', async () => {
    const command = new AsyncCommand<number, number>({execute: (value) => value})
    const target = new Emitter(0)
    const errors: unknown[] = []
    connect({
        on: command.succeeded,
        target,
        when: ({arguments: value}) => value > 1,
        value: ({result}) => result,
        onError: (error) => errors.push(error),
    })
    await command.run(1)
    assert.equal(target.get(), 0)
    await command.run(2)
    assert.equal(target.get(), 2)

    const cycleErrors: unknown[] = []
    let reconnect: () => void = () => undefined
    reconnect = connect({
        on: valueChanges(target),
        target,
        value: ({value}) => value + 1,
        onError: (error) => cycleErrors.push(error),
    })
    target.set(3)
    assert.equal(target.get(), 4)
    assert.equal(cycleErrors.length, 1)
    reconnect()
    command.dispose()
    assert.deepEqual(errors, [])
})

test('connection errors remain observable without diagnostics or an error callback', async () => {
    const command = new AsyncCommand<void, void>({execute: () => undefined})
    const connection = connect({
        on: command.succeeded,
        action: () => { throw new Error('refresh failed') },
    })
    const errors: Error[] = []
    connection.errors.subscribe(({error}) => errors.push(error as Error))

    await command.run()
    assert.equal(errors.length, 1)
    assert.equal(errors[0]?.message, 'refresh failed')
    connection()
    command.dispose()
})

test('a throwing connection error callback cannot re-enter the source operation', async () => {
    const command = new AsyncCommand<void, void>({execute: () => undefined})
    const connection = connect({
        on: command.succeeded,
        action: () => { throw new Error('follow-up failed') },
        onError: () => { throw new Error('reporter failed') },
    })
    const errors: unknown[] = []
    connection.errors.subscribe(({error}) => errors.push(error))

    await command.run()
    assert.equal(command.getFetchState(), FetchState.Ready)
    assert.equal(errors.length, 1)
    connection()
    command.dispose()
})

test('bindCommand samples sources at invocation rather than on source writes', async () => {
    const draft = new Emitter('first')
    const received: string[] = []
    const command = new AsyncCommand<{draft: string}, string>({
        execute: ({draft: value}) => {
            received.push(value)
            return value
        },
    })
    const submit = bindCommand(command, {draft})

    draft.set('second')
    assert.deepEqual(received, [])
    assert.equal(await submit(), 'second')
    command.dispose()
})

test('writableProjection writes through immutable application logic and releases its source', () => {
    const source = new Emitter({name: 'before', count: 1})
    const name = writableProjection(source, {
        read: (value) => value.name,
        write: (value, nextName) => ({...value, name: nextName}),
    })

    name.set('after')
    assert.deepEqual(source.get(), {name: 'after', count: 1})
    source.set({name: 'external', count: 2})
    assert.equal(name.get(), 'external')
    name.dispose()
    assert.equal(source.subscriberCount, 0)
})

test('writableProjection supports composition and leaves source unchanged after write failure', () => {
    const source = new Emitter({profile: {name: 'Ada', enabled: true}, count: 1})
    const profile = writableProjection(source, {
        read: (value) => value.profile,
        write: (value, nextProfile) => ({...value, profile: nextProfile}),
    })
    const errors: unknown[] = []
    const name = writableProjection(profile, {
        read: (value) => value.name,
        write: (value, nextName) => {
            if (nextName === '') throw new Error('name required')
            return {...value, name: nextName}
        },
        onError: (error) => errors.push(error),
    })

    name.set('Grace')
    assert.deepEqual(source.get(), {profile: {name: 'Grace', enabled: true}, count: 1})
    assert.equal(name.set(''), false)
    assert.deepEqual(source.get(), {profile: {name: 'Grace', enabled: true}, count: 1})
    assert.equal(errors.length, 1)
    name.dispose()
    profile.dispose()
})
