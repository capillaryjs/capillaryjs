# Public API surface

Status: accepted for the current public `0.x` line
Updated: 2026-09-03

This document identifies the public `0.x` APIs that receive compatibility
notes and migration guidance. It is not a promise of `1.0` stability.

## Glue stable entry point

| Export | Purpose | Owner |
| --- | --- | --- |
| `FetchState` | Shared `initial`/`loading`/`ready`/`error` state vocabulary. | Glue core |
| `BaseEmitter` | Read/subscription/disposal base contract. | Glue core |
| `Emitter` | Mutable reactive value. | Glue core |
| `DerivedEmitter` | Reactive computation over one or more emitters. | Glue core |
| `EventBubble` | Optional immutable-enough causal event record. | Glue diagnostics |
| `EventBus` | Multi-listener diagnostic observer. | Glue diagnostics |
| `QueryArg` | Named reactive query argument. | Glue query layer |
| `QueryHandler` | Query-handler interface/base class. | Glue query layer |
| `LiveQuery` | Abortable reactive asynchronous query. | Glue query layer |
| `LiveResult`, `RefreshableLiveResult` | Shared local/remote result contract and remote lifecycle extension. | Glue query layer |
| `RestQueryHandler` | Injectable Fetch/URL JSON adapter. | Glue REST adapter |
| `QueryEndpoint` | Immutable custom-handler endpoint declaration. | Glue query layer |
| `RestEndpoint` | Immutable REST endpoint declaration with result parsing. | Glue REST adapter |
| `DerivedEndpoint`, `DerivedLiveResult` | Immutable local endpoint declaration and caller-owned result. | Glue query layer |
| `AsyncCommand` | Abortable mutation lifecycle with explicit concurrency policy. | Glue command layer |

The empty `emitters/derivedEmitter.js` target is not an API. `DerivedEmitter`
is owned by its implementation module and exported once from the package root.
The full emitter, query refresh/error-retention, serializer, and tracing
contracts are documented in `packages/glue/README.md`. Endpoint declarations
are reusable and immutable; each opened query/result is mutable and
caller-owned. Application classes and composition roots own service lifetimes.

## Fray stable entry point

| Export | Purpose | Owner |
| --- | --- | --- |
| `Component` | Browser component lifecycle and renderer. | Fray runtime |
| `h`, `css`, `live` | Vnode/CSS authoring and explicit one-way emitter property binding. | Fray runtime |
| `jsx`, `jsxs`, `jsxDEV`, `Fragment` | Automatic JSX runtime. | Fray runtime |
| `FrayRuntime`, `createFrayRuntime`, `defaultFrayRuntime` | Immutable application-scoped element naming, creation, mounting, and styles. | Fray runtime |
| `ServiceScope`, `createServiceScope`, `defineService`, `provideService` | Typed application service declaration, composition, lazy resolution, and disposal. | Fray runtime |
| `StyleRegistry`, `createStyleRegistry`, `styleRegistry` | Isolated or default idempotent structural-style collection/injection. | Fray styling |
| `frayThemeVariableCatalog` | Machine-readable palette/theme variable hierarchy and fallbacks. | Fray styling |
| `frayThemeOptions`, `frayColorOptions`, `findFrayStylesheetOption`, `replaceFrayStylesheet` | Runtime-selectable treatment and palette catalogs and independent link replacement. | Fray styling |
| `Button`, `Toolbar` | Action and action-layout primitives, including presentation-only busy state. | Fray controls |
| `Textbox`, `Dropdown`, `Toggle`, `ThemePicker`, `ColorPicker` | Value controls, including runtime presentation selection. | Fray controls |
| `Checkbox`, `TriCheckbox`, `QuadCheckbox` | Multi-state controls. | Fray controls |
| `FilterMode` | Semantic vocabulary used by multi-state controls. | Fray controls |
| `Panel`, `Sidebar`, `SplitView`, `Tab`, `TabLine`, `TabPanel` | Region, sidebar, split-pane, and tab layout primitives. | Fray layout |
| `DescriptionList`, `DescriptionItem` | Native term/value record summaries. | Fray data display |
| `ListView`, selection handlers | Keyed single/multi list selection with refresh reconciliation and keyboard/pointer behavior. | Fray data workflow |
| `TreeView`, `TreeItem`, tree model helpers | Accessible keyed trees, node projection, and explicit immutable root updates. | Fray data workflow |
| `DataTable`, table source/query helpers, `FilterPanel` | Local, caller-query, or REST-backed tables with explicit ownership. | Fray data workflow |
| `FilterState` helpers | Semantic multi-dimension matching, reactive derivation, and versioned plain-data persistence. | Fray data workflow |
| `Dialog` | Controlled native modal behavior, focus containment/restoration, and cleanup. | Fray dialog |
| `Placeholder` | Loading-content placeholder used by data components. | Fray data display |
| `ProgressBar` | Labelled determinate or indeterminate native progress. | Fray status |

The package also exposes `./jsx-runtime`, `./jsx-dev-runtime`, generated
`./styles/structural.css`, replaceable `./themes/*/theme.css`, and replaceable
`./colors/*/colors.css` subpaths. The older top-level light/dark stylesheets are
legacy compatibility exports.

