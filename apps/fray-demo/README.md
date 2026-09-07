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

The application has a persistent masthead, a two-surface navigation rail,
routed Portfolio, Register, Change, and Analysis work areas, and a bottom
review harness. The navigation rail keeps organisational scope separate from
the persistent status and planning-horizon view controls.
Meridian explicitly places both `fray-fill-horizontal` and
`fray-fill-vertical` on its application root. It therefore occupies exactly
one viewport in both axes; zero-minimum grid tracks and bounded overflow
regions keep the shell on screen while dense content scrolls inside its owning
work area or island. Its canvas is white.
Application policy and reactive state live in `src/app/model`; each shell area
and screen is an independent application component under `src/app/components`
or `src/app/screens`. `main.tsx` is bootstrap only.

Masthead, Scope Sidebar, View Panel, harness, and the named screen Panels form
one non-nested island layer. Layout wrappers, the routed TabPanel, and the
Register SplitView are not islands; the SplitView places the Change Register
and Selected Change Panels as sibling islands.

Only approved or currently reviewed public Fray types are instantiated. The
review harness contains independent `ThemePicker` and `ColorPicker` controls,
and the scope sidebar uses a declarative `TreeView`/`TreeItem` hierarchy.
Portfolio has a full-width summary above an attention stack and durable current
selection. Register separates query controls, semantic criteria, its table,
and selection preview. Change uses a full-width summary above three sibling
work panels. Analysis composes separate visibility and grouping Panels beside
stacked distribution and history Panels.

Application state mirrors that structure. `scopedChanges` is shared persistent
scope; `attentionChanges` adds Portfolio-only attention policy;
`registerChanges` adds Register-only query and criteria policy; and Analysis
adds category visibility to the shared scope. `selectedChange` remains durable
by ID when a local screen filter temporarily excludes it. The deterministic
scenario has 144 varied changes, six complete grouping dimensions, three split
presets, and hundreds of civil-date history values.

The retired Meridian iterations remain historical evidence under
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/).
