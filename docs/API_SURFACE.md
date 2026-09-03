# Alpha API surface

Status: accepted for the current public `0.x` line
Updated: 2026-09-03

Glue and Fray are experimental browser-toolkit packages. The stable alpha
surface below is deliberately narrow: it identifies which `0.x` APIs receive
compatibility notes and migration guidance. It is not a promise of `1.0`
stability.

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
| `RestQueryHandler` | Injectable Fetch/URL JSON adapter. | Glue REST adapter |

The empty `emitters/derivedEmitter.js` target is not an API. `DerivedEmitter`
is owned by its implementation module and exported once from the package root.
The full emitter, query refresh/error-retention, serializer, and tracing
contracts are documented in `packages/glue/README.md`.

## Fray stable entry point

| Export | Purpose | Owner |
| --- | --- | --- |
| `Component` | Browser component lifecycle and renderer. | Fray runtime |
| `h`, `css`, `live` | Vnode/CSS authoring and explicit one-way emitter property binding. | Fray runtime |
| `jsx`, `jsxs`, `jsxDEV`, `Fragment` | Automatic JSX runtime. | Fray runtime |
| `FrayRuntime`, `createFrayRuntime`, `defaultFrayRuntime` | Immutable application-scoped element naming, creation, mounting, and styles. | Fray runtime |
| `StyleRegistry`, `createStyleRegistry`, `styleRegistry` | Isolated or default idempotent structural-style collection/injection. | Fray styling |
| `frayThemeVariableCatalog` | Machine-readable color/theme variable hierarchy and fallbacks. | Fray styling |
| `frayThemeOptions`, `frayColorOptions`, `findFrayStylesheetOption`, `replaceFrayStylesheet` | Runtime-selectable treatment and palette catalogs and independent link replacement. | Fray styling |
| `Button`, `Toolbar` | Action and action-layout primitives, including presentation-only busy state. | Fray controls |
| `Textbox`, `Dropdown`, `Toggle`, `ThemePicker`, `ColorPicker` | Value controls, including runtime presentation selection. | Fray controls |
| `Checkbox`, `TriCheckbox`, `QuadCheckbox` | Multi-state controls. | Fray controls |
| `FilterMode` | Semantic vocabulary used by multi-state controls. | Fray controls |
| `Panel`, `Sidebar`, `SplitView`, `Tab`, `TabLine`, `TabPanel` | Region, sidebar, split-pane, and tab layout primitives. | Fray layout |
| `DescriptionList`, `DescriptionItem` | Native term/value record summaries. | Fray data display |
| `ProgressBar` | Labelled determinate or indeterminate native progress. | Fray status |

The package also exposes `./jsx-runtime`, `./jsx-dev-runtime`, generated
`./styles/structural.css`, replaceable `./themes/*/theme.css`, and replaceable
`./colors/*/colors.css` subpaths. The older top-level light/dark stylesheets are
temporary alpha compatibility exports.

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

## Experimental entry points

`@sylwellsoftware/glue/experimental` exports `AsyncCommand` and
`AsyncCommandConcurrencyError`. The command owns an explicitly configured
abortable mutation lifecycle, observable result/fetch/error state, running
state, concurrency policy, stale-result suppression, reset, and disposal. It
does not belong to Glue's stable alpha surface and does not provide queuing,
retry, batch, notification, or DOM policy.

`@sylwellsoftware/fray/experimental` is the only intended alpha entry point for
`ListView`, `DataTable`, `TreeView`, `TreeItem`, `Dialog`, filter/table helpers,
selection handlers, and `Placeholder`. These APIs are labeled experimental,
receive best-effort fixes, and may change in any prerelease without a
compatibility bridge.

The empty `dialog.js`, `radiobox.js`, and `listviewitem.js` modules are not
exported. They may be implemented by a future proposal, but their filenames do
not reserve public APIs.

## Alpha non-goals

- SSR or hydration, registered Web Components/Shadow DOM, and framework adapters.
- A standalone `.fray` parser, compiler, or language server; TSX is the alpha
  template syntax and `h()`/vnodes are its canonical intermediate form.
- Legacy browsers or a general concurrent/reconciler runtime.
- A production-stable data grid, virtualized lists, or pagination.
- CommonJS unless a concrete consumer demonstrates the need.
- Compatibility promises for experimental subpaths or unpublished internals.
- Supporting every possible application theme.

See [architecture.md](architecture.md) for the package and runtime boundaries.
