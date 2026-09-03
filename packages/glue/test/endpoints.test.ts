import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {
    DerivedEndpoint,
    Emitter,
    FetchState,
    LiveQuery,
    QueryEndpoint,
    RestEndpoint,
    RestQueryHandler,
} from '../src/index.js'
import type {
    JsonResponseLike,
    PollingScheduler,
    QueryRequestOptions,
} from '../src/index.js'

describe('endpoint declarations', () => {
    test('opens independently owned REST queries and parses results at the endpoint', async () => {
        type Arguments = {search: string}
        type Item = {id: number; title: string}
        const endpoint = new RestEndpoint<Arguments, Item[]>({
            url: '/movies',
            baseUrl: 'https://example.test/',
            fetch: async () => response([{id: 1, title: 'First'}]),
            parseResult(value) {
                if (!Array.isArray(value)) throw new TypeError('Expected movies array')
                return value.map((item) => {
                    if (item == null || typeof item !== 'object') {
                        throw new TypeError('Expected movie object')
                    }
                    const id = Reflect.get(item, 'id')
                    const title = Reflect.get(item, 'title')
                    if (typeof id !== 'number' || typeof title !== 'string') {
                        throw new TypeError('Invalid movie')
                    }
                    return {id, title}
                })
            },
        })
        const firstSearch = new Emitter('first')
        const secondSearch = new Emitter('second')
        const first = endpoint.open({search: firstSearch})
        const second = endpoint.open({search: secondSearch})

        await Promise.all([first._activeRequest, second._activeRequest])
        assert.deepEqual(first.get(), [{id: 1, title: 'First'}])
        assert.deepEqual(second.get(), [{id: 1, title: 'First'}])
        first.dispose()
        assert.equal(firstSearch.subscriberCount, 0)
        assert.equal(secondSearch.subscriberCount, 1)
        second.dispose()
    })

    test('declares body-backed queries through a custom handler without owning transport policy',
        async () => {
            type Arguments = {projectPath: string}
            type Result = {status: string}
            const requests: Array<{
                body: string
                hasEvent: boolean
                signalAborted: boolean
            }> = []
            const endpoint = new QueryEndpoint<Arguments, Result>({
                handler: {
                    async fetch({projectPath}, {event, signal} = {}) {
                        const body = JSON.stringify({
                            query: 'query Status($projectPath: ID!) { status(project: $projectPath) }',
                            variables: {projectPath},
                        })
                        requests.push({
                            body,
                            hasEvent: event != null,
                            signalAborted: signal?.aborted ?? false,
                        })
                        return {status: 'complete'}
                    },
                },
                query: {autoFetch: false, purpose: 'project status', trace: true},
            })
            assert.equal(Object.isFrozen(endpoint), true)
            const projectPath = new Emitter('group/project')
            const result = endpoint.open({projectPath})

            assert.equal(result.getFetchState(), FetchState.Initial)
            await result.refresh()
            assert.deepEqual(result.get(), {status: 'complete'})
            assert.equal(requests[0]?.hasEvent, true)
            assert.equal(requests[0]?.signalAborted, false)
            assert.match(requests[0]?.body ?? '', /group\/project/)
            result.dispose()
        })

    test('derived endpoints react locally and retain their last value with source state', () => {
        type Movie = {title: string; genre: string}
        const endpoint = new DerivedEndpoint<Movie[], {genre: string}, Movie[]>({
            purpose: 'movies by genre',
            apply: (movies, {genre}) => movies.filter((movie) => movie.genre === genre),
        })
        const source = new Emitter<Movie[]>([
            {title: 'One', genre: 'drama'},
            {title: 'Two', genre: 'comedy'},
        ])
        const genre = new Emitter('drama')
        const result = endpoint.open({source, args: {genre}})

        assert.deepEqual(result.get(), [{title: 'One', genre: 'drama'}])
        genre.set('comedy')
        assert.deepEqual(result.get(), [{title: 'Two', genre: 'comedy'}])

        source.setWithState(source.get(), FetchState.Loading, null)
        assert.equal(result.getFetchState(), FetchState.Loading)
        assert.deepEqual(result.get(), [{title: 'Two', genre: 'comedy'}])

        const failure = new Error('source failed')
        source.setWithState(source.get(), FetchState.Error, failure)
        assert.equal(result.getFetchState(), FetchState.Error)
        assert.equal(result.getError(), failure)
        assert.deepEqual(result.get(), [{title: 'Two', genre: 'comedy'}])

        result.dispose()
        assert.equal(source.subscriberCount, 0)
        assert.equal(genre.subscriberCount, 0)
    })

    test('parsing failures become normal LiveQuery errors without exposing response data', async () => {
        const privateResponse = {secret: 'not retained'}
        const handler = new RestQueryHandler<Record<string, never>, string>({
            url: 'https://example.test/private',
            fetch: async () => response(privateResponse),
            parseResult() {
                throw new TypeError('Invalid response contract')
            },
        })
        const query = new LiveQuery({handler})
        await query._activeRequest

        assert.equal(query.getFetchState(), FetchState.Error)
        assert.match(String(query.getError()), /Invalid response contract/)
        assert.doesNotMatch(String(query.getError()), /not retained/)
    })
})

