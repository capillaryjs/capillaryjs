# Fray

Fray is a browser-only TypeScript component runtime built around Glue
emitters. It provides TSX rendering, explicit component lifecycle, accessible
controls and data views, scoped services and routing, and dependency-collected
structural CSS.

Fray 1.x is ESM-only and targets current evergreen browsers. Install it with
its Glue peer:

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray
```

## Design and ownership

Fray presents application values without moving them into a second UI-specific
state system. Controls write ordinary Glue emitters, components read the
downstream values they need, and applications retain ownership of domain
policy and asynchronous work.

```text
application
  domain policy, composition, services, endpoints, routes, theme selection
                              │
                              ▼
Fray
  TSX, DOM, events, lifecycle, accessibility, structural presentation
                              │ get / subscribe / set
                              ▼
Glue
  mutable values, derived values, live queries, commands, diagnostics
```

The boundaries are deliberate:

| Concern | Owner |
| --- | --- |
| Domain state, validation policy, endpoint configuration, service providers, routes, page composition | Application |
| DOM structure, native events, accessible semantics, component lifetime, visual async states | Fray |
| Mutable and computed values, query execution and status, command lifecycle, optional causality | Glue |
| Retrieval, wire serialization, persistence | Application-supplied handlers and adapters |
| Structural selectors and component layout | Fray component CSS |
| Theme treatment, palette, application layout | Separately loaded CSS and application CSS |

Fray prefers native HTML when it expresses the contract. Custom `fray-*`
hosts are readable light-DOM ownership and styling boundaries; they are not
registered custom elements and do not use Shadow DOM.

## Set up TSX

Use Fray's automatic JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@sylwellsoftware/fray"
  }
}
```

Load the variable base, one color palette, and one theme. `FrayApp` is the
normal application shell: it renders a fixed `fray-app` host, applies the
theme canvas and typography, and has an accessible primary-content landmark by
default. `mountFrayApp()` collects reachable structural CSS before mounting:

```tsx
import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    FrayApp,
    Panel,
    Textbox,
    Toolbar,
    createFrayRuntime,
    mountFrayApp,
} from '@sylwellsoftware/fray'

import '@sylwellsoftware/fray/themes/base.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
import '@sylwellsoftware/fray/themes/minimal/theme.css'

class ProfileApp extends FrayApp {
    readonly name = new Emitter('Ada')

    protected override renderContent() {
        return <Panel
            header="Profile"
            toolbar={<Toolbar label="Profile actions">
                <Button label="Save" onClick={() => this.save()} />
            </Toolbar>}
        >
            <Textbox label="Name" valueEmitter={this.name} />
        </Panel>
    }

    onDestroy() {
        this.name.dispose()
    }

    private save() {
        console.log(this.name.get())
    }

    static dependencies = [Button, Panel, Textbox, Toolbar]
}

const runtime = createFrayRuntime()
mountFrayApp(runtime, ProfileApp, document.querySelector('#app')!, {
    sizing: 'viewport',
    layout: 'vertical',
})
```

`FrayApp` may also be instantiated directly with `children`. Derived apps
override `renderContent()`. Its `sizing` is `embedded`, `viewport-width`,
`viewport-height`, or `viewport`; `layout` is `horizontal` or `vertical` and
arranges application-owned children directly on that bounded host; `landmark`
is `main` (the default) or `none` for an embedded app. `static dependencies` is transitive and idempotent. It
declares the Fray and application components whose structural CSS the root can
render. `FrayApp` itself registers and injects those styles whenever it
attaches; `mountFrayApp()` is the concise normal entry point. Applications that
prefer a complete static asset may import
`@sylwellsoftware/fray/styles/structural.css` instead of collecting styles.

`FrayApp` deliberately does not select a palette, theme, appearance mode,
services, router, routes, or domain state. Those remain application policy.

The low-level `h()` vnode factory remains exported for non-JSX integrations,
but TSX is the documented authoring model for applications and Fray
components.

## Components and lifecycle

A class component has explicit phases:

1. The constructor stores props and creates local objects, without subscribing
   or rendering.
