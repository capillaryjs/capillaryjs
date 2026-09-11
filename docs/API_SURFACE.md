# Public API surface

Status: current package-root and documented CSS entry points
Updated: 2026-09-07

This inventory describes the supported public surface of Glue 0.8, Fray 1.1,
and Fray Visualization 0.9. Fray follows 1.x semantic-versioning guarantees.
Glue and Fray Visualization remain on 0.x lines and may make documented
breaking changes in minor releases.

Anything exported only from a source file, test fixture, or build directory is
internal unless it appears below or in a package export map.

## Glue

`@sylwellsoftware/glue` is platform-neutral and exports everything through its
package root.

| Area | Runtime exports | Public type families |
| --- | --- | --- |
| Reactive values | `BaseEmitter`, `Emitter`, `DerivedEmitter` | readable emitter, notification, snapshot update, source/value inference, mapping and option types |
| Fetch state | `FetchState`, `FetchStateValues`, `combineFetchStates` | `FetchStateValue` |
| Live queries | `QueryArg`, `LiveQuery` | argument, `LiveQueryExecution`, polling, scheduler, `LiveResult`, and `RefreshableLiveResult` contracts |
| Retrieval | `QueryHandler`, `RestQueryHandler` | handler, request, Fetch/URL/response, serializer, parser, and REST option contracts |
| Endpoints | `QueryEndpoint`, `RestEndpoint`, `DerivedEndpoint`, `DerivedLiveResult`, `queryEndpoint`, `restEndpoint`, `derivedEndpoint` | declaration and open-result option types |
| Commands | `AsyncCommand`, `AsyncCommandConcurrencyError` | executor, context, concurrency, and option types |
| Diagnostics | `EventBubble`, `EventBus` | event options/listener and `BubbleGraph` |
| Utility | — | `NonEmptyArray` |

Important compatibility boundaries:

- Every readable value provides a synchronous value, fetch state, error, and
  subscription. Notifications have one `{value, fetchState, error, event}`
  shape.
- Endpoint declarations are immutable and reusable. Each `open()` result is
  mutable and caller-owned.
- `LiveQuery` decides when to execute and protects latest-result ownership. Its
  handler decides how retrieval, authentication, wire serialization, and
  response validation work.
- The `LiveQuery` `execution` option is `immediate`, one-way `deferred` activation, or
  permanently `explicit`; `activate()` is idempotent and subscriptions never
  imply activation. Historical `autoFetch: false` still skips only the
  initial request.
- `AsyncCommand` owns one mutation lifecycle and an explicit `ignore`,
  `replace`, or `reject` concurrency policy. Follow-up query state remains
  independent.
- Diagnostics observe causality but do not retain event history or owners.

See the [Glue guide](../packages/glue/README.md) for full behavior and ownership
rules.

## Fray

`@sylwellsoftware/fray` is a browser-only presentation runtime with Glue as a
peer dependency.

### Runtime and templates

| Export | Purpose |
| --- | --- |
| `Component` | Explicit class-component lifecycle, tracked emitter reads, cleanup, service access, and keyed rendering |
| `FrayApp`, `mountFrayApp` | Fixed `fray-app` root, theme-text boundary, bounded child-layout option, and CSS-registering application mount helper |
| `Fragment`, `jsx`, `jsxs`, `jsxDEV` | Automatic JSX runtime |
| `h` | Low-level vnode factory retained for non-JSX integrations |
| `FrayHostElementTagNameMap`, `FrayElementTagNameMap` | Custom `fray-*` host element tag maps that extend JSX intrinsic elements |
| `css` | Static CSS template helper |
| `live` | Explicit one-way emitter binding for DOM properties and allowlisted component props |
| `FrayRuntime`, `createFrayRuntime`, `defaultFrayRuntime` | Application-scoped component creation, mounting, styles, services, and optional routing |
| `StyleRegistry`, `createStyleRegistry`, `styleRegistry` | Dependency-aware structural CSS collection and injection |

