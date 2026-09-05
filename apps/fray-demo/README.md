# Fray style lab

This public, non-publishable workspace application is Fray's deterministic CSS
review harness. Its layout stylesheet is application-owned; Fray structural,
palette, and theme CSS are loaded separately.

Run it from `framework`:

```sh
pnpm --filter @sylwellsoftware/fray-demo dev
```

The current review slice is `Panel`: Portfolio summary, Current selection, and
Demo harness use that one Fray component type; their inputs remain native until
their own reviewed iterations. Its scope, state graph, and verification matrix
are recorded in
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/01-panel.md`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/01-panel.md).
