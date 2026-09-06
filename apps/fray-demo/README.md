# Fray style lab

This public, non-publishable workspace application is Fray's deterministic CSS
review harness. It has been reset to a native application shell so Change 009
can approve one Fray component at a time.

Run it from `framework`:

```sh
pnpm --filter @sylwellsoftware/fray-demo dev
```

The page loads exactly four Fray styling inputs: variable-only `base.css`, the
runtime-injected structural CSS collected from declared component dependencies,
one `colors.css`, and one variable-only `theme.css`. `style-lab.css` is separate
application-owned page layout. No Fray component is currently mounted, so the
structural stylesheet is intentionally empty until the first slice is selected.

The retired Meridian iterations remain historical evidence under
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/).
