# Glue

Glue is a small, platform-neutral reactive value and live-query library. Fray
uses it as its state/data-flow layer, but Glue does not depend on Fray, a DOM,
or any UI framework. Its implementation and tests are strict TypeScript; the
ESM build includes declarations and declaration maps.

Install with pnpm:

```bash
pnpm add @sylwellsoftware/glue
```

Glue is ESM-only. Core emitters, derived state, and diagnostics support Node 22+
and modern ESM runtimes without a DOM. `LiveQuery` needs `AbortController`, and
`RestQueryHandler` needs Fetch and URL capabilities unless they are injected.

## Why Glue

Most application values come from a service query, direct user input, or a
calculation over those sources. Those values and their status are real state,
but developers should not have to construct and synchronize a separate
framework-shaped copy of them so that consumers can react.

Glue keeps each value at its natural boundary. A control can write an
`Emitter`, a calculation can expose a `DerivedEmitter`, and a query can react
to argument emitters while exposing its result, loading state, and error. A
consumer reads the downstream value it needs without knowing whether it began
as input, computation, or remote data.

For example, a table header may write a sort emitter. A `LiveQuery` uses that
emitter as an argument, retrieves fresh rows, and emits the new result to the
table. The developer declares this meaningful relationship; Glue handles
propagation, current snapshots, cancellation, and stale-result protection.
Mutation authority, domain rules, transport encoding, service construction,
and ownership/disposal remain explicit application responsibilities.

## Design model

Glue models values that stay current rather than requests that callers must
manually rerun and redistribute. The same small read-side protocol applies to
local state, computed state, query inputs, and asynchronous results:

```ts
interface ReadableEmitter<TValue, TError = unknown> {
    get(): TValue
    getFetchState(): FetchStateValue
    getError(): TError | null
    subscribe(listener: (notification: {
        value: TValue
        fetchState: FetchStateValue
        error: TError | null
        event: EventBubble<unknown> | null
    }) => void): () => void
}
```

That uniformity is the central design constraint. It lets a consumer bind to a
current value without knowing whether the value is mutable, derived, or backed
by asynchronous retrieval. Richer responsibilities remain separate:

| Concept | Responsibility |
| --- | --- |
| `BaseEmitter` | Synchronously readable value/snapshot, subscriptions, mapping, equality, diagnostics, and disposal |
| `Emitter` | An explicitly writable leaf value |
| `DerivedEmitter` | A cached value computed from one or more readable emitters |
| `QueryArg` | A named query-input view over another emitter when a semantic name is useful |
| `LiveQuery` | Reactive request timing, latest-request ownership, status/error state, and cached results |
| `LiveResult` | Common read/dispose contract for remote and locally derived endpoint results |
| `QueryHandler` | Non-reactive retrieval strategy over a plain named argument object |
| `RestQueryHandler` | HTTP URL construction, wire serialization, Fetch execution, and JSON result retrieval |
| `QueryEndpoint` | Immutable declaration that opens caller-owned queries through any handler |
| `RestEndpoint` | Immutable REST query declaration with optional response parsing |
| `DerivedEndpoint` | Immutable local projection declaration that opens caller-owned live results |
| `AsyncCommand` | Abortable mutation lifecycle with explicit concurrency policy |
| `EventBubble` / `EventBus` | Optional cause-and-effect diagnostics without owning application history |

The intended flow is explicit and one-directional:

```text
Emitter(s) ──► DerivedEmitter(s) ──► named query arguments
                                           │
                                           ▼
                                      LiveQuery
                                           │ current plain values
                                           ▼
                                      QueryHandler
                                           │
                                           ▼
                           value + fetch state + error
```

This separation prevents several kinds of accidental coupling:

- leaf values do not need to know that a distant consumer may use them in a
  request;
- derived values express semantic computation rather than transport encoding;
- `LiveQuery` decides *when* the current inputs require retrieval, while its
  handler decides *how* retrieval works;
- REST-specific formats, base URLs, authentication wrappers, and response
  validation remain at application/adapter boundaries;
- one live query can be mapped into multiple local views without multiplying
  network requests.

Glue deliberately favors explicit graphs over hidden tracking, proxy-created
state, hooks, or a global store. If a value can be computed, prefer a
`DerivedEmitter` to manually mirroring it. Use callbacks for commands and
emitters for state that other objects need to read, combine, or observe.

## Emitters

```ts
import {DerivedEmitter, Emitter, FetchState} from '@sylwellsoftware/glue'

const count = new Emitter(1, {purpose: 'count'})
const doubled = new DerivedEmitter([count], ([value]) => value * 2)

const unsubscribe = doubled.subscribe(({value, fetchState, error, event}) => {
  console.log({value, fetchState, error, event})
})

count.set(2)
unsubscribe()
doubled.dispose()
```

