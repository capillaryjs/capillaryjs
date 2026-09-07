# Generic test transport runtime

This non-publishable public workspace package verifies transport behavior. It
contains browser-safe Fetch and Node HTTP adapters, but no application fixture,
endpoint vocabulary, or default content. Every caller injects an object
implementing `DemoScenario` from `./contract`.

From the repository root:

```bash
pnpm --filter @sylwellsoftware/dummy-server typecheck
pnpm --filter @sylwellsoftware/dummy-server test
```

The reusable Node API is `startDummyServer({scenario, ...})`; the embedded API
creates a Fetch-compatible in-memory transport over the same scenario. Served
application HTML is explicit through `html` or `htmlPath`; without it, non-API
routes return 404. The CLI requires `--scenario-module <path>`, whose module
must export a `createScenario()` factory. It accepts optional `--host`,
`--port`, and `--html` arguments and never discovers a concrete scenario.

Runtime tests use a deliberately generic counter implementation through both
the embedded Fetch adapter and the Node HTTP adapter.