`Component.read()` and `Component.snapshot()` are the supported render-time
tracked-read APIs. `WritableEmitter`, `LiveBinding`, `EmitterSnapshot`,
`TemplateProps`, component/vnode/ref types, and runtime/style option types are
public declaration contracts for typed consumers.

Component subclasses author markup in TSX. A wrapped component renders its
runtime-configured element with the protected `this.Host` function component;
native-root components write the native element directly. `h()` remains the
supported no-JSX frontend and canonical vnode operation, but Fray's own
built-in templates do not use it directly.

## Fray host and template contract

Wrapped components render standards-valid custom host elements. The default
runtime uses the `fray-` namespace, while an application-created runtime may
choose another namespace, prefixless standalone names, or exact valid
overrides. Native semantic roots remain their HTML element. Element mapping is
fixed for a runtime, nested components inherit it, each runtime owns an
isolated structural-style registry, and consumer classes are never used as
Fray identity.

TSX, classic JSX, and `h()` share one vnode renderer. A readable emitter is a
fine-grained reactive child when used in child position, but remains the same
object when passed as a normal component prop. `live()` opts a scalar DOM or
component prop into one-way updates. `bind:value` and `bind:checked` are typed
two-way native-control bindings. `read()` and `snapshot()` opt the surrounding
component into rerendering for value/control-flow or value-state-error output.
All renderer-created subscriptions are lifecycle-owned and cleaned up.

## Fray service-scope contract

`defineService<T>()` creates an immutable typed key and `provideService()`
selects its factory at the application composition root. `ServiceScope`
validates fixed provider registrations, creates each service lazily once,
supports explicit factory-to-factory resolution, detects cycles, and disposes
initialized disposable services in reverse creation order. It has no global
registry, decorator metadata, constructor inspection, or transient lookup.

An application passes one scope to `createFrayRuntime({services})`. Nested
class components inherit that runtime, list keys in `static requiredServices`,
and call protected `requireService()` during `initialize()` or later. Missing
services fail before initialization and undeclared lookup fails explicitly.
Function components remain presentation-oriented. Components dispose the live
queries/results they open; they do not dispose scope-shared services.

## Fray Visualization entry point

| Export | Purpose |
| --- | --- |
| `GroupingCriterion`, `staticCriterion`, `derivedCriterion` | Stable-key static or reactive category declarations with sticky visibility state. |
| `filterByHidden`, `categoryCounts` | Reactive blacklist filtering and unfiltered live counts. |
| `SplitSelectionModel`, `createSplitSelection` | Ordered active split state, exact presets, and checkbox adapters. |
| `BlockSelectionModel`, `createBlockSelection` | Reactive strict-partition layout and rebuild-safe path/item selection. |
| `buildBlockLayout`, `criterionSnapshot`, `findBlock` | Pure block calculation and lookup. |
| `CategoryHidePanel`, `SplitSelectionPanel` | Accessible category visibility and pointer/keyboard split controls. |
| `BlockGraph` | Nested proportional mosaic with partition diagnostics and keyboard selection. |
| `SeriesBuilder` | Ordinary and cumulative civil-date history construction. |
| `buildLineChartModel`, path/tick/date helpers | Pure responsive chart calculations. |
| `LineGraph` | Responsive SVG line/stacked-area rendering and pointer/keyboard readout. |

The package also exports generated `./styles/structural.css`. Components
consume caller-owned models and emitters; they do not fetch, persist, or infer
domain policy. Filter predicates may overlap, but every active BlockGraph
criterion must assign each item to exactly one category. History dates are
strict `YYYY-MM-DD` civil dates calculated with UTC-day arithmetic.

## Async command boundary

`AsyncCommand` and `AsyncCommandConcurrencyError` are root exports. The command owns an explicitly configured
abortable mutation lifecycle, observable result/fetch/error state, running
state, concurrency policy, stale-result suppression, reset, and disposal. It
does not provide queuing,
retry, batch, notification, or DOM policy.

## Query endpoint boundary

`QueryEndpoint`, `RestEndpoint`, and `DerivedEndpoint` separate reusable
declaration from live instance ownership. Remote and derived results share the
`LiveResult` read/dispose shape; refresh, retry, abort, and polling are remote
capabilities. `LiveQuery` polling accepts constant or reactive enablement and
intervals plus an injectable scheduler. It skips overlaps and contains no
retry/backoff or visibility policy.

`RestQueryHandler.parseResult` is the optional unknown-to-domain boundary.
Glue has no schema dependency. A body-based read uses an application-owned
custom handler in `QueryEndpoint`; mutations remain `AsyncCommand` executors.
Glue does not provide service registration, dependency injection, global
singletons, or an implicit query cache.

The empty `dialog.js`, `radiobox.js`, and `listviewitem.js` modules are not
exported. They may be implemented by a future proposal, but their filenames do
not reserve public APIs.

## Non-goals

- SSR or hydration, registered Web Components/Shadow DOM, and framework adapters.
- A standalone `.fray` parser, compiler, or language server; TSX is the
  template syntax and `h()`/vnodes are its canonical intermediate form.
- Legacy browsers or a general concurrent/reconciler runtime.
- A production-stable data grid, virtualized lists, or pagination.
- CommonJS unless a concrete consumer demonstrates the need.
- Compatibility promises for unpublished internals.
- Supporting every possible application theme.

See [architecture.md](architecture.md) for the package and runtime boundaries.
