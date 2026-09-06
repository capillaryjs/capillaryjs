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

The current Meridian Change Office registers `Button`, `Checkbox`, `DataTable`,
`DescriptionItem`, `DescriptionList`, `Dialog`, `Dropdown`, `FilterPanel`, `Panel`,
`Placeholder`, `ProgressBar`, `QuadCheckbox`, `RadioButton`,
`RadioGroup`, `Sidebar`, `SplitView`, `TabPanel`, `Textbox`, `Toggle`,
`Toolbar`, `TableHeader`, `TableHeaderCell`, and `TriCheckbox`, so their structural CSS remains reachable and
unrelated component CSS remains absent. Application-owned scope, status,
search, risk, and attention state update Portfolio, Register, and Change
together. Sidebar scope uses RadioGroup; TabPanel now owns the work-area
switching, preserves inactive work areas, and registers the application-owned
`#/portfolio`, `#/register`, and `#/change` routes; SplitView belongs in
Register; DataTable now supplies its selectable Change Register, with
application-owned sort and filter emitters; ProgressBar presents Portfolio
completion; and FilterPanel reports Meridian's application-owned advanced
risk-map replacements as well as the table Risk filter. Native
review-harness controls exercise documented availability and validation states
outside the application shell.

The retired Meridian iterations remain historical evidence under
[`docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/`](../../../docs/changes/009-css-overhaul/discussions/demo-app-concept/iterations/).
