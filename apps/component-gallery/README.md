# Component gallery

A public demo application that tours the Fray, Glue, and Fray Visualization
component surfaces inside one routed shell. It is the framework-side companion
to the private `layout-demo` app: where layout-demo exercises allocation
scenarios, this app exercises real component compositions.

## Layout variants

A `Toggle` in the header island switches `FrayApp` between two sizing modes:

- **App shell** (`sizing="viewport"`): the application owns the viewport and
  each region (sidebar body, panel content, route outlet) owns its own
  scrolling.
- **Website** (`sizing="embedded"`): the application grows with its content
  inside a centered, max-width column and the document scrolls.

Both variants render the same island structure: a header island with the page
navbar, an island sidebar per page, a main content area with an island control
panel on top and a data control area below, and a footer island with the theme
and color pickers.

## Pages

| Page | Sidebar | Control panel | Data area |
| --- | --- | --- | --- |
| Data grid | `Panel`-style island with `Textbox`, `Dropdown`, `Checkbox`, native checkbox | `FilterPanel` + `Toolbar` | `DataTable` |
| Explorer | `TreeView` | Chart option checkboxes + `DescriptionList` | `LineGraph` |
| Directory | `ListView` | `DescriptionList` + `Dialog` trigger | `DataTable` |
| Analytics | `OptionsPanel` with `CollapsibleOptionGroup` accordion (`CategoryHidePanel`, `SplitSelectionPanel`) | Selection summary + `Toolbar` | `BlockGraph` + `LineGraph` in a `SplitView` |
| Forms | `OptionsPanel` with `OptionGroup` state/semantics controls | Line inputs (`Textbox`, `Dropdown`, `Toggle`, `RadioGroup`, `Checkbox`, `DatePicker`, `TimePicker`, `DateTimePicker`, `ProgressBar`) + `Dialog` | `DataTable` of submissions |

Navigation uses the public router (`createBrowserRouter` +
`createHashNavigation`), a `NavigationBar` of `RouteLink`s, and a `RouteOutlet`
that mounts page content lazily.

## Commands

```bash
pnpm --filter @sylwellsoftware/component-gallery dev        # http://127.0.0.1:3002
pnpm --filter @sylwellsoftware/component-gallery typecheck
pnpm --filter @sylwellsoftware/component-gallery test
pnpm --filter @sylwellsoftware/component-gallery build
pnpm --filter @sylwellsoftware/component-gallery preview    # http://127.0.0.1:4174
```

From the outer repository root, the same entry points are available as Gradle
tasks:

```bash
./gradlew componentGalleryDev       # dev server at http://127.0.0.1:3002
./gradlew componentGalleryBuild     # typecheck + vite build
./gradlew componentGalleryPreview   # build + preview at http://127.0.0.1:4174
```

The app is also included in the framework root `typecheck`, `test`, and
`build` scripts, so `pnpm verify` (and `./gradlew frameworkCheck`) covers it.

The demo runs entirely on a deterministic in-memory service catalog; there is
no backend.
