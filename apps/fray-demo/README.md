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

Vite resolves Glue, Fray, and Fray Visualization to their package source entry
points in this workspace. The review lab therefore exercises the current
component implementation rather than a previous package `dist` build.

The application has a persistent masthead, scope sidebar, routed Portfolio,
Register, Change, and Analysis work areas, and a bottom review harness.
Meridian explicitly places both `fray-fill-horizontal` and
`fray-fill-vertical` on its application root. It therefore occupies exactly
one viewport in both axes; zero-minimum grid tracks and bounded overflow
regions keep the shell on screen while dense content scrolls inside its owning
work area or island. Its canvas is white.
Application policy and reactive state live in `src/app/model`; each shell area
and screen is an independent application component under `src/app/components`
or `src/app/screens`. `main.tsx` is bootstrap only.

Masthead, sidebar, harness, screen panels, and the Register split surface are
one non-nested island layer. No island contains another island.

Only approved or currently reviewed public Fray types are instantiated. The
masthead contains independent `ThemePicker` and `ColorPicker` controls, and the
scope sidebar uses a declarative `TreeView`/`TreeItem` hierarchy. Analysis
composes `CategoryHidePanel`, `SplitSelectionPanel`, `BlockGraph`, and
`LineGraph` around the same filtered population. The deterministic scenario has
144 varied changes, six complete grouping dimensions, three split presets, and
hundreds of civil-date history values. This deliberately crosses the table and
chart data-volume boundary while making every filter and grouping path useful.

The retired Meridian iterations remain historical evidence under
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/).