2. `initialize()` runs once after Fray assigns the runtime. Create subscriptions
   or resolve declared services here.
3. `render()` returns TSX, a primitive, an emitter child, a component, or an
   array of children.
4. `afterMount()` runs after the first DOM commit; `afterUpdate()` runs after
   later commits.
5. `onDestroy()` releases resources owned by the component.

`watch()` schedules a component update when an observable changes.
`read(emitter)` returns its value and tracks it only for the current render.
`snapshot(emitter)` tracks and returns `{value, fetchState, error}`.
`onCleanup()` registers listeners or other cleanup functions that Fray invokes
on destruction.

```tsx
class Counter extends Component {
    readonly count = new Emitter(0)
    readonly label = this.count.map((value) => `Count: ${value}`)

    render() {
        return <Button
            label={this.label}
            onClick={() => this.count.set(this.count.get() + 1)}
        />
    }

    onDestroy() {
        this.label.dispose()
        this.count.dispose()
    }

    static dependencies = [Button]
}
```

Fray's synchronous keyed reconciler preserves compatible DOM and component
identity, focus, cursor and native input state, and event-listener cardinality.
Use stable `key` values for reordered siblings. Never reuse one component
instance under two owners.

### Custom component hosts

Wrapped components declare a host stem and render `this.Host`. The runtime maps
the stem to one fixed, standards-valid name by removing internal hyphens and
prefixing `fray-`:

```tsx
interface BadgeProps extends ComponentProps {
    tone?: 'neutral' | 'positive'
}

class Badge extends Component<BadgeProps> {
    render() {
        const Host = this.Host
        return <Host data-tone={this.props.tone ?? 'neutral'}>
            {this.props.children}
        </Host>
    }

    static override hostName = 'badge'
    static override css = css`
        & { display: inline-flex; }
        &[data-tone="positive"] { color: var(--palette-green); }
    `
}
```

The `&` selector resolves against the concrete host during style collection.
Native-root components render their native element directly. Fray-created DOM
has `data-fray` for diagnostics, but component styling uses the owning host,
native/ARIA state, fixed part elements, and meaningful traits rather than data
attributes as routine CSS hooks.

## Reactive templates

Fray exposes four distinct reactive forms. Choose the form that matches the
ownership boundary.

### Tracked reads

Use `read()` when control flow or an ordinary value depends on an emitter. Use
`snapshot()` when loading and error state matter:

```tsx
interface Item {
    id: string
    label: string
}

interface ResultsProps extends ComponentProps {
    results: ReadableEmitter<readonly Item[] | undefined>
}

class Results extends Component<ResultsProps> {
    render() {
        const {value, fetchState, error} = this.snapshot(this.props.results)
        if (fetchState === FetchState.Error) {
            return <p role="alert">{String(error)}</p>
        }
        return <ul aria-busy={fetchState === FetchState.Loading}>
            {(value ?? []).map((item) => <li key={item.id}>{item.label}</li>)}
        </ul>
    }
}
```

The surrounding component rerenders when a tracked source changes, and Fray
reconciles the tracked source set after every render.

### Fine-grained emitter children

A readable emitter in child position updates only its owned DOM range:

```tsx
<output>Current name: {name}</output>
```

An emitter passed as a normal component prop remains the same object. Fray does
not inspect arbitrary prop values or discover dependencies implicitly.

### One-way live properties

`live()` updates a DOM property or a component-declared live prop without
rerendering its parent:

```tsx
<Button label="Submit" disabled={live(submitting)} />
<output title={live(summary)}>{summary}</output>
```

Built-in components allowlist their live props. TypeScript and runtime checks
reject a binding on an undeclared prop. Value/data emitters such as
`valueEmitter`, `items`, and `nodes` are raw contracts and do not use `live()`.

### Two-way native bindings

`bind:value` accepts a writable string emitter and `bind:checked` accepts a
writable boolean emitter:

```tsx
<input aria-label="Search" bind:value={search} />
<input type="checkbox" bind:checked={showArchived} />
```

Fray keeps the property synchronized in both directions and owns the renderer
subscription. Higher-level value controls use the same explicit
`valueEmitter` convention.

