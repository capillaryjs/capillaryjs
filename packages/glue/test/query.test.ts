import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {
    Emitter,
    FetchState,
    LiveQuery,
    QueryArg,
    RestQueryHandler,
} from '../src/index.js'
import type {
    AbortSignalLike,
    EmitterNotification,
    JsonResponseLike,
    QueryRequestOptions,
} from '../src/index.js'

describe('QueryArg', () => {
    test('mirrors one source and releases it on disposal', () => {
        const source = new Emitter('first')
        const argument = new QueryArg('search', source)
        const notifications: Array<EmitterNotification<string>> = []
        argument.subscribeFutureValues((notification) => notifications.push(notification))

        source.setWithState('second', FetchState.Loading, null)
        assert.equal(argument.name, 'search')
        assert.equal(argument.get(), 'second')
        assert.equal(argument.getFetchState(), FetchState.Loading)
        assert.equal(notifications.length, 1)

        argument.dispose()
        argument.dispose()
        assert.equal(source.subscriberCount, 0)
    })
})

describe('LiveQuery', () => {
    test('performs initial fetch and preserves the last value during refresh', async () => {
        type Arguments = {term: string}
        type Result = string[]
        const requests: Array<{
            args: Arguments
            options: QueryRequestOptions
            request: Deferred<Result>
        }> = []
        const handler = {
            fetch(args: Arguments, options: QueryRequestOptions = {}) {
                const request = deferred<Result>()
                requests.push({args, options, request})
                return request.promise
            },
        }
        const term = new Emitter('first')
        const query = new LiveQuery<Result, {term: Emitter<string>}>({
            handler,
            args: {term},
        })

        assert.equal(query.getFetchState(), FetchState.Loading)
        await nextMicrotask()
        assert.deepEqual(requests[0]?.args, {term: 'first'})
        requests[0]?.request.resolve(['result'])
        await query._activeRequest
        assert.deepEqual(query.get(), ['result'])
        assert.equal(query.getFetchState(), FetchState.Ready)

        term.set('second')
        assert.equal(query.getFetchState(), FetchState.Loading)
        assert.deepEqual(query.get(), ['result'])
        await nextMicrotask()
        requests[1]?.request.resolve(['new result'])
        await query._activeRequest
        assert.deepEqual(query.get(), ['new result'])
    })

    test('aborts an older request and ignores out-of-order results', async () => {
        type Arguments = {page: number}
        const requests: Array<{
            args: Arguments
            signal: AbortSignalLike
            request: Deferred<string>
        }> = []
        const handler = {
            fetch(args: Arguments, {signal}: QueryRequestOptions = {}) {
                assert.ok(signal)
                const request = deferred<string>()
                requests.push({args, signal, request})
                // Deliberately ignore abort so request identity is also tested.
                return request.promise
            },
        }
        const page = new Emitter(1)
        const query = new LiveQuery<string, {page: Emitter<number>}>({
            handler,
            args: {page},
        })
        await nextMicrotask()

        page.set(2)
        await nextMicrotask()
        assert.equal(requests[0]?.signal.aborted, true)
        assert.equal(requests[1]?.signal.aborted, false)

        requests[1]?.request.resolve('new')
        await query._activeRequest
        requests[0]?.request.resolve('stale')
        await nextMicrotask()

        assert.equal(query.get(), 'new')
        assert.equal(query.getFetchState(), FetchState.Ready)
    })

    test('reports thrown errors and retries successfully', async () => {
        let calls = 0
        const failure = new Error('network down')
        const query = new LiveQuery<string>({
            handler: {
                async fetch() {
                    calls += 1
                    if (calls === 1) throw failure
                    return 'recovered'
                },
            },
        })

        await query._activeRequest
        assert.equal(query.getFetchState(), FetchState.Error)
        assert.equal(query.getError(), failure)

        await query.retry()
        assert.equal(query.get(), 'recovered')
        assert.equal(query.getFetchState(), FetchState.Ready)
        assert.equal(query.getError(), null)
    })

    test('can clear prior data during refresh', async () => {
        const requests: Array<Deferred<string>> = []
        const source = new Emitter(1)
        const query = new LiveQuery<string, {source: Emitter<number>}>({
            handler: {
                fetch() {
                    const request = deferred<string>()
                    requests.push(request)
                    return request.promise
                },
            },
            args: {source},
            keepPreviousValue: false,
        })
        await nextMicrotask()
        requests[0]?.resolve('value')
        await query._activeRequest
        source.set(2)
        assert.equal(query.get(), undefined)
        query.dispose()
    })

    test('disposal aborts requests and releases argument subscriptions', async () => {
        const source = new Emitter(1)
        let signal: AbortSignalLike | undefined
        const query = new LiveQuery<never, {source: Emitter<number>}>({
            handler: {
                fetch(_args, options = {}) {
                    signal = options.signal
                    return new Promise<never>(() => {})
                },
            },
            args: {source},
        })
        await nextMicrotask()
        assert.equal(source.subscriberCount, 1)

        query.dispose()
        query.dispose()
        assert.equal(signal?.aborted, true)
        assert.equal(source.subscriberCount, 0)
    })

    test('rejects the imported array argument representation', () => {
        assert.throws(() => new LiveQuery({
            handler: {fetch() { return undefined }},
            // @ts-expect-error Runtime validation remains for JavaScript consumers.
            args: [],
        }), /named record/)
    })
})

