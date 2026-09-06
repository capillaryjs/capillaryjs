# Fray style lab

This public, non-publishable workspace application is Fray's deterministic CSS
review harness. It composes the approved Change 009 components into the
Meridian Change Office reference application.

Run it from `framework`:

```sh
pnpm --filter @sylwellsoftware/fray-demo dev
```

The page loads exactly four Fray styling inputs in this order: an external
`base.css` link, runtime-injected structural CSS collected from declared
component dependencies, an external `colors.css` link, and an external
`theme.css` link. The runtime-injected structural stylesheet is the only inline
Fray stylesheet. `style-lab.css` is separate application-owned page layout.

The application has a persistent masthead, scope sidebar, routed Portfolio,
Register, Change, and Analysis work areas, and a bottom review harness.
Application policy and reactive state live in `src/app/model`; each shell area
and screen is an independent application component under `src/app/components`
or `src/app/screens`. `main.tsx` is bootstrap only.

Only approved public Fray types are instantiated. The pending `TreeView`,
`TreeItem`, `CategoryHidePanel`, `SplitSelectionPanel`, `BlockGraph`, and
`LineGraph` roles remain visible as named application placeholders, as do the
future header appearance controls. This preserves the intended overall layout
without importing unreviewed component CSS.

The retired Meridian iterations remain historical evidence under
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/).