## Value-control convention

Stateful controls expose a public writable `valueEmitter`. Callers can supply
one with `valueEmitter`, supply an initial uncontrolled value with
`defaultValue`, or let the control create its documented fallback. `value` is
retained as an initial-value compatibility alias; it is not a continuously
controlled prop. `onChange` reports user-driven changes.

Availability and validation can be ordinary values or supported `live()`
bindings. Labels should be visible whenever possible; `ariaLabel` is the
fallback for controls without visible label content.

## Component reference

Every public component is listed below. Generic `className`, `class`, `island`,
`key`, and `children` come from `ComponentProps` and are omitted from the key
props column.

The generic controls `Dropdown`, `RadioGroup`, and `Toggle` preserve their
option value type through `valueEmitter` and `onChange`; the `<T>` notation in
the tables below denotes that TypeScript type parameter.

### Actions, inputs, and choices

| Component | Purpose | Key props and state |
| --- | --- | --- |
| `Button` | Native button with optional pressed and busy state | `label`, `type`, `disabled`, `pressed`, `busy`, `busyLabel`, `onClick`; live: `disabled`, `pressed`, `busy` |
| `Toolbar` | Named action group | `label`, `orientation` |
| `Label` | Native label for rich or live text | `text`, `htmlFor`; live: `text` |
| `Textbox` | Labelled native text input with validation | `label`, `valueEmitter`, `defaultValue`, `type`, `name`, `placeholder`, `disabled`, `required`, `readOnly`, `error`, native text constraints, `inputRef`, `onInput`, `onChange`; live: availability and `error` |
| `Dropdown<T>` | Labelled native select | `options`, `label`, `valueEmitter`, `defaultValue`, `placeholder`, `disabled`, `required`, `error`, `onChange`; `options` may be static or a readable emitter |
| `RadioButton` | Standalone native radio and label | `label`, `name`, `value`, `checked`, `disabled`, `required`, `error`, `onChange`; live: state, availability, `error` |
| `RadioGroup<T>` | Named native-radio fieldset owning one value | `options` as `[value, label]` tuples, `label`, `valueEmitter`, `defaultValue`, `disabled`, `required`, `error`, `onChange`; options are ordinary render data |
| `Toggle<T>` | ARIA radio group rendered as toggle buttons | `options` as `[value, label]` tuples, `label`, `valueEmitter`, `defaultValue`, `disabled`, `required`, `error`, `onChange` |
| `Checkbox<T>` | Configurable keyboard-operable semantic state cycle | `symbols` as `[content, value]` tuples, `label`, `valueEmitter`, `defaultValue`, `disabled`, `required`, `error`, `onChange` |
| `TriCheckbox` | Neutral/prefer/deny `FilterMode` cycle | Same public props as `Checkbox`, except fixed symbols |
| `QuadCheckbox` | Neutral/prefer/require/deny `FilterMode` cycle | Same public props as `Checkbox`, except fixed symbols |

`FilterMode` exports `neutral`, `prefer`, `require`, and `deny` semantic values.
Arrow keys move backward or forward through a multi-state checkbox; Space uses
the native forward cycle.

```tsx
const view = new Emitter<'list' | 'grid'>('list')

<RadioGroup
    label="View"
    options={[
        ['list', 'List'],
        ['grid', 'Grid'],
    ]}
    valueEmitter={view}
/>
```

### Layout and navigation

