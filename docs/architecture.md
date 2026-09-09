# Architecture

Glue and Fray form a one-way dependency stack:

```text
consumer application
        ↓
@sylwellsoftware/fray-visualization — optional analytical models and views
        ↓ peer dependencies
@sylwellsoftware/fray — TSX, DOM, lifecycle, accessibility, routing, styles
        ↓ peer dependency
@sylwellsoftware/glue — values, derivation, queries, commands, diagnostics
```

Applications own policy. Fray owns presentation. Glue owns reactive
propagation.

## Reactive model

The stack starts from application data rather than a framework-specific state
shape. A user-entered value naturally uses an `Emitter`; a calculation uses a
`DerivedEmitter`; a remote result uses a `LiveQuery`. All expose the same small
synchronous read/subscription contract, so Fray can consume the downstream
value without mirroring it into a component store.

```text
browser event
    └─ Fray control writes an Emitter
         └─ DerivedEmitter computes shared/domain state
              ├─ Fray renders a local view
              └─ LiveQuery executes through an application handler
                   └─ Fray renders value + fetch state + error
```

Leaf controls do not know that a distant query may observe their values.
Derivations do not know how data is transported. `LiveQuery` owns execution
timing, cancellation, and stale-result protection; handlers own retrieval and
wire encoding. Commands remain callbacks or `AsyncCommand` objects rather than
being disguised as automatically rerunning queries.

Every active edge has an owner. The object that creates a derived emitter,
query, command, or long-lived subscription disposes it at the same lifetime
boundary.

## Presentation model

Fray class components author TSX and return virtual nodes. The synchronous
keyed patcher preserves compatible DOM/component identity, focus, stateful DOM
properties, and event-listener cardinality. Components have explicit setup,
render, post-commit, and destruction hooks; renderer-created subscriptions and
registered cleanups are lifecycle-owned.

Native elements carry semantics whenever possible. A component with no
suitable native root renders a fixed, readable `fray-*` light-DOM host. These
hosts are not registered Web Components and do not use Shadow DOM. Application
classes remain available for application meaning and reusable traits instead
of framework identity.

The automatic JSX runtime is the primary authoring frontend. It lowers to the
same vnode representation as the exported low-level `h()` compatibility
factory. Reactivity is explicit:

- `read()` and `snapshot()` track render dependencies;
- readable emitter children update fine-grained DOM ranges;
- `live()` binds allowlisted properties one way;
- `bind:value` and `bind:checked` bind native controls two ways;
- ordinary component props preserve the objects supplied by the caller.

Fray introduces no hook system, global store, proxy tracking, or concurrent
scheduler.

## Services and composition

An application composition root may pass a fixed `ServiceScope` to
`FrayRuntime`. Typed providers are immutable, lazy, and shared within that
scope. Nested class components inherit the runtime and can resolve only keys
listed in `static requiredServices`.

The scope detects missing providers, duplicates, and cycles, then disposes
initialized disposable services in reverse creation order. It has no process-
global registry, constructor inspection, decorator metadata, or transient
lookup. Components still own the live query/results they open; scope-shared
services do not become component-owned.

## Routing

The same runtime may carry a caller-owned `BrowserRouter`. Applications define
immutable route descriptors, codecs, data-dependent resolvers, and a history,
hash, or memory navigation adapter. Mounted route components establish
contextual lineage and bind path/query values to ordinary application-owned
writable emitters.

Restoration advances through discovered scopes in parent-to-child order. A
resolver may await application data with an `AbortSignal`; a newer transition
aborts older work. Explicit navigation pushes by default. Restoration never
pushes, while redirect, fallback, canonicalization, and passive binding changes
replace.

Invalid locations settle at the deepest valid parent and expose a structured
issue emitter. The application decides how to present that issue accessibly.
Tables, filters, endpoints, and domain models do not acquire router knowledge.

`NavigationBar` presents router-aware destinations as native links without
owning their content. `RouteOutlet` is the canonical owner for one sibling
literal-route set: it writes restoration into an application-owned emitter,
applies eager, lazy-retained, or active-only mounting, and supplies the selected
branch's nested route scope. Disconnected titles, sidebars, and actions may
observe that emitter directly; they do not duplicate route registration or use
router transition state as an application store.

## Data components

Selection components reconcile fresh objects by application-supplied stable
keys. `ListView`, `TreeView`, and `DataTable` own browser interaction but not
domain selection policy.

`DataTable` makes source ownership explicit:

- direct `data` creates a component-owned local source;
- an explicit `TableDataSource` remains caller-owned;
- inline `rest` options create a component-owned `LiveQuery` source.

Table sort/filter state is exposed through emitters. Pure helpers own local
calculation and query serialization, while pagination, virtualization, and
server-specific formats stay outside the component.

Tree node projections are read-only derivations over complete root snapshots.
Reverse updates are explicit immutable root transformations or application
commands rather than hidden two-way mutation.

## Visualization layer

Fray Visualization owns reusable analytical coordination and rendering:
category visibility, split ordering, strict recursive partitions, block
selection, civil-date series, and chart calculations. Applications still own
item data, predicates, stable keys, colors, presets, and dates.

Criteria and selection models are caller-owned. A block split must place each
item in exactly one category beneath its parent; invalid partitions are
diagnosed rather than silently coerced. The package never fetches data.

## Styling layers

Fray presentation has four ordered inputs:

```text
themes/base.css              variables and palette derivation
        ↓
component static CSS         selectors, layout, interaction mechanics
        ↑
colors/<name>/colors.css     palette anchors and endpoints
        +
themes/<name>/theme.css      intentional semantic overrides, tokens first
```

The arrows indicate that structural CSS consumes variables supplied by the
other files; load order is base, structure, color, then theme.

`base.css` contains no component selectors. Color files contain no semantic
component roles. Each component owns its hosts, native/ARIA state selectors,
pseudo-elements, and fixed part elements through `static css`. The dependency
collector emits only rules reachable from declared roots; a complete generated
structural asset is also published.

A theme changes values first, declaring custom properties inside `@layer
theme`, and may write ordinary component-targeting rules when no variable
expresses the difference. Those rules must sit outside the layer: component CSS
is injected unlayered and prepended to `<head>`, so only an unlayered theme
rule can outrank it.

Application CSS owns page composition and decides whether the root fills a
viewport. Theme and color selection is application policy even when Fray's
pickers are used.

## Transport test seam

The repository's `dummy-server` workspace package provides browser-safe Fetch
and Node HTTP adapters around an injected scenario contract. It contains no
application endpoint vocabulary or fixture. This keeps transport verification
reusable without moving application policy into Glue or Fray.

See [API_SURFACE.md](API_SURFACE.md) for the public export inventory and the
package guides for detailed contracts and examples.
