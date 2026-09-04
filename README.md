# Glue + Fray

Glue, Fray, and the optional Fray Visualization package are a TypeScript-first
stack for building reactive web applications without forcing the application
into a framework-specific state model.

## Why this stack exists

Many JavaScript frameworks make simple application relationships feel more
complicated than they really are.

A value entered by the user becomes framework state. A calculated value
becomes another piece of state or a memo. Data from the server becomes query
state. Keeping those things synchronized often means effects, stores, hooks,
binding layers, selectors, or other abstractions whose main purpose is to
satisfy the framework rather than describe the application.

Over time, that can create a second model of the application: one shaped around
the framework instead of around the problem being solved. The developer is no
longer only thinking about filters, queries, calculations, tables, and forms,
but also about how those ideas have been translated into the framework's
particular vocabulary and lifecycle.

Glue and Fray are built around the opposite idea: the code should stay as close
as possible to the way the developer already thinks about the application.

Imagine a page with a table, a search box, a few filters, and a total at the
bottom. You might describe it like this:

> The table gets its data from this endpoint. These controls are its filters.
> Clicking a column changes the sort order. When any of those things change,
> the table updates. The total is calculated from the same result.

That description already contains most of the application model.

In Glue, concepts such as queries, filters, mappings, and derived values are
first-class things that developers work with directly. They can be connected
in the same relationships that exist in the application itself: filters affect
queries, results can be transformed or combined, and components can observe the
parts they need.

The point is not that Glue introduces a new vocabulary for these things. The
point is that it tries not to replace the vocabulary the developer already has.

The same idea carries into Fray.

A button should normally be a button. A table should be a table. A heading,
input, list, fieldset, or section should use the browser concept that already
expresses what it is. Component boundaries should remain readable, and styling
should describe real shared characteristics rather than depend on opaque
generated identifiers whose main purpose is to connect implementation details
to CSS.

In other words, the separation between HTML and CSS should remain meaningful.
HTML expresses structure and semantics. CSS expresses presentation, reusable
traits, and cross-cutting concerns. Structural layout, visual themes, and color
choices are kept distinct so they can evolve independently without turning the
markup into a collection of styling hooks.

This is the principle that ties Glue and Fray together: abstractions should help
the code describe the application more directly, not force the developer to
translate the application into a model invented by the framework.

The goal is not to eliminate abstraction. It is to make the abstractions line
up closely enough with the developer's mental model that the implementation
still feels like the application they intended to build.

The names reflect that idea too.

Glue is the connective layer: it joins the application's queries, filters,
mappings, derived relationships, and other reactive pieces into an explicit
graph.

Fray comes from the image of threads or filaments: a lightweight structure
through which those relationships become visible and interactive in the
browser.

There is a deliberate tension between the names. Glue binds things together;
Fray exposes the individual threads. Together they describe the stack fairly
well: one connects the application's relationships, the other presents them.

## The architecture

```text
application policy and composition
              │
              ▼
Fray Visualization: analytical models, controls, mosaics, history charts
              │ optional layer
              ▼
Fray: DOM, components, events, accessibility, structural CSS
              │ readable/writable reactive values
              ▼
Glue: current values, derivation, live queries, diagnostics
              │
              ▼
application-owned query handler and transport
```

Glue has no Fray, DOM, or UI-framework dependency. Fray uses Glue rather than
adding hooks, hidden dependency discovery, or a global store. Leaf controls
write ordinary emitters; coordinators derive semantic state; data owners create
or receive queries; views render the downstream values they read.

## Packages

- `@sylwellsoftware/glue` — emitters, derived values, reusable remote/local
  endpoint declarations, live queries with opt-in polling, async commands, and
  optional causal diagnostics.
- `@sylwellsoftware/fray` — keyed DOM rendering, components, JSX runtimes,
  application-scoped service access, accessible controls and layouts, semantic
  filters, and theme tools. It has a peer dependency on Glue.
- `@sylwellsoftware/fray-visualization` — optional stable-key grouping,
  category/split controls, strictly partitioned block mosaics, civil-date
  series, and responsive history charts. It peers on Glue and Fray.

All packages are ESM-only. Tooling requires Node 22 or newer; Fray targets
current evergreen browsers.

## Install

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray \
  @sylwellsoftware/fray-visualization
```

For Fray, import the structural stylesheet plus a theme and color palette:

```ts
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray-visualization/styles/structural.css'
import '@sylwellsoftware/fray/themes/minimal/theme.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
```

Structural CSS owns layout and interaction mechanics. The theme owns visual
treatment and semantic families; the color stylesheet owns the palette. An
application may replace either presentation stylesheet without rebuilding the
component tree or refetching data.

## Example

```ts
import {Emitter} from '@sylwellsoftware/glue'
import {Button, Component, createFrayRuntime, h} from '@sylwellsoftware/fray'

class Counter extends Component {
    readonly count = new Emitter(0)

    render() {
        return h(Button, {
            label: `Count: ${this.read(this.count)}`,
            onClick: () => this.count.set(this.count.get() + 1),
        })
    }

    onDestroy() {
        this.count.dispose()
    }

    static dependencies = [Button]
}

const runtime = createFrayRuntime()
runtime.mount(runtime.create(Counter), document.body)
```

## Scope

Glue values always expose a synchronous snapshot and a subscription contract.
`Emitter` owns mutation, `DerivedEmitter` owns cached computation, and
`LiveQuery` owns execution timing, latest-result handling, optional polling,
and status/error snapshots. Query handlers own retrieval and wire encoding.
Application service classes may group immutable endpoint declarations, while
each caller owns the live result it opens.

Fray patches compatible DOM and component identity synchronously by type and
key. Components own their subtree, subscriptions, bindings, listeners, and
cleanup. Native browser semantics remain the default: buttons, inputs,
fieldsets, lists, tables, descriptions, progress, and landmarks use native
elements whenever those elements express the contract.

Fray is browser-only. SSR, hydration, registered custom elements, Shadow DOM,
framework adapters, legacy browsers, and a concurrent scheduler are outside
the current scope. The non-virtualized table is supported for desktop datasets
up to 1,000 rows with four to six simple columns; pagination, virtualization,
and domain policy remain application concerns.

## Documentation and development

- [Glue guide](packages/glue/README.md)
- [Fray guide](packages/fray/README.md)
- [Fray Visualization guide](packages/fray-visualization/README.md)
- [API surface](docs/API_SURFACE.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:browser
pnpm verify:release
```

Ordinary pushes never publish packages. Maintainers use the staged,
2FA-protected process in [docs/RELEASING.md](docs/RELEASING.md).

## License

Copyright 2026 Sylwell Software. Licensed under the Apache License, Version 2.0.
