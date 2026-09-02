# Architecture overview

Glue and Fray form a one-way dependency stack:

```text
consumer application
        ↓
@sylwellsoftware/fray  — DOM components, JSX, styles, themes
        ↓ peer dependency
@sylwellsoftware/glue  — emitters, queries, commands, diagnostics
```

Glue owns reactive values and asynchronous state without depending on the DOM.
Fray watches Glue emitters, renders component-owned DOM, and collects structural
styles. Consumers own application state, endpoints, page composition, and theme
selection.

Fray uses a synchronous keyed DOM patcher. It preserves stable node identity,
focus, stateful DOM properties, and event-listener cardinality. Components have
explicit mount, update, and destroy lifecycles; subscriptions and registered
cleanups are lifecycle-owned.

The automatic JSX runtime and `h()` produce the same vnode representation.
Readable emitters may be rendered as fine-grained children, bound to properties,
or read as component dependencies. Glue remains an external Fray peer so a
consumer resolves one reactive runtime instance.

The workspace's dummy-server package owns transport mechanics only. A caller
must inject a scenario implementing the public request/response contract. The
embedded adapter is an in-memory transport; the Node adapter validates actual
HTTP behavior. The package contains no application scenario or domain fixture.

See [API_SURFACE.md](API_SURFACE.md) for the stable and experimental alpha
exports.