Public declaration contracts include component constructors/dependencies,
props, children, vnodes, keys, refs, writable emitters, live bindings and prop
contracts, emitter snapshots, template props, runtime options, and style
registry types.

The root exports `FrayLayoutDirection`, `FrayLayoutAllocation`, direction-prop
contracts, and `FrayLayoutParticipantProps`. Public structural classes provide horizontal or
vertical direct-child arrangement, natural or flexible main-axis allocation,
and explicit bounded scrolling. `FrayApp.layout` targets the bounded root;
`Layout`, `Header`, `NavigationBar`, `Panel`, `Sidebar`, `SplitView`, and
`Toolbar` opt into the `allocation` argument. Layout is the sole generic layout
component; Panel composes it as a themed content body; SplitPrimary and
SplitSecondary specialize it as the required panes around SplitView's
accessible resizable separator. Application-owned semantic elements may use
the same classes directly. Breakpoints, persisted split sizes, exact dimensions,
ratios, and gaps remain application policy.

TSX is the primary documented authoring syntax. TSX and `h()` lower to the
same vnode representation. A readable emitter in child position owns a
fine-grained binding range; normal props preserve the original object.
`Component.read()` and `snapshot()` establish render-time tracked dependencies.
`bind:value` and `bind:checked` are typed two-way bindings for native controls.

`DeclarativeRegion` and `readDeclarativeRegions()` support parent-specific,
non-visual named content regions. `PanelToolbar`, `SidebarToolbar`,
`DialogActions`, and `OptionGroupHeaderEnd` expose the non-visual built-in
region contracts. `SplitPrimary` and `SplitSecondary` are instead visible,
named Layout panes required directly by SplitView. Substantial
rendered content stays in the JSX child tree; configuration remains in props.

Components with no suitable native root declare a fixed host stem. A runtime
resolves it to `fray-<stem-without-hyphens>`. Runtime-configurable element names
were removed and are not supported. These light-DOM hosts are not registered
custom elements.

### Components

| Family | Public components |
| --- | --- |
| Actions | `Button`, `Toolbar` |
| Text and choices | `Label`, `Textbox`, `Dropdown`, `RadioButton`, `RadioGroup`, `Toggle`, `Checkbox`, `TriCheckbox`, `QuadCheckbox` |
| Layout and navigation | `FrayApp`, `Layout`, `Header`, `GroupPanel`, `NavigationBar`, `OptionGroup`, `OptionGroupHeaderEnd`, `OptionsPanel`, `Panel`, `PanelToolbar`, `Sidebar`, `SidebarToolbar`, `SplitPrimary`, `SplitSecondary`, `SplitView`, `Tab`, `TabLine`, `TabPanel` |
| Records and collections | `DescriptionItem`, `DescriptionList`, `InfoField`, `InfoPanel`, `Placeholder`, `ListView`, `TreeItem`, `TreeView` |
| Tables and filters | `DataTable`, `FilterPanel`, `TableHeader`, `TableHeaderCell` |
| Dialog and status | `Dialog`, `DialogActions`, `ProgressBar` |
| Presentation selection | `ThemePicker`, `ColorPicker` |
| Date and time (experimental) | `DatePicker`, `DateTimePicker`, `TimePicker` |