| Component | Purpose | Key props and state |
| --- | --- | --- |
| `FrayApp` | Fixed `fray-app` application shell and theme-text boundary | `sizing`: `embedded`/viewport axes; `layout`: `horizontal`/`vertical`; `landmark`: `main`/`none`; content or overridden `renderContent()` |
| `Header` | Styled native heading surface | `level` (1–6), `headingId`, content |
| `GroupPanel` | Labelled bordered group with a vertical header | required `header`, content |
| `Panel` | Optional labelled region with toolbar and content flow | `header`, `toolbar`, `orientation`, `disabled`; live: `disabled` |
| `Sidebar` | Labelled `aside` with fixed header/toolbar and scrolling content | `header`, `toolbar`, `ariaLabel`, content |
| `SplitView` | Two-pane layout | `primary`, `secondary`, `direction`, `primarySize`, region labels |
| `NavigationBar` | Labelled native navigation list over router-aware anchors | required `label`, `items`; per-item route target, `exact`, disabled/link options |
| `Tab` | Declarative tab definition consumed by `TabPanel` | `id`, `label`, `disabled`, optional literal `route`, content |
| `TabLine` | Standalone keyboard-operable tab list | `tabs`, `valueEmitter`/`activeTabEmitter`, initial value, `label`, `onChange` |
| `TabPanel` | Tab list plus owned tabpanel sections | declarative `Tab` children or `tabs` definitions; value props, `mountPolicy`, `label`, `onChange` |

`TabLine` supports Home, End, and orientation-appropriate arrow navigation and
skips disabled tabs. `TabPanel` can register routed tabs when it is mounted in
a router-backed route scope. Its `mountPolicy` controls content lifetime while
keeping every semantic tabpanel shell stable:

- `eager` (the compatibility default) mounts and retains every tab's content;
- `lazy` mounts the selected content and retains each visited tab; and
- `active-only` mounts only the selected content and destroys it on leave.

During initial restoration of a direct nested URL, a routed panel preselects
the matching pending literal route before its first content render. An
`active-only` panel therefore does not briefly mount its default branch while
the router progressively discovers the requested child scopes.

Use `active-only` with recreatable TSX/VNodes. A prebuilt component instance
cannot be mounted again after destruction. Put state that must survive a view
instance in application-owned Glue emitters/services, or choose a retaining
policy. Fray does not call data-loading methods implicitly; a mounted view may
activate its application service/query during `initialize()`.

```tsx
<TabPanel id="profile" label="Profile sections" mountPolicy="active-only">
    <Tab id="summary" label="Summary">Summary content</Tab>
    <Tab id="details" label="Details">Details content</Tab>
</TabPanel>
```

`SplitView` is a fixed two-pane composition primitive. It does not impose
application resizing policy or persist pane sizes.

`NavigationBar` uses a native `nav`, list, and anchors. It preserves
`RouteLink` href generation, current-route state, modified clicks, targets,
and downloads. It has ordinary link tab order and no tab or ARIA-menu keyboard
model. A disabled item is rendered as a visible non-link with
`aria-disabled="true"`. The bar navigates only; it never locates or owns the
content affected by a route.

Its `--navigation-bar-*` and `--navigation-link-*` theme variables are
independent from `--button-*`. The base theme deliberately presents navigation
as text links with a subtle hover surface and current-route underline. Themes
may opt into boxed or button-like navigation without changing the component's
native link semantics.

### Data and record views

| Component | Purpose | Key props and state |
| --- | --- | --- |
| `DescriptionList` | Native `dl` record summary | `label`, `DescriptionItem` children |
| `DescriptionItem` | Native `dt`/`dd` pair | required `term`, `value` or content |
| `InfoPanel` | Bordered info panel with optional title and key-value fields | `title`, `label`, `InfoField` children |
| `InfoField` | Native `dt`/`dd` key-value pair | required `label`, `value` or content |
| `Placeholder` | Decorative loading placeholder | numeric `width`, clamped to 10–100 percent |
| `ListView<T>` | Keyed single- or multi-select ARIA listbox | `items`, `itemKey`, `label`, `renderItem`, `multiSelect`, selected emitter |
| `TreeItem<T>` | Declarative tree-node marker | `id`, `label`, `textValue`, `value`, nested `TreeItem` children |
| `TreeView<T>` | Keyed single-select ARIA tree | `nodes` or declarative items, `label`, selected/expanded emitters, `renderItem`, per-label class/style callbacks, `onSelect` |
| `FilterPanel` | Semantic filter-control fieldset | `options`, `filters`, `filterModes`, `defaultSemanticState`, `label`, `onChange` |
| `TableHeaderCell` | Sort/filter header-cell control | column key/label plus sort/filter state callbacks |
| `TableHeader` | Header row over public column definitions | `columns`, sort/filter emitters and callbacks |
| `DataTable<T>` | Accessible local, caller-query, or REST-backed table | `columns`, one data input, `rowKey`, caption/messages, semantic filter options, single/multi selection |

