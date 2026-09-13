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
  `loading`, `error`) applied to `GalleryModel.dataItems`, the shared
  emitter gallery pages bind data-aware components to. Loading and error also
  drive the corresponding busy or error presentation on the line-input page,
  so the selector demonstrates one emitter state consistently throughout the
  gallery. The error state raises a simulated load error.
- **Component state** — checkboxes for `disabled`, `required`, `read-only`,
  a `busy` override, and a validation-error override exposed on `GalleryModel`
  for gallery pages to apply to showcased controls.

Both layout variants render the same island structure: a header island with
the navbar and control toolbar, a routed page body, and a footer island with
the status line.

## Pages

| Page | Content |
| --- | --- |
| Line inputs | Every line-input control across three island panels (checkboxes, basic inputs, date/time), each with a `PanelToolbar` so controls render in both panel and toolbar contexts. `OptionGroup` fieldsets hold one instance per intrinsic state and content variant; every flag-capable prop binds the shared toolbar emitters via `live()`, so toggling a header flag makes that state the uniform expectation across the page and themed outliers stand out. The sidebar offers section navigation and reports the shared data state. |
| Data components | `DataTable`, `ListView`, and `TreeView` share the toolbar-controlled emitter to demonstrate initial skeletons, retained-row loading, ready rows, visible errors, and table retry. A separate panel keeps ready-but-empty examples visible for comparison. |

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

The demo runs entirely on local reactive state; there is no backend.
