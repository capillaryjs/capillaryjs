# Glue + Fray

Glue and Fray are an experimental TypeScript-first reactive UI stack for modern
browsers. Glue provides platform-neutral emitters, derived values, queries, and
tracing. Fray provides a small DOM component runtime, JSX, accessible controls,
and semantic light and dark themes.

The current version is `0.1.0-alpha.1`. APIs may change during the `0.x`
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

The packages are prepared for an initial alpha release but are not yet
available from npm. After publication, install them with:

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray
```

Both libraries are ESM-only, require Node 22 or newer for tooling, and target
current evergreen browsers. Fray's supported CSS entry points are
`@sylwellsoftware/fray/themes/light.css` and
`@sylwellsoftware/fray/themes/dark.css`.

## Example

```ts
import {Emitter} from '@sylwellsoftware/glue'
import {Button, Component, h} from '@sylwellsoftware/fray'
import '@sylwellsoftware/fray/themes/light.css'

class Counter extends Component {
    readonly count = new Emitter(0)

    render() {
        return h(Button, {
            label: `Count: ${this.count.get()}`,
            onClick: () => this.count.set(this.count.get() + 1),
        })
    }

    onDestroy() {
        this.count.dispose()
    }

    static dependencies = [Button]
}

Counter.registerStyles()
Counter.new().attachTo(document.body)
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

## Status and scope

Glue is DOM-independent except for explicitly injected Fetch/URL capabilities.
Fray is browser-only. SSR, hydration, CommonJS, framework adapters, legacy
browsers, and a stable `1.0` API are not currently supported. Data-heavy
components are exposed from an explicitly experimental subpath.

## License

Copyright 2026 Sylwell Software. Licensed under the Apache License, Version 2.0.
