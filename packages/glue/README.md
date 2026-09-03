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
| `QueryHandler` | Non-reactive retrieval strategy over a plain named argument object |
| `RestQueryHandler` | HTTP URL construction, wire serialization, Fetch execution, and JSON result retrieval |
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
results cannot overwrite current state. `dispose()` aborts the active request
and releases argument subscriptions.

By default the last successful value remains visible while refreshing and after
a refresh error. Set `keepPreviousValue: false` to clear it while loading or in
error state.

The REST adapter accepts injected `fetch`, `baseUrl`, and `serialize` behavior.
Its generic serializer omits `undefined` and empty arrays, encodes `null` as an
empty value, repeats keys for arrays, JSON-encodes objects, and stringifies
scalars. Application-specific table filter/sort formats belong in an injected
serializer, not Glue. A `RestQueryHandler` result generic declares the expected
JSON shape but does not validate it at runtime; validate untrusted responses at
the application boundary.

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
progress, retries, notifications, or UI behavior. See
the API reference below for the command contract.

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
surface](../../docs/API_SURFACE.md), [changelog](../../CHANGELOG.md),
[contribution guide](../../CONTRIBUTING.md), and [security
policy](../../SECURITY.md).
