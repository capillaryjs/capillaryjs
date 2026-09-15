# Causal diagnostics

Capillary reports facts; it does not retain a recording. Capillary UI adds
interaction and consumer facts. The optional
[@capillaryjs/capillary-devtools](../packages/capillary-devtools/README.md)
package owns bounded history, privacy policy, projections, and presentation.
The diagnostics protocol and automatic UI endpoints are additive 1.2 APIs.

## Identity, topology, and occurrences

`Diagnostics.subscribe(listener, {topology: true, verbose: false, ui: true})`
returns an unsubscribe function. Protocol version 1 facts are `node`, `edge`
(connected/disconnected), `disposed`, and `event`. Every EventBubble is observed
once after construction, including asynchronous descendants. The existing
`EventBus.subscribe()` still reports only roots; its timing and meaning are
unchanged. Legacy `trace`/explicit-parent event creation remains supported.

Node IDs are weak, process-local object identities, not labels or durable
business IDs. Events have their own IDs, causal parent, kind, outcome, optional
before/state/error/input data, and attempt identity. Repeated occurrences of one
derived emitter are not collapsed. A graph edge describes a known possible
connection; only occurrence ancestry proves propagation. Disposal and source
replacement close connection intervals.

Emitters use `purpose` labels. Components use static `diagnosticLabel`, then
their `hostName`, then the constructor name. Function components can set
`diagnosticLabel`; supply it for stable names after minification. Ordinary
subscriptions can specify `{diagnosticLabel: 'persist selection'}`. They are
first-class non-UI consumers and propagate context to synchronous writes.
Subscription identities are distinct even when the same callback is reused
across emitters, so another subscription's scope cannot hide application work.
An emitter with no subscribers is still a discoverable downstream leaf.

With no diagnostic observer the new event instrumentation does not allocate
facts, serialize values, or retain history. Weak identity/description metadata
supports later attachment. `Diagnostics.inspect(object)` discovers reachable
live relationships; there is deliberately no strong global object inventory.
Late capture cannot recover earlier events or disconnected/disposed objects.

`verbose` adds equal recomputations and snapshots of all derived inputs.
`ui: false` omits interaction/component/binding occurrences, not ordinary
subscription callbacks; known topology can still describe UI connections.
Observer errors and reentrant observations are isolated from application
delivery. Observers/formatters must be pure; the framework does not undo an
observer's intentional application mutation.

## Start at the interaction

Capillary UI automatically wraps native TSX/`h()` handlers, two-way bindings,
and `Component.listen()`. One dispatch has one shared origin even as it bubbles
through multiple handlers. The synchronous context carries through emitter
delivery, derived computations, component reads/watchers, reactive children,
live DOM/class/function props, and native bindings. No changes to ordinary
application handlers are required.

For an external native listener or another integration, provide an origin:

```ts
import {Diagnostics, Emitter} from '@capillaryjs/capillary'

const search = new Emitter('', {purpose: 'Search term'})
const origin = {}
Diagnostics.configure(origin, {kind: 'interaction', label: 'Search field'})
input.addEventListener('input', () => {
    Diagnostics.interaction(origin, 'input', () => search.set(input.value))
})
```

Causal context is synchronous and restored in `finally`. It must never be held
globally across an `await`, which would attach unrelated concurrent work to the
wrong root. Pass it explicitly for application-owned asynchronous continuations:

```ts
Diagnostics.interaction(origin, 'load', async (parent) => {
    const value = await loadApplicationData()
    search.set(value, parent)
})
```

Capillary query/command attempts already preserve their parent internally.
Their handler context's `event` can be forwarded to work after an `await`.
Synchronous writes inside handlers inherit invocation context automatically.
Attempt starts include scheduling/loading; a separate handler-invoked occurrence
records the arguments actually passed. Retry, success, failure, abort,
supersession, and ignored stale settlement remain distinct facts. Recording an
ignored result never reapplies it to the application.

## Ownership and self-exclusion

`new DiagnosticScope('inspection', false)` is an immutable exclusion tag.
Pass it as `diagnosticScope` on emitters, queries, commands, endpoint-open
options, or `createCapillaryUiRuntime()`. Derived values inherit a shared source
scope; mixed-source derivations use normal application ownership unless an
explicit scope is supplied. Owned emitter scope falls back to its owner.
Runtime-created components and values created while initializing/rendering
their subtree inherit its scope. Custom components may override static
`diagnosticScope`; `Diagnostics.withScope(scope, () => create())` explicitly
scopes synchronous construction and does not cross `await`.

Exclusion suppresses both event and topology facts even with a captured parent.
Use `devtoolsDiagnosticScope` for custom tool models/views. A write to an
existing application-owned emitter remains observable, even when triggered by
an excluded control. This is ownership-based exclusion, not a blanket global
“debugger is rendering” switch.

External adapters can describe live relationships using `Diagnostics.configure`
or the public `[diagnosticInfo]()` protocol, then call `inspect`, `event`,
`disconnect`, and `dispose` at the matching lifecycle boundaries. These APIs
observe real work; they must not be used to invent propagation that did not run.

The flow lab and packed-consumer tests demonstrate the entire chain using only
public imports. See the [API inventory](API_SURFACE.md) and
[DevTools guide](../packages/capillary-devtools/README.md) for capture options,
individual views, styling, replay, and explicit incompleteness notices.
