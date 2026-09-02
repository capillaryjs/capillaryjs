# Generic test transport runtime

This private workspace package is a candidate for the public repository. It
contains browser-safe Fetch and Node HTTP adapters, but no application fixture,
endpoint vocabulary, or default content. Every caller must inject an object
implementing `DemoScenario` from `./contract`.

From the repository root:

```bash
pnpm --filter @sylwellsoftware/dummy-server typecheck
pnpm --filter @sylwellsoftware/dummy-server test
```

The reusable API is `startDummyServer({scenario, ...})`. Application HTML is
also explicit through `html` or `htmlPath`; without it, non-API routes return
404. The CLI requires `--scenario-module <path>`, whose module must export a
`createScenario()` factory. It accepts optional `--host`, `--port`, and `--html`
arguments and never discovers or imports a concrete scenario itself.

Runtime tests use a deliberately generic counter implementation through both
the embedded Fetch adapter and the Node HTTP adapter.