Every component and its key props are documented in the
[Fray component reference](../packages/fray/README.md#component-reference).
Notable public behavior:

- Value controls expose `valueEmitter`; `defaultValue` initializes uncontrolled
  state. The old `value` form is an initial-value compatibility alias, not a
  continuously controlled prop.
- `Button` busy state is presentational availability. Application commands and
  their lifecycle stay in Glue/application code.
- List, tree, and table selection reconcile fresh objects by stable key.
- `TreeView` provides controlled selection and expansion, keyboard navigation,
  typeahead, and per-label class/style callbacks.
- `DataTable` accepts exactly one of direct `data`, a caller-owned
  `dataSource`, or table-owned `rest` options.
- `Dialog` uses a native modal surface with focus containment and restoration.
- `GroupPanel` is a named group with a bordered body and vertical header.
- `OptionGroup` renders a labelled `fieldset`/`legend` shell and accepts an
  `OptionGroupHeaderEnd` declarative region child.
- `OptionsPanel` extends `GroupPanel` with a flex-column content area for `OptionGroup` children.
- `ContentMountPolicy` selects eager, lazy-retained, or active-only content
  lifetime for `TabPanel` and `RouteOutlet`; `TabPanelMountPolicy` remains an
  alias while tabs preserve semantic tabpanel shells.

### Data helpers

Fray exports the following data-model utilities from its root:

- `FilterMode` and semantic filter state types; `matchesFilterState`,
  `filterByState`, `deriveFilterPredicate`, `deriveFilteredItems`,
  `serializeFilterState`, and `parseFilterState`;
- `BaseSelectionHandler`, `SingleSelectionHandler`, `MultiSelectionHandler`,
  `createSelectionHandler`, `defaultItemKey`, and selection/key types;
- `TreeNode`, `assertTreeNodes`, `findTreeNode`, `deriveTreeNode`,
  `updateTreeNode`, and `updateWritableTreeNode`;
- `createLocalTableDataSource`, `createQueryTableDataSource`,
  `createHandlerTableDataSource`, `createRestTableDataSource`, table data-source
  contracts, sort/filter/query types, local application and serialization
  helpers;
- column, row, header, and filter option types used by `DataTable`.

Component-created sources are component-owned. Explicit sources passed by a
caller remain caller-owned.

### Services

| Export | Purpose |
| --- | --- |
| `defineService`, `ServiceKey` | Typed service identity |
| `provideService`, `ServiceProvider` | Composition-root factory selection |
| `ServiceScope`, `createServiceScope`, `ServiceResolver` | Fixed lazy scope, explicit dependency resolution, reverse-order disposal |

A runtime receives one scope through `createFrayRuntime({services})`. Nested
class components list `static requiredServices` and call `requireService()`
during `initialize()` or later. Missing providers, undeclared lookups, duplicate
providers, and cycles fail explicitly. There is no global registry, decorator
metadata, constructor inspection, or transient service lifetime.

### Routing

| Area | Public exports |
| --- | --- |
| Vocabulary | `defineRoute`, `defineRouteParameter`, `routeParameter`, `routeTarget`, `withRouteQuery`, route codecs/targets/descriptors, `redirectTo`, `RouteRedirect`, `RouteUnavailableError` |
| Router | `BrowserRouter`, `createBrowserRouter`, resolved route, transition, issue, registration, and option types; `waitForRouteValue` |
| Placement | `NavigationAdapter`, `createHistoryNavigation`, `createHashNavigation`, `MemoryNavigationAdapter`, location normalizer |
| Components | `RouteScope`, `RouteValue`, `RouteQuery`, `RouteLink`, `RouteOutlet`, `NavigationBar`, and prop/definition types |

Descriptors are immutable relative vocabulary. Mounted scopes establish
lineage and are discovered progressively. `RouteValue` binds one dynamic
segment to a writable emitter; `RouteQuery` binds one explicit query name;
`RouteLink` renders a real anchor, and `NavigationBar` groups those links in a
labelled native navigation list without owning destination DOM. Routed
`TabPanel` and `RouteOutlet` content register immediate literal child routes.
An outlet applies `ContentMountPolicy`, writes restoration to an
application-owned selection emitter, and supplies the selected branch's nested
scope; disconnected projections observe the same emitter without registering
the routes again.

Restoration never pushes history. Explicit navigation pushes by default;
redirects, fallback, canonicalization, and passive binding updates replace.
Resolvers are application-owned and cancellable. Failure settles at the
deepest valid parent and exposes structured issue state for application-owned
presentation. The caller owns and disposes the router.

### Styling and CSS entry points

The package exports:

- `./jsx-runtime` and `./jsx-dev-runtime`;
- `./themes/base.css` for defaults and palette derivation;
- `./styles/structural.css` for the complete generated component structure;
- named `./themes/<name>/theme.css` files;
- named `./colors/<name>/colors.css` files.

The root also exports `frayThemeVariableCatalog`, theme/color option catalogs,
stylesheet lookup and replacement helpers, and appearance get/set helpers.

Presentation loads as base variables, structural CSS, color anchors, then
theme overrides. Applications can collect structural CSS from declared root
dependencies instead of loading the complete artifact.

`NavigationBar` consumes its own `--navigation-bar-*` container and
`--navigation-link-*` item variables. These defaults are text-link navigation,
not aliases of the generic `--button-*` action family.

`FrayApp` has a fixed `fray-app` host, applies the published canvas, color, and
typography variables even when embedded, and offers independent viewport-axis
settings, horizontal/vertical child arrangement on the bounded root, plus a
`main`/`none` landmark policy. `mountFrayApp()` collects and
injects its declared structural CSS before mounting. The legacy
`fray-fill-horizontal` and `fray-fill-vertical` application-root traits remain
available and apply the same canvas, color, and typography values.

`fray-layout-horizontal`, `fray-layout-vertical`, `fray-size-natural`,
`fray-size-flexible`, and `fray-scroll` are additive structural traits. Layout
only distributes an existing bound; flexible allocation does not imply
overflow. Existing component and filled-island overflow remain compatibility
defaults, while an explicit inner scroll owner determines actual scroll range.

The `Layout` component maps required `horizontal` or `vertical` modifiers to
the direction traits. Panel uses Layout for its body. SplitView requires its
named SplitPrimary and SplitSecondary Layout panes and inserts a focusable
separator supporting pointer drag, arrow keys, Home, and End.

`island` marks one explicit, non-nestable surface boundary. `colored` consumes
application-supplied `--c1`, `--c2`, and `--c3` values for a shared gradient
and `--colored-shadow`. Themes may change the values consumed by these traits
but do not own their selectors.

## Fray Visualization

`@sylwellsoftware/fray-visualization` is an optional analytical layer. It peers
on Glue and Fray and exports a root module plus
`./styles/structural.css`.

| Area | Public exports |
| --- | --- |
| Categories | `GroupingCriterion`, `staticCriterion`, `derivedCriterion`, `deriveCategories`, `filterByHidden`, `categoryCounts`, `categoryColorVariables`, `setsEqual` and category/visibility option types |
| Ordered splits | `SplitSelectionModel`, `createSplitSelection`, `SplitPreset` |
| Blocks | `BlockSelectionModel`, `createBlockSelection`, `buildBlockLayout`, `criterionSnapshot`, `findBlock` and block node/path/layout/issue types |
| History | `SeriesBuilder`, `HistoryShape`, `SeriesCategory` |
| Civil dates | `CivilDate`, `civilDateToDay`, `dayToCivilDate`, `addCivilDays`, `todayCivilDate`, `compareCivilDates` |
| Chart calculation | `buildLineChartModel`, `linePath`, `areaPath`, `valueAtDate`, `buildIntegerTicks` and chart model types |
| Components | `CategoryHidePanel`, `SplitSelectionPanel`, `BlockGraph`, `LineGraph` and their props |

The package never fetches or persists application data. Criteria, derived
emitters, split models, and block models are caller-owned. Every active block
criterion must partition each parent exactly; unmatched and multiply matched
items are reported rather than guessed. Dates are strict civil `YYYY-MM-DD`
values calculated with UTC-day arithmetic.

See the [Visualization guide](../packages/fray-visualization/README.md) for the
component contracts and examples.

## Non-goals

The public stack does not provide:

- server-side rendering or hydration;
- registered Web Components or Shadow DOM;
- a global application/service store, hooks, or hidden dependency discovery;
- application authentication, persistence, endpoint vocabulary, or domain
  validation policy;
- built-in pagination or table virtualization;
- CommonJS builds or legacy-browser compatibility;
- automatic theme selection or a nested theme/palette scope;
- a retained diagnostic history store.