`ListView`, `TreeView`, and `DataTable` reconcile selection by stable keys when
fresh item objects arrive. Supply an explicit key for application data; index
fallbacks are only safe for immutable ordering. `ListView.items` and
`TreeView.nodes` accept static arrays or readable emitters and present loading,
empty, and error states from the emitter snapshot.

Advanced compositions may use `BaseSelectionHandler`,
`SingleSelectionHandler`, `MultiSelectionHandler`, and
`createSelectionHandler` directly. Ordinary applications should prefer the
selection behavior already owned by `ListView` and `DataTable`.

`TreeView` owns keyboard navigation, expansion, typeahead, and selection. Use
`itemLabelClassName` and `itemLabelStyle` when only the label beside the
expander needs a reusable presentation trait such as `colored`.

#### DataTable inputs and ownership

`DataTable` requires exactly one data mode:

- `data`: a static array or readable emitter; the table owns the local derived
  data source it creates.
- `dataSource`: a caller-owned `TableDataSource`; the caller disposes it.
- `rest`: convenience options for a table-owned REST-backed source.

For reusable sources, use `createLocalTableDataSource`,
`createQueryTableDataSource`, `createHandlerTableDataSource`, or
`createRestTableDataSource`. Sources expose `query`, `sortEmitter`,
`filtersEmitter`, optional `retry`, and `dispose()`.

`TableColumn` definitions own display and local comparison/filter functions.
The pure `applyLocalTableState`, `serializeTableQuery`, and related table-query
helpers keep local behavior and remote encoding explicit. Pagination,
virtualization, and server-specific wire policy remain application concerns.

### Dialog, status, and presentation selection

| Component | Purpose | Key props and state |
| --- | --- | --- |
| `Dialog` | Controlled native modal with focus containment and restoration | `title`, `description`, `actions`, `valueEmitter`/`defaultValue`, `closeLabel`, `showCloseButton`, `initialFocusRef`, `onClose` |
| `ProgressBar` | Labelled native progress with visual track | required `label`, `value` or `valueEmitter`, `max`, `valueText`; `null` is indeterminate |
| `ThemePicker` | Select and replace a Fray theme link | value props, `options`, `label`/`ariaLabel`, `disabled`, `targetDocument`, `onChange` |
| `ColorPicker` | Select and replace a Fray color link | same contract as `ThemePicker` |

The pickers use `frayThemeOptions` and `frayColorOptions` by default. An
application still owns whether runtime selection is offered, which options are
available, and whether the selected identifier is persisted.

## Semantic filter state

Fray's filter helpers keep presentation symbols separate from matching policy.
A `FilterState` is plain, versionable data keyed by dimension and option. A
`FilterDimensionDefinition` supplies the application-owned matchers.

Dimensions combine with AND. Within a dimension, deny wins, every required
option must match, and at least one preferred option must match when any are
active. Unknown persisted keys survive serialization without constraining
current matching.

Use `matchesFilterState` or `filterByState` for pure evaluation;
`deriveFilterPredicate` and `deriveFilteredItems` for reactive results; and
`serializeFilterState`/`parseFilterState` for deterministic versioned data.

## Application services

Service implementations remain ordinary application TypeScript. Fray provides
typed keys and a fixed application scope, not dependency discovery:

```tsx
class ProjectService {
    readonly label = 'Projects'
}

const projectService = defineService<ProjectService>('projects')
const services = createServiceScope([
    provideService(projectService, () => new ProjectService()),
])

class ProjectTitle extends Component {
    static requiredServices = [projectService]
    private service!: ProjectService

    initialize() {
        this.service = this.requireService(projectService)
    }

    render() {
        return <output>{this.service.label}</output>
    }
}

const runtime = createFrayRuntime({services})
```

