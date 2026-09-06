# Fray style lab

This public, non-publishable workspace application is Fray's deterministic CSS
review harness. It has been reset to a native application shell so Change 009
can approve one Fray component at a time.

Run it from `framework`:

```sh
pnpm --filter @sylwellsoftware/fray-demo dev
```

The page loads exactly four Fray styling inputs in this order: an external
`base.css` link, runtime-injected structural CSS collected from declared
component dependencies, an external `colors.css` link, and an external
`theme.css` link. The runtime-injected structural stylesheet is the only inline
Fray stylesheet. `style-lab.css` is separate application-owned page layout.

The current fourth slice introduces `SplitView` while retaining every approved
component the page still displays: `Header`, `Panel`, and `Sidebar`. The root
registers exactly those four types, so their CSS remains reachable and every
other component's CSS remains absent. The lab covers SplitView's labelled,
bounded horizontal panes and explicit primary size, alongside the earlier
Panel/Sidebar states and native application content.

The retired Meridian iterations remain historical evidence under
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/).
