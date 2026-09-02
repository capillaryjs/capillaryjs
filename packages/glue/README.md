# Glue

Glue is the platform-neutral reactive core used by Fray. The experimental
`0.1.0-alpha.1` candidate is not yet published. Its implementation and tests
are strict TypeScript; the ESM build includes declarations and declaration
maps.

After publication, install it with pnpm:

```bash
pnpm add @sylwellsoftware/glue
```

Glue is ESM-only. Core emitters, derived state, and diagnostics support Node 22+
and modern ESM runtimes without a DOM. `LiveQuery` needs `AbortController`, and
`RestQueryHandler` needs Fetch and URL capabilities unless they are injected.

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

## Experimental commands

`@sylwellsoftware/glue/experimental` exports `AsyncCommand`, an abortable
mutation lifecycle with explicit `ignore`, `replace`, and `reject` concurrency
policies. It exposes the last result/error through the standard emitter
snapshot and a read-only `isRunning` view. It deliberately does not own batch
progress, retries, notifications, or UI behavior. See
[EXPERIMENTAL.md](EXPERIMENTAL.md) for the provisional contract.

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

See the [workspace overview](../../README.md), [alpha API
surface](../../docs/API_SURFACE.md), [changelog](../../CHANGELOG.md),
[contribution guide](../../CONTRIBUTING.md), and [security
policy](../../SECURITY.md).