Providers are immutable, lazy, and scope-shared. Factories can explicitly
resolve declared dependencies through their `ServiceResolver`; cycles and
missing providers fail clearly. `ServiceScope.dispose()` disposes initialized
services in reverse creation order. Components own the queries/results they
open; they do not dispose scope-shared services.

`FrayRuntime` carries one `ServiceScope`, optional router, and isolated
`StyleRegistry`. `createFrayRuntime()` is the normal construction entry point;
`defaultFrayRuntime` supports direct compatibility mounting.

## Browser routing

Fray routing binds explicit route vocabulary to ordinary writable emitters.
The application owns descriptors, codecs, data-dependent resolvers, and the
navigation adapter.

```tsx
const portfolioRoute = defineRoute('portfolio')
const registerRoute = defineRoute('register')
const projectRoute = defineRouteParameter('project', stringRouteCodec)
const selectedProject = new Emitter<string | null>(null)
const activeApplication = new Emitter<Key | null>('portfolio')

const router = createBrowserRouter({adapter: createHashNavigation()})
const runtime = createFrayRuntime({router})

<NavigationBar
    label="Application sections"
    items={[
        {id: 'portfolio', label: 'Portfolio', to: routeTarget(portfolioRoute)},
        {id: 'register', label: 'Register', to: routeTarget(registerRoute)},
    ]}
/>
<RouteOutlet
    valueEmitter={activeApplication}
    mountPolicy="active-only"
    views={[{
        id: 'portfolio',
        route: portfolioRoute,
        content:
        <RouteValue
            route={projectRoute}
            valueEmitter={selectedProject}
            scopeChildren={true}
        >
            <ProjectScreen selectedProject={selectedProject} />
        </RouteValue>,
    }, {
        id: 'register',
        route: registerRoute,
        content: <RegisterScreen />,
    }]}
/>
```

Core routing exports:

- `defineRoute`, `defineRouteParameter`, `routeParameter`, `routeTarget`, and
  `withRouteQuery` create immutable descriptors and targets.
- `BrowserRouter`/`createBrowserRouter` progressively restore mounted scopes,
  normalize locations, and expose structured issue state.
- `createHistoryNavigation`, `createHashNavigation`, and
  `MemoryNavigationAdapter` decide where locations live.
- `RouteScope` establishes lineage; `RouteValue` binds dynamic path values;
  `RouteQuery` binds one named query value; `RouteLink` renders a real anchor.
- `NavigationBar` groups native route links but does not own destination DOM.
- `RouteOutlet` registers one sibling literal-route set against an
  application-owned emitter and gives selected content its resolved scope.
- `waitForRouteValue` lets a resolver await a readable application
  prerequisite with cancellation.

Resolvers may return `RouteRedirect` through `redirectTo()`, or throw
`RouteUnavailableError` when the requested value cannot be represented in the
mounted application state.

Explicit navigation pushes by default. Restoration never pushes; redirects,
fallback, canonicalization, and passive bound-state changes replace. A
superseding transition aborts pending resolvers. Invalid locations settle at
the deepest valid parent and leave accessible issue presentation to the
application.

The history adapter needs server fallback for direct deep requests. The hash
adapter reserves the fragment. The memory adapter is intended for deterministic
tests. The caller owns and disposes the router.

`RouteOutlet.mountPolicy` uses the same `ContentMountPolicy` values as
`TabPanel`: `eager`, `lazy`, and `active-only`. Immediate routes are registered
whether or not their content is mounted. During direct restoration, the
matching pending branch is selected before the first content render, so an
active-only default branch cannot initialize and activate unrequested work.
Other page regions may independently read `activeApplication`; only the outlet
registers that sibling route set. Application-global navigation should usually
use explicit `routeTarget(...)` values, while relative descriptors are suited
to a navigation bar inside the route scope that registered them.

## Styling contract

Load presentation in this order:

1. `@sylwellsoftware/fray/themes/base.css`
2. Collected CSS or `@sylwellsoftware/fray/styles/structural.css`
3. One `@sylwellsoftware/fray/colors/<name>/colors.css`
4. One `@sylwellsoftware/fray/themes/<name>/theme.css`

