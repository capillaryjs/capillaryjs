# Fray style lab

This public, non-publishable workspace application is Fray's deterministic CSS
review harness. Its layout stylesheet is application-owned; Fray structural,
palette, and theme CSS are loaded separately.

Run it from `framework`:

```sh
pnpm --filter @sylwellsoftware/fray-demo dev
```

The current review slice is `Sidebar`: the Meridian Scope region contains
native site controls, which continue to drive the already-reviewed Portfolio,
Current selection, and Demo harness Panels. Its scope, state graph, and
verification matrix are recorded in
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/02-sidebar.md`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/02-sidebar.md).
