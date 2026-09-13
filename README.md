# Capillary + Capillary UI

Capillary and Capillary UI are a TypeScript-first stack for browser applications that keeps
application state, presentation, and transport policy separate.

- **Capillary** owns mutable values, derivations, live queries, asynchronous
  commands, and optional causal diagnostics.
- **Capillary UI** owns TSX rendering, component lifecycle, native browser semantics,
  accessibility, structural CSS, and application-scoped services and routing.
- **Capillary Viz** adds domain-neutral grouping, filtering, proportional
  block diagrams, and civil-date history charts.

Applications remain the composition root. They own domain policy, endpoint
configuration, service implementations, routes, page layout, and the active
theme and color palette.

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

Capillary and Capillary UI are built around the opposite idea: the code should stay as close
as possible to the way the developer already thinks about the application.

Imagine a page with a table, a search box, a few filters, and a total at the
bottom. You might describe it like this:

> The table gets its data from this endpoint. These controls are its filters.
> Clicking a column changes the sort order. When any of those things change,
> the table updates. The total is calculated from the same result.

That description already contains most of the application model.

In Capillary, concepts such as queries, filters, mappings, and derived values are
first-class things that developers work with directly. They can be connected
in the same relationships that exist in the application itself: filters affect
queries, results can be transformed or combined, and components can observe the
parts they need.

The point is not that Capillary introduces a new vocabulary for these things. The
point is that it tries not to replace the vocabulary the developer already has.

The same idea carries into Capillary UI.

A button should normally be a button. A table should be a table. A heading,
input, list, fieldset, or section should use the browser concept that already
expresses what it is. Component boundaries should remain readable, and styling
should describe real shared characteristics rather than depend on opaque
generated identifiers whose main purpose is to connect implementation details
to CSS.

Application-owned native elements can opt into Capillary UI's public layout and
presentation traits directly; Capillary UI does not require framework-specific wrappers
simply to theme semantically appropriate HTML.

In other words, the separation between HTML and CSS should remain meaningful.
HTML expresses structure and semantics. CSS expresses presentation, reusable
traits, and cross-cutting concerns. Structural layout, visual themes, and color
choices are kept distinct so they can evolve independently without turning the
markup into a collection of styling hooks.

This is the principle that ties Capillary and Capillary UI together: abstractions should help
the code describe the application more directly, not force the developer to
translate the application into a model invented by the framework.

The goal is not to eliminate abstraction. It is to make the abstractions line
up closely enough with the developer's mental model that the implementation
still feels like the application they intended to build.

The names reflect that idea too.

Capillary is the connective layer: it joins the application's queries, filters,
mappings, derived relationships, and other reactive pieces into an explicit
graph.

Capillary UI comes from the image of threads or filaments: a lightweight structure
through which those relationships become visible and interactive in the
browser.

There is a deliberate tension between the names. Capillary binds things together;
Capillary UI exposes the individual threads. Together they describe the stack fairly
well: one connects the application's relationships, the other presents them.

## Architecture and ownership

A writable control can use the same Capillary emitter that a query argument or
derived result observes. Capillary UI renders only the downstream values a component
needs. Buttons remain buttons, tables remain tables, and component boundaries
use readable light-DOM hosts when no native element expresses the boundary.

```text
application policy and composition
              │
              ▼
Capillary Viz (optional analytical models and views)
              │
              ▼
Capillary UI (TSX, DOM, events, lifecycle, accessibility, structural CSS)
              │ readable/writable emitter protocol
              ▼
Capillary (values, derivation, queries, commands, diagnostics)
              │
              ▼
application-owned query handler and transport
```

Capillary has no DOM dependency. Capillary UI uses Capillary as its reactive peer and does not
add hooks, a hidden store, or transport policy. Capillary Viz peers on
both libraries and never fetches application data.

## Install

Install only the packages the application uses:

```bash
pnpm add @capillaryjs/capillary @capillaryjs/capillary-ui
pnpm add @capillaryjs/capillary-viz # optional
```

All packages are ESM-only. Repository tooling requires Node 22 or newer and
the pnpm version declared in `packageManager`. Capillary UI targets current evergreen
browsers.