`base.css` declares variables and derives palette roles but contains no
component selectors. Color files provide anchors and endpoints. Component
`static css` owns selectors, layout, pseudo-elements, native states, and
interaction mechanics.

Theme files provide intentional overrides. Custom properties are the primary
instrument and belong on `:root` inside `@layer theme`, with `color-scheme` as
the only ordinary property in that block. A theme may also write ordinary CSS
rules when no variable expresses the intended difference, but those rules must
be placed after the `@layer theme` block: component CSS is injected as an
unlayered `<style>` element prepended to `<head>`, so unlayered theme rules win
by document order while layered ones would always lose.

`frayThemeVariableCatalog` describes the supported palette and semantic
variable hierarchy. `findFrayStylesheetOption`, `replaceFrayStylesheet`,
`setFrayAppearance`, and `getFrayAppearance` support application-controlled
runtime selection.

### Root sizing and typography

`FrayApp` is block-level and always applies `--application-background`,
`--ui-color`, `--font-family`, `--font-size`, and `--line-height`, so all of
its native and Fray descendants inherit theme text treatment even when it is
embedded. Its `sizing` prop maps to `fray-fill-horizontal`,
`fray-fill-vertical`, or both to claim `100vw`, `100vh`, or the full viewport.
Its optional `layout` prop maps to the direction trait on that same host. This
is important for viewport shells: Flexbox only distributes an already bounded
size, so an auto-height intermediate wrapper does not inherit the root's
height constraint automatically.

The traits remain available for applications that use a plain `Component`
root. They now apply the same canvas, text color, and typography values. A
plain root without either trait remains content-sized and inherits host-page
text treatment.

### Reusable traits

The allocation traits are structural and independently composable:

- `fray-layout-horizontal` and `fray-layout-vertical` arrange direct children
  and stretch them across the other axis;
- `fray-size-natural` keeps a direct child's application/content allocation;
- `fray-size-flexible` shares remaining main-axis space and supplies zero
  logical minimums so nested content can shrink;
- `fray-scroll` makes a bounded node the explicit overflow owner.

`Header`, `NavigationBar`, `Panel`, `Sidebar`, and `Toolbar` accept
`allocation="natural" | "flexible"` and map it to their outer host. `Panel`
continues to use `orientation` for its application-owned content node;
components do not accept a generic arrangement prop when it would rearrange
their generated chrome. Application-owned elements may use the classes
directly.

Flexible siblings have equal growth shares only when their box decoration is
equivalent. Application CSS may override ratios, sizes, and gaps. Flexible
allocation does not imply scrolling, and an island does not select the scroll
owner; filled-root island overflow remains a compatibility fallback. Rules use
no `!important`, so later application CSS can refine them. Fray does not yet
provide breakpoint variants.

`island` marks one deliberate themeable surface boundary. Pass
`island={true}` to a wrapped component or use the class on application-owned
native markup. Fray rejects nested component islands; application markup must
preserve the same one-layer invariant.

`colored` consumes an explicit `--c1`, `--c2`, `--c3` triplet for the shared
gradient and `--colored-shadow` treatment. It does not choose semantic colors
for the application.

## Accessibility and browser support

Fray components use native controls and landmarks where possible, expose
accessible names, preserve focus during keyed updates, and render loading,
empty, and error messages outside collection semantics. The browser matrix
covers pinned Chromium, Firefox, and WebKit builds, including keyboard flows,
200% text, forced colors, and automated accessibility checks.

Applications remain responsible for meaningful labels, heading hierarchy,
domain validation messages, color contrast introduced by application CSS,
focus order across composed screens, and manual assistive-technology testing.

Fray does not support SSR, hydration, Shadow DOM, registered Web Components,
legacy browsers, or a concurrent rendering scheduler.

## Further reference

- [Public API surface](../../docs/API_SURFACE.md)
- [Architecture](../../docs/architecture.md)
- [Application layout guide](docs/application-layout-guide.md)
- [Theme contract](themes/README.md)
- [Color palette contract](colors/README.md)
- [Release history](CHANGELOG.md)
