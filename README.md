# Glue + Fray

Glue and Fray are an experimental TypeScript-first reactive UI stack for modern
browsers. Glue provides platform-neutral emitters, derived values, queries, and
tracing. Fray provides a small DOM component runtime, JSX, accessible controls,
generated structural CSS, and independently replaceable visual themes and
color palettes.

APIs may change during the `0.x`
prerelease series.

## Packages

- `@sylwellsoftware/glue` — reactive state, asynchronous query state, and
  optional causal diagnostics.
- `@sylwellsoftware/fray` — browser components, rendering, JSX runtimes, and
  supported themes. Glue is an external peer dependency.
- `@sylwellsoftware/dummy-server` — private workspace tooling containing generic
  in-memory and Node HTTP adapters for caller-supplied test scenarios. It is not
  published to npm.

## Install

The alpha packages are available from npm under the `next` tag. Install them
with:

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray
```

Both libraries are ESM-only, require Node 22 or newer for tooling, and target
current evergreen browsers. Fray's supported CSS entry points are
`@sylwellsoftware/fray/styles/structural.css`,
`@sylwellsoftware/fray/themes/*/theme.css`, and
`@sylwellsoftware/fray/colors/*/colors.css`. The original top-level light/dark
theme exports remain available for alpha compatibility.

## Architecture in brief

The dependency direction and responsibility boundary are intentional:

```text
application policy and composition
              │
              ▼
Fray: components, DOM, events, accessibility, structural CSS
              │ readable/writable emitter protocol
              ▼
Glue: current values, derivation, live queries, diagnostics
              │
              ▼
optional application-owned query handler / transport
```

Glue is not a Fray-specific state store: it remains usable from another UI,
Node, a CLI, or tests. Fray does not duplicate Glue with hooks or a hidden state
system. Leaf controls write ordinary emitters, coordinators derive semantic
state, data-aware owners connect that state to live queries, and Fray renders
the downstream values and status it actually consumes.

Presentation follows a parallel separation. Fray component declarations
produce one stable structural stylesheet. A replaceable theme supplies
treatment and hierarchical semantic-family variables; a second replaceable
stylesheet supplies color roles. This lets applications recombine appearance
and palette and lets custom components inherit established themes by consuming
the same variable hierarchy.

## Example

```ts
import {Emitter} from '@sylwellsoftware/glue'
import {Button, Component, createFrayRuntime, h} from '@sylwellsoftware/fray'
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
import '@sylwellsoftware/fray/themes/minimal/theme.css'

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

See the [Glue guide](packages/glue/README.md), [Fray component
guide](packages/fray/README.md), [alpha API surface](docs/API_SURFACE.md), and
[architecture overview](docs/architecture.md).

## Development

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:browser
pnpm verify:release
```

The equivalent operator entry points are `./gradlew publicCheck` and
`./gradlew publicReleasePreflight`. pnpm remains authoritative for dependency
resolution and JavaScript build/test/package mechanics.

Maintainers should follow the staged, 2FA-protected process in
[docs/RELEASING.md](docs/RELEASING.md); ordinary pushes never publish a package.

## Status and scope

Glue is DOM-independent except for explicitly injected Fetch/URL capabilities.
Fray is browser-only. SSR, hydration, CommonJS, framework adapters, legacy
browsers, and a stable `1.0` API are not currently supported. Data-heavy
components are exposed from an explicitly experimental subpath.

## License

Copyright 2026 Sylwell Software. Licensed under the Apache License, Version 2.0.