A local `Emitter` defaults to `FetchState.Ready`. `setWithState()` notifies when
the value, fetch state, or error changes. Values use `Object.is` equality unless
the `equals` option supplies a comparator. `subscribe()` emits the current
snapshot by default; `subscribe(listener, {emitCurrent: false})` and
`subscribeFutureValues(listener)` observe only future snapshots. Unsubscribe
functions and `dispose()` are idempotent.

Every notification has one shape:

```ts
{ value, fetchState, error, event }
```

`DerivedEmitter` passes source values—including `null` and `undefined`—to its
compute function in source order. With no sources it computes once with `[]` and
is ready. A thrown compute function produces error state. Source errors are a
stable array of `{sourceIndex, error}` entries; a compute failure uses
`sourceIndex: null`. State precedence is `error > loading > initial > ready`.
Replacing sources releases every old subscription, and disposal releases the
current ones.

`emitter.map(fn)` transforms the complete value. `emitter.mapEach(fn)` requires
an array and transforms its non-nullish members.

### Ownership, equality, and disposal

Emitters eagerly cache their current snapshot so reads are synchronous.
`Object.is` is the default value equality rule; pass `equals` when the domain
has a better equivalence relation. A derived emitter subscribes eagerly to its
sources and releases those subscriptions when sources are replaced or the
derived value is disposed.

The object that creates a long-lived emitter/query normally owns its disposal.
Disposal is idempotent, prevents new subscriptions, and releases owned source
subscriptions. A UI or service lifecycle should therefore dispose the graph it
constructs rather than relying on garbage collection to sever active edges.

## Query arguments

`LiveQuery` accepts a named record of any readable emitters, so wrapping every
input in `QueryArg` is neither required nor desirable. Use `QueryArg` when a
stable query-facing name and separately owned bridge clarify the boundary:

```ts
import {DerivedEmitter, Emitter, LiveQuery, QueryArg} from '@sylwellsoftware/glue'

const firstName = new Emitter('Ada')
const lastName = new Emitter('Lovelace')
const searchText = new DerivedEmitter(
    [firstName, lastName] as const,
    ([first, last]) => `${first} ${last}`,
)
const search = new QueryArg('search', searchText)
const users = new LiveQuery({handler, args: {search}})
```

Here the leaf emitters know nothing about querying, and the computation knows
nothing about REST. Dispose `users`, `search`, and `searchText` at the lifetime
boundary that created them.

## Live queries

```js
import {Emitter, LiveQuery, RestQueryHandler} from '@sylwellsoftware/glue'

const search = new Emitter('ada')
const handler = new RestQueryHandler({
  url: '/api/users',
  baseUrl: 'https://example.test/',
  fetch: globalThis.fetch,
})

const users = new LiveQuery({handler, args: {search}})
```

Arguments are a named record of emitters. Construction fetches immediately
unless `autoFetch: false`; `refresh()` and `retry()` return the active request
promise. A newer request aborts and supersedes the older request, and stale
results cannot overwrite current state. `abort()` cancels without disposing;
`dispose()` aborts the active request and releases argument subscriptions.

By default the last successful value remains visible while refreshing and after
a refresh error. Set `keepPreviousValue: false` to clear it while loading or in
error state.

Polling is opt-in and waits one full interval before the first poll:

```ts
const pollingEnabled = new Emitter(true)
const intervalMs = new Emitter(5_000)
const users = new LiveQuery({
    handler,
    args: {search},
    polling: {enabled: pollingEnabled, intervalMs},
})
```

`enabled` and `intervalMs` may be constants or readable emitters. A changed
control restarts the timer from that change. A tick is skipped while a request
is active; the next normal tick remains scheduled. Errors do not cause an
immediate retry or backoff, but polling continues while enabled. Disposal
releases the timer and control subscriptions. Applications can feed page
visibility or any other policy into `enabled`; Glue never reads the DOM. Tests
and nonstandard runtimes may inject `PollingScheduler`.

The REST adapter accepts injected `fetch`, `baseUrl`, and `serialize` behavior.
Its generic serializer omits `undefined` and empty arrays, encodes `null` as an
empty value, repeats keys for arrays, JSON-encodes objects, and stringifies
scalars. Application-specific table filter/sort formats belong in an injected
serializer, not Glue. A result generic alone does not validate JSON. Supply
`parseResult(json: unknown)` to decode or validate immediately after JSON
parsing. A thrown parser error becomes the `LiveQuery` error, and Glue does not
include the raw response body in its diagnostics.

## Service endpoint declarations

