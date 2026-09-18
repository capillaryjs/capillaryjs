# Component gallery

A public demo application that tours the Capillary UI, Capillary, and Capillary Viz
component surfaces inside one routed shell. It is the framework-side companion
to the private `layout-demo` app: where layout-demo exercises allocation
scenarios, this app exercises real component compositions.

The app is being rebuilt step by step. The current shell provides the shared
controls every gallery page consumes; pages are added one at a time.

## Shell controls

The header island carries the page navbar and a control toolbar below it:

- **Layout** — a `Toggle` switching `CapillaryUiApp` between **App shell**
  (`sizing="viewport"`, the application owns the viewport and each region owns
  its scrolling) and **Website** (`sizing="embedded"`, the application grows
  with its content inside a centered, max-width column and the document
  scrolls).
- **Theme / Colors** — `ThemePicker` and `ColorPicker` swap the loaded Capillary UI
  theme and color stylesheets.
- **Emitter state** — a `Toggle` selecting the shared fetch state (`initial`, `ready`,
  `loading (refresh)`, `loading (replace)`, `error`) applied to
  `GalleryModel.dataItems`, the shared emitter gallery pages bind data-aware
  components to. Refresh loading retains visible data and marks it busy;
  replacement loading presents placeholders until a value arrives. Loading and
  error also drive the corresponding busy or error presentation on the
  line-input page, so the selector demonstrates one emitter state consistently
  throughout the gallery. The error state raises a simulated load error.
- **Component state** — checkboxes for `disabled`, `required`, `read-only`,
  a `busy` override, and a validation-error override exposed on `GalleryModel`
  for gallery pages to apply to showcased controls.

Both layout variants render the same island structure: a header island with
the navbar and control toolbar, a routed page body, and a footer island with
the status line. The app enables `islands` once: nested page layouts and the
RouteOutlet inherit shared `--island-gap` gutters, while the app contributes
one `--island-inset`. Island margins no longer accumulate between these regions;
controls inside each surface retain their component/application spacing. White
keeps the whole composition flush through its zero gap token.

## Pages

| Page | Content |
| --- | --- |
| Line inputs | One island and one combined `PanelToolbar`, with three section rows (checkboxes, basic inputs, date/time). Each row contains vertical `GroupBox` columns of intrinsic states and content variants. Shared `live()` flags apply throughout. Groups grow toward a soft 15rem preference, accommodate wider content, and shrink fields before wrapping. The sidebar offers section navigation, an evenly inset Filters group, and shared data state. |
| Data components | `DataTable`, `ListView`, `TreeView`, and `BlockGraph` share the toolbar-controlled emitter. Initial and replacement loading render skeletons; refresh loading retains data while busy; Ready shows data. Error and table retry remain distinct. BlockGraph groups by team and status; its models are owned and disposed by `GalleryModel`. A separate panel keeps ready-but-empty table/list/tree examples visible. |

Navigation uses the public router (`createBrowserRouter` +
`createHashNavigation`), a `NavigationBar` of `RouteLink`s, and a `RouteOutlet`
that mounts page content lazily.

Line-input columns use the framework's shared control-row spacing, not
gallery-specific gaps: checkboxes, radios, fields, buttons, and progress bars
occupy equal-height rows with built-in vertical breathing room. OptionsBox
is the deliberate compact exception. Browser tests cover the column rhythm
in Shiny and Capillary as well as the shared control fixture across all themes.

## Commands

The public workspace's `pnpm test:browser` includes this gallery in Chromium,
Firefox, and WebKit, covering both layout variants and refresh transitions.
It also samples rendered screenshot pixels at the sidebar/main-panel edges,
so a defined but clipped shadow cannot pass as visible chrome. The shared
island fixture checks borders and shadows through nested scrollports, at
scroll endpoints, and in resizable split panes.

```bash
pnpm --filter @sylwellsoftware/component-gallery dev        # http://127.0.0.1:3002
pnpm --filter @sylwellsoftware/component-gallery typecheck
pnpm --filter @sylwellsoftware/component-gallery test
pnpm --filter @sylwellsoftware/component-gallery build
pnpm --filter @sylwellsoftware/component-gallery preview    # http://127.0.0.1:4174
```

The app is also included in the framework root `typecheck`, `test`, and
`pnpm verify` covers the app through the framework root `typecheck`, `test`,
and `build` scripts.

The demo runs entirely on local reactive state; there is no backend.
