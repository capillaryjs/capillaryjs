# Architecture overview

Glue and Fray form a one-way dependency stack:

```text
consumer application
        ↓
@sylwellsoftware/fray  — DOM components, JSX, structural CSS, themes/colors
        ↓ peer dependency
@sylwellsoftware/glue  — emitters, queries, commands, diagnostics
```

Glue owns reactive values and asynchronous state without depending on the DOM.
Fray watches Glue emitters, renders component-owned DOM, and collects structural
styles. Consumers own application state, endpoints, page composition, and theme
selection.

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
