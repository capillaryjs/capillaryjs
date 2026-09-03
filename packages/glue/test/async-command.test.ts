import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {FetchState} from '../src/index.js'
import {
    AsyncCommand,
    AsyncCommandConcurrencyError,
} from '../src/index.js'
import type {AsyncCommandContext} from '../src/index.js'

describe('AsyncCommand', () => {
    test('publishes one traced lifecycle snapshot and a readable running view', async () => {
        const request = deferred<number>()
        let context: AsyncCommandContext | undefined
        const command = new AsyncCommand<string, number>({
            purpose: 'save record',
            trace: true,
            execute(arguments_, nextContext) {
                assert.equal(arguments_, 'record-1')
                context = nextContext
                return request.promise
            },
        })

        const execution = command.run('record-1', 'save clicked')
        assert.equal(command.get(), undefined)
        assert.equal(command.getFetchState(), FetchState.Loading)
        assert.equal(command.getError(), null)
        assert.equal(command.isRunning.get(), true)
        await nextMicrotask()
        assert.equal(context?.signal.aborted, false)
        assert.ok(context?.event)

        request.resolve(42)
        assert.equal(await execution, 42)
        assert.equal(command.get(), 42)
        assert.equal(command.getFetchState(), FetchState.Ready)
        assert.equal(command.isRunning.get(), false)
        command.dispose()
    })

    test('ignores duplicate runs by default and returns the active promise', async () => {
        const request = deferred<string>()
        let calls = 0
        const command = new AsyncCommand<number, string>({
            execute() {
                calls += 1
                return request.promise
            },
        })

        const first = command.run(1)
        const ignored = command.run(2)
        assert.equal(ignored, first)
        await nextMicrotask()
        assert.equal(calls, 1)
        request.resolve('first')
        assert.equal(await ignored, 'first')
        command.dispose()
    })

    test('replace aborts the prior signal and suppresses its stale completion', async () => {
        const requests: Array<{
            arguments_: string
            context: AsyncCommandContext
            deferred: Deferred<string>
        }> = []
        const command = new AsyncCommand<string, string>({
            concurrency: 'replace',
            execute(arguments_, context) {
                const pending = deferred<string>()
                requests.push({arguments_, context, deferred: pending})
                return pending.promise
            },
        })

        const first = command.run('first')
        await nextMicrotask()
        const second = command.run('second')
        await nextMicrotask()
        assert.equal(requests[0]?.context.signal.aborted, true)
        assert.equal(requests[1]?.context.signal.aborted, false)

        requests[1]?.deferred.resolve('current')
        assert.equal(await second, 'current')
        requests[0]?.deferred.resolve('stale')
        assert.equal(await first, undefined)
        assert.equal(command.get(), 'current')
        assert.equal(command.getFetchState(), FetchState.Ready)
        command.dispose()
    })

    test('can reject a concurrent invocation without disturbing active state', async () => {
        const request = deferred<number>()
        const command = new AsyncCommand<void, number>({
            concurrency: 'reject',
            execute: () => request.promise,
        })
        const active = command.run()
        await assert.rejects(
            command.run(),
            (error: unknown) => error instanceof AsyncCommandConcurrencyError,
        )
        assert.equal(command.getFetchState(), FetchState.Loading)
        request.resolve(1)
        assert.equal(await active, 1)
        command.dispose()
    })

    test('retains the last result on mapped errors and reset clears the snapshot', async () => {
        const failure = new Error('network down')
        let shouldFail = false
        const command = new AsyncCommand<void, number, string>({
            mapError: (error) => error instanceof Error ? error.message : String(error),
            execute() {
                if (shouldFail) throw failure
                return 7
            },
        })

        assert.equal(await command.run(), 7)
        shouldFail = true
        assert.equal(await command.run(), undefined)
        assert.equal(command.get(), 7)
        assert.equal(command.getFetchState(), FetchState.Error)
        assert.equal(command.getError(), 'network down')

        command.reset()
        assert.equal(command.get(), undefined)
        assert.equal(command.getFetchState(), FetchState.Initial)
        assert.equal(command.getError(), null)
        command.dispose()
    })

    test('abort and disposal cancel work, suppress settlement, and are idempotent', async () => {
        const requests: Array<{context: AsyncCommandContext; deferred: Deferred<number>}> = []
        const command = new AsyncCommand<void, number>({
            execute(_arguments, context) {
                const pending = deferred<number>()
                requests.push({context, deferred: pending})
                return pending.promise
            },
        })

        const aborted = command.run()
        await nextMicrotask()
        assert.equal(command.abort(), true)
        assert.equal(command.abort(), false)
        assert.equal(requests[0]?.context.signal.aborted, true)
        assert.equal(command.getFetchState(), FetchState.Initial)
        assert.equal(command.isRunning.get(), false)
        requests[0]?.deferred.resolve(1)
        assert.equal(await aborted, undefined)

        const disposed = command.run()
        await nextMicrotask()
        command.dispose()
        command.dispose()
        assert.equal(requests[1]?.context.signal.aborted, true)
        requests[1]?.deferred.resolve(2)
        assert.equal(await disposed, undefined)
        assert.equal(command.disposed, true)
        assert.equal(command.isRunning.get(), false)
        assert.throws(() => command.subscribe(() => {}), /disposed/)
        assert.equal(await command.run(), undefined)
    })

    test('validates options and concurrency policies for JavaScript callers', () => {
        assert.throws(() => new AsyncCommand({
            // @ts-expect-error Runtime guard retained for JavaScript consumers.
            execute: null,
        }), /execute/)
        assert.throws(() => new AsyncCommand({
            execute: () => 1,
            // @ts-expect-error Runtime guard retained for JavaScript consumers.
            concurrency: 'queue',
        }), /concurrency policy/)
    })
})

interface Deferred<TValue> {
    promise: Promise<TValue>
    resolve(value: TValue | PromiseLike<TValue>): void
    reject(reason?: unknown): void
}

function deferred<TValue>(): Deferred<TValue> {
    let resolve!: Deferred<TValue>['resolve']
    let reject!: Deferred<TValue>['reject']
    const promise = new Promise<TValue>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return {promise, resolve, reject}
}

function nextMicrotask(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve))
}
