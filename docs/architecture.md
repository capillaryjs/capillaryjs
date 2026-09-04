# Architecture overview

Glue and Fray form a one-way dependency stack:

```text
consumer application
        ↓
@sylwellsoftware/fray-visualization — optional analytical models and views
        ↓ peer dependencies
@sylwellsoftware/fray  — DOM components, JSX, structural CSS, themes/colors
        ↓ peer dependency
@sylwellsoftware/glue  — emitters, queries, commands, diagnostics
```

Glue owns reactive values and asynchronous state without depending on the DOM.
Fray watches Glue emitters, renders component-owned DOM, collects structural
styles, propagates explicit application service and route scopes, and can
coordinate browser navigation through an injected adapter. Consumers own
application state, service implementations, endpoints, concrete service
registration, route vocabulary and codecs, page composition, and theme
selection.

## Developer model

The stack starts from application data rather than a framework-specific state
shape. Most interface values are retrieved through a service, entered or
selected by a user, or computed from those values. Each value stays with its
natural owner: an input uses a writable emitter, a computation uses a derived
emitter, and a live query owns its result, loading state, and error. Fray
consumes that same graph.

State therefore exists without requiring the developer to mirror it into a
parallel component store or maintain synchronization effects between the
store, requests, and views. A table sort can flow from a header control into a
query argument and return as newly retrieved rows. Glue owns propagation and
request lifecycle; the application still owns meaningful decisions about
mutation, domain policy, service composition, transport, and disposal.

Fray applies the same directness to presentation. Native HTML elements carry
native meaning where possible, and readable custom hosts mark component
boundaries that have no suitable native root. Framework identity does not
occupy application classes. The current structural contract additionally uses
stable component and part attributes where layout or exceptional theme rules
need them; those hooks are explicit implementation contracts rather than
domain state.

Fray Visualization is an optional layer over both packages. It owns reusable
grouping/filtering coordination, strict partition diagnostics, block/history
calculations, accessible analytical controls, and generated structural CSS.
Consumers still own domain predicates, stable keys, presets, dates, and
semantic colors. It never fetches application data.

The integration seam is the small readable/writable emitter contract. Leaf UI
controls write ordinary emitters; components that understand an aggregate
interaction own its derived value; data-aware owners construct or receive a
`LiveQuery`; injected handlers own retrieval and wire serialization. Fray
renders the downstream value or snapshot it consumes rather than subscribing
to every upstream source. Commands remain callbacks when no reusable state must
be observed.

DataTable makes that ownership boundary concrete through `TableDataSource`.
Direct local and inline REST inputs create component-owned sources; an explicit
source remains caller-owned. Generic filter state stores semantic values and
caller matchers while presentation symbols and wire serialization remain at
their own boundaries. Tree node projections are read-only derivations over
complete root snapshots; reverse changes are explicit commands against a
writable root or the application's true domain source.

Fray uses a synchronous keyed DOM patcher. It preserves stable node identity,
focus, stateful DOM properties, and event-listener cardinality. Components have
explicit mount, update, and destroy lifecycles; subscriptions and registered
cleanups are lifecycle-owned.

The application composition root supplies a fixed `ServiceScope` to
`FrayRuntime`. Typed providers are lazy and scope-shared; nested class
components inherit the runtime and may resolve only services they declare.
Opened Glue queries/results remain component- or caller-owned. Service scope is
explicit and disposable, with no process-global registry, constructor
autowiring, decorators, or transient resolution.

The same runtime may carry one caller-owned `BrowserRouter`. Immutable route
descriptors identify relative path segments, while mounted scopes assign their
resolved parent lineage. Routed `TabPanel` instances register all immediate
annotated tabs and activate the existing application-owned emitter during
restoration. Dynamic values and explicit query arguments likewise bind to
ordinary writable emitters; tables, filters, services, and domain models do
not acquire router knowledge.

Location restoration advances one discovered scope at a time. Each step may
await a cancellable application resolver before its child scope mounts, so
data-dependent entity paths retain application ownership and deterministic
parent-to-child order. Explicit navigation pushes; redirects, fallback,
canonicalization, and passive state synchronization replace. Failures preserve
the deepest valid prefix and expose structured issue state for application-
owned accessible presentation. History, hash, and memory adapters keep URL
placement out of the route model, and destroying the caller-owned router
releases browser listeners and state subscriptions.

The automatic JSX runtime and `h()` produce the same vnode representation.
Readable emitters may be rendered as fine-grained children, bound to properties,
or read as component dependencies. Glue remains an external Fray peer so a
consumer resolves one reactive runtime instance.

Fray presentation has three independent layers:

```text
component structural declarations
              │ dependency-aware collection
              ▼
styles/structural.css (loaded once)
              ▲
              │ consumes hierarchical custom properties
              │
themes/<name>/theme.css  +  colors/<name>/colors.css
replaceable treatment       replaceable palette
```

The variable hierarchy proceeds from palette roles through global UI roles and
generic semantic families such as headers, buttons, inputs, panels, and
selection. Optional table-header, tab-button, toggle-button, dropdown-trigger,
dialog, checkbox, and progress roles specialize those families. Custom
components participate by consuming the generic fallbacks and may expose a
narrower component override. Theme selectors are exceptional but supported for
pseudo-elements and native pseudo-parts that variables alone cannot create;
they use stable component/part/state hooks and preserve accessibility behavior.

Theme and color selection is application policy. Fray supplies pickers and
independent stylesheet-link replacement; Glue is involved only if the
application chooses to hold selection identifiers in ordinary emitters.

The workspace's dummy-server package owns transport mechanics only. A caller
must inject a scenario implementing the public request/response contract. The
embedded adapter is an in-memory transport; the Node adapter validates actual
HTTP behavior. The package contains no application scenario or domain fixture.

See [API_SURFACE.md](API_SURFACE.md) for the current public exports and
compatibility boundaries.
