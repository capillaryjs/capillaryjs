# Glue + Fray

Glue and Fray are a TypeScript-first stack for explicit reactive applications.
Glue supplies platform-neutral state, derivation, live-query, and diagnostic
primitives. Fray supplies browser-native rendering, accessible components, TSX,
and independently replaceable structural, theme, and color stylesheets.

## The architecture

```text
application policy and composition
              │
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
  accessible controls and layouts, semantic filters, and theme tools. It has a
  peer dependency on Glue.

Both packages are ESM-only. Tooling requires Node 22 or newer; Fray targets
current evergreen browsers.

## Install

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray
```

For Fray, import the structural stylesheet plus a theme and color palette:

```ts
import '@sylwellsoftware/fray/styles/structural.css'
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