describe('RestQueryHandler', () => {
    test('serializes scalar, null, array, and object values generically', async () => {
        type Arguments = {
            search: string
            empty: null
            omitted: undefined
            tag: string[]
            options: {active: boolean}
            none: never[]
        }
        type Result = {ok: boolean}
        const calls: Array<{
            url: string
            options: {signal?: AbortSignalLike | null}
        }> = []
        const handler = new RestQueryHandler<Arguments, Result>({
            url: '/users?existing=yes',
            baseUrl: 'https://example.test/app/',
            fetch: async (url, options) => {
                calls.push({url, options: options ?? {}})
                return response({ok: true})
            },
        })
        const controller = new AbortController()
        const result = await handler.fetch({
            search: 'Ada Lovelace',
            empty: null,
            omitted: undefined,
            tag: ['math', 'code'],
            options: {active: true},
            none: [],
        }, {signal: controller.signal})

        const url = new URL(calls[0]!.url)
        assert.equal(url.origin, 'https://example.test')
        assert.equal(url.pathname, '/users')
        assert.equal(url.searchParams.get('existing'), 'yes')
        assert.equal(url.searchParams.get('search'), 'Ada Lovelace')
        assert.equal(url.searchParams.get('empty'), '')
        assert.equal(url.searchParams.has('omitted'), false)
        assert.deepEqual(url.searchParams.getAll('tag'), ['math', 'code'])
        assert.equal(url.searchParams.get('options'), '{"active":true}')
        assert.equal(url.searchParams.has('none'), false)
        assert.equal(calls[0]!.options.signal, controller.signal)
        assert.deepEqual(result, {ok: true})
    })

    test('supports an injected application serializer', async () => {
        type Arguments = {sort: {field: string; direction: 'asc' | 'desc'}}
        let requested: string | undefined
        const handler = new RestQueryHandler<Arguments, never[]>({
            url: 'https://example.test/users',
            fetch: async (url) => {
                requested = url
                return response([] as never[])
            },
            serialize(url, args) {
                url.searchParams.set('sort', `${args.sort.direction}:${args.sort.field}`)
                return url
            },
        })

        await handler.fetch({sort: {field: 'name', direction: 'desc'}})
        assert.ok(requested)
        assert.equal(new URL(requested).searchParams.get('sort'), 'desc:name')
    })

    test('reports HTTP errors and requires a base for relative URLs', async () => {
        const handler = new RestQueryHandler<Record<string, never>, null>({
            url: 'https://example.test/failure',
            fetch: async () => response(null, {ok: false, status: 503}),
        })
        await assert.rejects(() => handler.fetch({}), (error: unknown) => {
            assert.ok(error instanceof Error)
            assert.equal(error.name, 'HttpError')
            assert.equal(Reflect.get(error, 'status'), 503)
            return true
        })

        const relative = new RestQueryHandler<Record<string, never>, null>({
            url: '/relative',
            fetch: async () => response(null),
        })
        // Node has no global location, so relative resolution is deliberately explicit.
        await assert.rejects(() => relative.fetch({}), /requires baseUrl/)
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

function response<TResult>(
    body: TResult,
    overrides: Partial<JsonResponseLike<TResult>> & {status?: number} = {},
): JsonResponseLike<TResult> {
    return {
        ok: true,
        status: 200,
        async json() {
            return body
        },
        ...overrides,
    }
}