Configure automatic JSX in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@capillaryjs/capillary-ui"
  }
}
```

Load Capillary UI's variable base, one color palette, and one theme. Structural CSS is
collected from the root component and its declared dependencies:

```tsx
import {Emitter} from '@capillaryjs/capillary'
import {
    Button,
    Component,
    Panel,
    createCapillaryUiRuntime,
} from '@capillaryjs/capillary-ui'

import '@capillaryjs/capillary-ui/themes/base.css'
import '@capillaryjs/capillary-ui/colors/iceblue/colors.css'
import '@capillaryjs/capillary-ui/themes/minimal/theme.css'

class Counter extends Component {
    readonly count = new Emitter(0)

    render() {
        return <Panel header="Counter">
            <Button
                label={`Count: ${this.read(this.count)}`}
                onClick={() => this.count.set(this.count.get() + 1)}
            />
        </Panel>
    }

    onDestroy() {
        this.count.dispose()
    }

    static dependencies = [Button, Panel]
}

const runtime = createCapillaryUiRuntime()
runtime.registerStyles(Counter).injectStyles(document)
runtime.mount(runtime.create(Counter), document.querySelector('#app')!)
```

The dependency list is a styling and composition contract: it lets Capillary UI emit
only the structural CSS reachable from the application root. The complete
prebuilt structural stylesheet is also exported for applications that prefer
a static asset.

## Package map

| Package | Main responsibilities | Guide |
| --- | --- | --- |
| `@capillaryjs/capillary` | Emitters, derived values, query arguments, live queries, endpoint declarations, commands, diagnostics | [Capillary guide](packages/capillary/README.md) |
| `@capillaryjs/capillary-ui` | TSX runtime, components, data controls, routing, services, structural styling, theme tools | [Capillary UI guide](packages/capillary-ui/README.md) |
| `@capillaryjs/capillary-viz` | Grouping models, split controls, block diagrams, history series and charts | [Visualization guide](packages/capillary-viz/README.md) |

The [public API surface](docs/API_SURFACE.md) is the concise compatibility
inventory. The [architecture guide](docs/architecture.md) explains ownership
and dependency boundaries.

## Demo applications

- [`apps/component-gallery`](apps/component-gallery/README.md) tours the wider
  Capillary, Capillary UI, and Capillary Viz component surface.
- [`apps/localization-demo`](apps/localization-demo/README.md) is a focused
  English, Danish, and German gallery for Capillary UI runtime localization.
- [`apps/capillary-ui-demo`](apps/capillary-ui-demo/) is the Capillary UI styling lab.

## Presentation files

Capillary UI presentation has four independently owned inputs, loaded in this order:

1. `themes/base.css` declares defaults and derives palette roles.
2. Collected or prebuilt structural CSS owns component layout and selectors.
3. `colors/<name>/colors.css` supplies palette anchors.
4. `themes/<name>/theme.css` supplies intentional visual overrides.

Application layout CSS remains separate. Themes and color palettes can be
replaced without rebuilding components or refetching application data.

Root sizing is application policy. Add `cap-fill-horizontal`,
`cap-fill-vertical`, or both to an application root when it should claim the
viewport. An embedded root without either class keeps normal content sizing
and inherits the host page's typography.

## Scope and non-goals

Capillary values expose synchronous snapshots and subscriptions. Capillary UI reconciles
compatible keyed DOM synchronously and owns subscriptions, listeners, child
components, and cleanup created by a component. Native semantics are the
default for buttons, inputs, fieldsets, lists, tables, descriptions, progress,
dialogs, and landmarks.

Capillary UI is browser-only. Server-side rendering, hydration, Shadow DOM, registered
custom elements, framework adapters, legacy browsers, and a concurrent
scheduler are outside its current scope. The built-in table is intentionally
non-virtualized; pagination, virtualization, and domain-specific policy belong
to applications or focused extensions.

## Development

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:browser
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing public behavior.
Ordinary pushes never publish packages; maintainers use the staged,
2FA-protected process in [docs/RELEASING.md](docs/RELEASING.md).

## License

Copyright 2026 Sylwell Software. Licensed under the Apache License, Version 2.0.