Applications may group immutable endpoint declarations in ordinary service
classes. Glue does not register, locate, construct, or cache services; the
application chooses and constructs its service scope. Fray applications may
expose those services through Fray's typed runtime `ServiceScope`; non-Fray
applications use their own explicit composition. Every `open()` call creates a
caller-owned result with independent arguments, request state, polling, and
disposal.

```ts
import {DerivedEndpoint, RestEndpoint} from '@sylwellsoftware/glue'

class MovieService {
    readonly movies = new RestEndpoint<{genre: string}, readonly Movie[]>({
        url: '/api/movies',
        parseResult: parseMovies,
    })

    readonly matchingMovies = new DerivedEndpoint<
        readonly Movie[],
        {genre: string},
        readonly Movie[]
    >({
        apply: (movies, {genre}) => movies.filter((movie) => movie.genre === genre),
    })
}

const service = new MovieService()
const remote = service.movies.open({genre})
const local = service.matchingMovies.open({source: cachedMovies, args: {genre}})
```

Both results implement `LiveResult`, so a UI that only reads value, fetch
state, error, and subscriptions can accept either. `LiveQuery` additionally
implements `RefreshableLiveResult` with `refresh()`, `retry()`, and `abort()`.

For a query-like body protocol such as GraphQL, put a custom handler in a
`QueryEndpoint`. The handler owns method, headers, authentication, body
serialization, response checks, validation, and safe diagnostics:

```ts
import {QueryEndpoint} from '@sylwellsoftware/glue'

const projectStatus = new QueryEndpoint<{id: string}, ProjectStatus>({
    handler: {
        async fetch({id}, {signal} = {}) {
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({query: STATUS_QUERY, variables: {id}}),
                signal,
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return parseProjectStatus(await response.json())
        },
    },
})
```

Ordinary POST/PUT/PATCH/DELETE mutations belong in `AsyncCommand` executors,
not auto-running query declarations.

## Optional tracing

Tracing allocates no event when an emitter has `trace: false`, no diagnostic
observer is subscribed, and no parent event is supplied. Subscribe with
`EventBus.subscribe(listener)` to observe top-level events. Events have stable
process-local IDs, timestamps, weak owner references where supported, and
explicit parent/child causality. The bus retains neither event history nor
owners; its unsubscribe function is idempotent.

Tracing follows the same design as data flow: mutation, derivation, query
start, and query completion can retain explicit parent/child causality without
turning diagnostics into a second execution system. Applications decide
whether to retain, render, or export observed events.

## Async commands

`AsyncCommand` is exported from Glue's package root. It is an abortable
mutation lifecycle with explicit `ignore`, `replace`, and `reject` concurrency
policies. It exposes the last result/error through the standard emitter
snapshot and a read-only `isRunning` view. It deliberately does not own batch
progress, retries, notifications, or UI behavior. Executor completion alone
determines command success. The application may then refresh affected queries;
their failures remain in their own query snapshots:

```ts
const saved = await saveCommand.run(update)
if (saved !== undefined) {
    await Promise.all([users.refresh('save reconciled'), audit.refresh('save reconciled')])
}
```

## Integration with Fray and other consumers

Glue's UI seam is intentionally just the readable/writable emitter protocol.
A typical Fray path is:

```text
browser event
    └──► Fray control writes an Emitter
              └──► DerivedEmitter computes shared/domain state
                        ├──► Fray renders a local view
                        └──► LiveQuery refreshes through a handler
                                      └──► Fray renders query snapshot state
```

Leaf controls should normally receive ordinary writable emitters, not
`QueryArg` objects. The component or service that understands an aggregate
interaction owns its derived value. The data-aware consumer owns the query
bridge and watches the result it actually renders. This keeps UI components
reusable for local state, static data, remote data, and tests.

Fray's theme and color selection is not a Glue feature. An application may
store selected theme/color identifiers in ordinary Glue emitters when it wants
observable or persistent selection state, but Fray and the browser remain
responsible for CSS assets, stylesheet links, and rendering.

Nothing in this contract is Fray-specific: another UI framework, a CLI, a Node
service, or a test can consume the same emitters and live queries.

## Local checks

```text
pnpm --filter @sylwellsoftware/glue test
pnpm --filter @sylwellsoftware/glue typecheck
pnpm --filter @sylwellsoftware/glue build
pnpm --filter @sylwellsoftware/glue test:types:consumer
```

Glue intentionally does not own a DOM renderer, component lifecycle,
application-specific query encoding, persistent event history, CommonJS build,
or framework adapter. Fray consumes Glue as a peer; browser UI belongs there.

See the [workspace overview](../../README.md), [API
surface](../../docs/API_SURFACE.md), [changelog](CHANGELOG.md),
[contribution guide](../../CONTRIBUTING.md), and [security
policy](../../SECURITY.md).
