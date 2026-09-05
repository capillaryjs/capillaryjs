# Fray style lab

This public, non-publishable workspace application is Fray's deterministic CSS
review harness. Its layout stylesheet is application-owned; Fray structural,
palette, and theme CSS are loaded separately.

Run it from `framework`:

```sh
pnpm --filter @sylwellsoftware/fray-demo dev
```

The lab starts with only the shared foundation. A component family is added
only after the maintainer has selected its review scope and states.