describe('LiveQuery polling', () => {
    test('reacts to enablement and intervals, skips overlap, and releases timers', async () => {
        const scheduler = new ManualScheduler()
        const enabled = new Emitter(false)
        const intervalMs = new Emitter(1000)
        const requests: Array<Deferred<number>> = []
        const query = new LiveQuery<number>({
            autoFetch: false,
            handler: {
                fetch(_args, _options: QueryRequestOptions = {}) {
                    const request = deferred<number>()
                    requests.push(request)
                    return request.promise
                },
            },
            polling: {enabled, intervalMs, scheduler},
        })

        assert.equal(scheduler.pending, 0)
        enabled.set(true)
        assert.deepEqual(scheduler.delays, [1000])
        scheduler.runNext()
        assert.equal(requests.length, 0)
        await nextMicrotask()
        assert.equal(requests.length, 1)

        scheduler.runNext()
        await nextMicrotask()
        assert.equal(requests.length, 1)
        requests[0]?.resolve(1)
        await query._activeRequest

        intervalMs.set(250)
        assert.equal(scheduler.lastDelay, 250)
        scheduler.runNext()
        await nextMicrotask()
        assert.equal(requests.length, 2)
        requests[1]?.reject(new Error('temporary'))
        await query._activeRequest
        assert.equal(query.getFetchState(), FetchState.Error)

        scheduler.runNext()
        await nextMicrotask()
        assert.equal(requests.length, 3)
        query.dispose()
        assert.equal(scheduler.pending, 0)
        assert.equal(enabled.subscriberCount, 0)
        assert.equal(intervalMs.subscriberCount, 0)
    })

    test('validates reactive polling controls before scheduling', () => {
        const scheduler = new ManualScheduler()
        assert.throws(() => new LiveQuery({
            autoFetch: false,
            handler: {fetch: () => 1},
            polling: {intervalMs: 0, scheduler},
        }), /finite positive/)
        assert.equal(scheduler.pending, 0)
    })

    test('abort returns to the last settled state and suppresses late completion', async () => {
        const first = deferred<string>()
        const second = deferred<string>()
        let current = first
        const query = new LiveQuery<string>({
            handler: {fetch: () => current.promise},
            keepPreviousValue: false,
        })
        await nextMicrotask()
        first.resolve('settled')
        await query._activeRequest
        current = second
        void query.refresh()
        await nextMicrotask()
        query.abort()
        assert.equal(query.get(), 'settled')
        assert.equal(query.getFetchState(), FetchState.Ready)
        second.resolve('late')
        await nextMicrotask()
        assert.equal(query.get(), 'settled')
        assert.equal(query.getFetchState(), FetchState.Ready)
    })
})

class ManualScheduler implements PollingScheduler {
    private nextId = 0
    private readonly callbacks = new Map<number, () => void>()
    readonly delays: number[] = []

    get pending(): number {
        return this.callbacks.size
    }

    get lastDelay(): number | undefined {
        return this.delays.at(-1)
    }

    schedule(callback: () => void, delayMs: number): number {
        const id = ++this.nextId
        this.callbacks.set(id, callback)
        this.delays.push(delayMs)
        return id
    }

    cancel(handle: unknown): void {
        if (typeof handle === 'number') this.callbacks.delete(handle)
    }

    runNext(): void {
        const entry = this.callbacks.entries().next().value as [number, () => void] | undefined
        if (entry == null) throw new Error('No scheduled callback')
        const [id, callback] = entry
        this.callbacks.delete(id)
        callback()
    }
}

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

function response<TResult>(body: TResult): JsonResponseLike<TResult> {
    return {
        ok: true,
        status: 200,
        async json() {
            return body
        },
    }
}
