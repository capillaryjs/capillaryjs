# Capillary UI

Capillary UI is a browser-only TypeScript UI runtime that gives Capillary application models native, interactive browser structure. It provides TSX rendering, explicit component lifecycle, accessible controls and data views, scoped services and routing, runtime localization, and dependency-collected structural CSS. It prefers native HTML when the browser already provides the right semantic concept and uses readable light-DOM component boundaries where an application needs something more specific.

Capillary UI 1.x is ESM-only and targets current evergreen browsers. Install it with
its Capillary peer:

```bash
pnpm add @capillaryjs/capillary @capillaryjs/capillary-ui
```

## Design and ownership

Capillary UI presents application values without moving them into a second UI-specific
state system. Controls write ordinary Capillary emitters, components read the
downstream values they need, and applications retain ownership of domain
policy and asynchronous work.

```text
application
  domain policy, composition, services, endpoints, routes, theme selection
                              │
                              ▼
Capillary UI
  TSX, DOM, events, lifecycle, accessibility, structural presentation
                              │ get / subscribe / set
                              ▼
Capillary
  mutable values, derived values, live queries, commands, diagnostics
```

The boundaries are deliberate:

| Concern | Owner |
| --- | --- |
| Domain state, validation policy, endpoint configuration, service providers, routes, page composition | Application |
| Translation catalogs, locale policy, application text, document `lang`/`dir` | Application |
| DOM structure, native events, accessible semantics, component lifetime, visual async states | Capillary UI |
| Capillary UI-authored message defaults and Capillary UI-owned `Intl` display names | Capillary UI, using optional runtime localization |
| Mutable and computed values, query execution and status, command lifecycle, optional causality | Capillary |
| Retrieval, wire serialization, persistence | Application-supplied handlers and adapters |
| Structural selectors and component layout | Capillary UI component CSS |
| Theme treatment, palette, application layout | Separately loaded CSS and application CSS |

Capillary UI prefers native HTML when it expresses the contract. Custom `cap-*`
hosts are readable light-DOM ownership and styling boundaries; they are not
registered custom elements and do not use Shadow DOM.

## Set up TSX

Use Capillary UI's automatic JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@capillaryjs/capillary-ui"
  }
}
```

Load the variable base, one color palette, and one theme. `CapillaryUiApp` is the
normal application shell: it renders a fixed `cap-app` host, applies the
theme canvas and typography, and has an accessible primary-content landmark by
default. `mountCapillaryUiApp()` collects reachable structural CSS before mounting:

```tsx
import {Emitter} from '@capillaryjs/capillary'
import {
    Button,
    CapillaryUiApp,
    Panel,
    PanelToolbar,
    Textbox,
    Toolbar,
    createCapillaryUiRuntime,
    mountCapillaryUiApp,
} from '@capillaryjs/capillary-ui'

import '@capillaryjs/capillary-ui/themes/base.css'
import '@capillaryjs/capillary-ui/colors/iceblue/colors.css'
import '@capillaryjs/capillary-ui/themes/minimal/theme.css'

class ProfileApp extends CapillaryUiApp {
    readonly name = new Emitter('Ada')

    protected override renderContent() {
        return <Panel header="Profile">
            <PanelToolbar><Toolbar label="Profile actions">
                <Button label="Save" onClick={() => this.save()} />
            </Toolbar></PanelToolbar>
            <Textbox label="Name" valueEmitter={this.name} />
        </Panel>
    }

    onDestroy() {
        this.name.dispose()
    }

    private save() {
        console.log(this.name.get())
    }

    static dependencies = [Button, Panel, PanelToolbar, Textbox, Toolbar]
}

const runtime = createCapillaryUiRuntime()
mountCapillaryUiApp(runtime, ProfileApp, document.querySelector('#app')!, {
    sizing: 'viewport',
    layout: 'vertical',
})
```

`CapillaryUiApp` may also be instantiated directly with `children`. Derived apps
override `renderContent()`. Its `sizing` is `embedded`, `viewport-width`,
`viewport-height`, or `viewport`; `layout` is `horizontal` or `vertical` and
arranges application-owned children directly on that bounded host; `landmark`
is `main` (the default) or `none` for an embedded app. `static dependencies` is transitive and idempotent. It
declares the Capillary UI and application components whose structural CSS the root can
render. `CapillaryUiApp` itself registers and injects those styles whenever it
attaches; `mountCapillaryUiApp()` is the concise normal entry point. Applications that
prefer a complete static asset may import
`@capillaryjs/capillary-ui/styles/structural.css` instead of collecting styles.

`CapillaryUiApp` deliberately does not select a palette, theme, appearance mode,
services, router, routes, or domain state. Those remain application policy.

The low-level `h()` vnode factory remains exported for non-JSX integrations,
but TSX is the documented authoring model for applications and Capillary UI
components.

## Components and lifecycle

A class component has explicit phases:

1. The constructor stores props and creates local objects, without subscribing
   or rendering.
2. `initialize()` runs once after Capillary UI assigns the runtime. Create subscriptions
   or resolve declared services here.
3. `render()` returns TSX, a primitive, an emitter child, a component, or an
   array of children.
4. `afterMount()` runs after the first DOM commit; `afterUpdate()` runs after
   later commits.
5. `onDestroy()` releases resources owned by the component.

`watch()` schedules a component update when an observable changes.
`read(emitter)` returns its value and tracks it only for the current render.
`snapshot(emitter)` tracks and returns `{value, fetchState, error}`.
`onCleanup()` registers listeners or other cleanup functions that Capillary UI invokes
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

Capillary UI's synchronous keyed reconciler preserves compatible DOM and component
identity, focus, cursor and native input state, and event-listener cardinality.
Use stable `key` values for reordered siblings. Never reuse one component
instance under two owners.

### Custom component hosts

Wrapped components declare a host stem and render `this.Host`. The runtime maps
the stem to one fixed, standards-valid name by removing internal hyphens and
prefixing `cap-`:

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
Native-root components render their native element directly. Capillary UI-created DOM
has `data-cap` for diagnostics, but component styling uses the owning host,
native/ARIA state, fixed part elements, and meaningful traits rather than data
attributes as routine CSS hooks.

## Reactive templates

Capillary UI exposes four distinct reactive forms. Choose the form that matches the
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

The surrounding component rerenders when a tracked source changes, and Capillary UI
reconciles the tracked source set after every render.

### Fine-grained emitter children

A readable emitter in child position updates only its owned DOM range:

```tsx
<output>Current name: {name}</output>
```

An emitter passed as a normal component prop remains the same object. Capillary UI does
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

Capillary UI keeps the property synchronized in both directions and owns the renderer
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
| `Button` | Native button with optional pressed and busy state | `label`, `type`, `disabled`, `pressed`, `busy`, `busyLabel`, `error`, `onClick`; live: `disabled`, `pressed`, `busy`, `error` |
| `Toolbar` | Named action group | `label`, `orientation` |
| `Label` | Native label for rich or live text | `text`, `htmlFor`; live: `text` |
| `Textbox` | Labelled native text input with validation | `label`, `valueEmitter`, `defaultValue`, `type`, `name`, `placeholder`, `disabled`, `required`, `readOnly`, `busy`, `error`, native text constraints, `inputRef`, `onInput`, `onChange`; live: availability, `busy`, and `error` |
| `Dropdown<T>` | Labelled native select | `options`, `label`, `valueEmitter`, `defaultValue`, `placeholder`, `disabled`, `required`, `busy`, `error`, `onChange`; `options` may be static or a readable emitter whose fetch state supplies loading/error feedback |
| `RadioButton` | Standalone native radio and label | `label`, `name`, `value`, `checked`, `disabled`, `required`, `busy`, `error`, `onChange`; live: state, availability, `busy`, `error` |
| `RadioGroup<T>` | Named native-radio fieldset owning one value | `options` as `[value, label]` tuples, `label`, `valueEmitter`, `defaultValue`, `disabled`, `required`, `busy`, `error`, `onChange`; options are ordinary render data |
| `Toggle<T>` | ARIA radio group rendered as toggle buttons | `options` as `[value, label]` tuples, `label`, `valueEmitter`, `defaultValue`, `disabled`, `required`, `busy`, `error`, `onChange` |
| `Checkbox<T>` | Configurable keyboard-operable semantic state cycle | `symbols` as `[content, value]` tuples, `label`/`ariaLabel`, `valueEmitter`, `defaultValue`, `disabled`, `required`, `busy`, `error`, `onChange` |
| `TriCheckbox` | Neutral/prefer/deny `FilterMode` cycle | Same public props as `Checkbox`, except fixed symbols |
| `QuadCheckbox` | Neutral/prefer/require/deny `FilterMode` cycle | Same public props as `Checkbox`, except fixed symbols |
| `DatePicker` (experimental) | Native `<input type="date">` | `CivilDate` value props, `label`/`ariaLabel`, `name`, `autoComplete`, `disabled`, `required`, `readOnly`, `busy`, `error`, `min`/`max`/`step`, `inputRef`, input/change callbacks |
| `TimePicker` (experimental) | Native `<input type="time">` | `TimeString` value props, `label`/`ariaLabel`, `name`, `autoComplete`, `disabled`, `required`, `readOnly`, `busy`, `error`, `min`/`max`/`step`, `inputRef`, input/change callbacks |
| `DateTimePicker` (experimental) | Native `<input type="datetime-local">` | `LocalDateTime` value props, `label`/`ariaLabel`, `name`, `autoComplete`, `disabled`, `required`, `readOnly`, `busy`, `error`, `min`/`max`/`step`, `inputRef`, input/change callbacks |

`FilterMode` exports `neutral`, `prefer`, `require`, and `deny` semantic values.
Arrow keys move backward or forward through a multi-state checkbox; Space uses
the native forward cycle.

`busy` is presentational state: it sets native/ARIA busy semantics and paints
the theme's moving working texture without disabling an input or choice.
`Button` remains the exception: a busy action is unavailable until it settles.
When `error` is also present, error presentation wins over the animation.
Every error-bearing control describes its native surface with a focusable
`role="alert"` overlay. Its icon and initially hidden message are absolutely
positioned so errors do not change layout; the message opens when the icon is
hovered or the alert receives keyboard/tap focus. Applications still own
validation and the message text.

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
| `CapillaryUiApp` | Fixed `cap-app` application shell and theme-text boundary | `sizing`: `embedded`/viewport axes; `layout`: `horizontal`/`vertical`; `landmark`: `main`/`none`; content or overridden `renderContent()` |
| `Header` | Styled native heading surface | `level` (1–6), `headingId`, content |
| `GroupBox` | Labelled group; defaults to a bordered vertical-header group and may be a section or column | required `header`, content; optional `variant`: `section` or `column` |
| `OptionGroup` | Labelled native fieldset for related controls | `label`/`ariaLabel`, `OptionGroupHeaderEnd` and ordinary content children, `disabled`, `required`, `busy`, `error`; state props are live |
| `OptionsBox` | GroupBox specialization arranging option groups | required `header`, `OptionGroup` content |
| `Layout` | Presentation-only arrangement of arbitrary children | exactly one of `horizontal`/`vertical`; `allocation`, `scroll`, optional accessible-region configuration |
| `Panel` | Optional labelled, themed region composed over a Layout body | `header`, `horizontal`/`vertical`, `allocation`, `scroll`, `disabled`; `PanelToolbar` and ordinary content children; live: `disabled` |
| `Sidebar` | Labelled complementary region with fixed header/toolbar and scrolling content | `header`, `ariaLabel`; `SidebarToolbar` and ordinary content children |
| `SplitView` | Resizable two-pane layout | required `SplitPrimary` and `SplitSecondary` Layout panes; `horizontal`/`vertical`, `allocation`, initial/minimum sizes, separator label, `onResize` |
| `NavigationBar` | Labelled native navigation list over router-aware or external anchors | required `label`, `items`; route items accept `exact`; external items use `{kind: 'external', href}` plus disabled/link options |
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
instance in application-owned Capillary emitters/services, or choose a retaining
policy. Capillary UI does not call data-loading methods implicitly; a mounted view may
activate its application service/query during `initialize()`.

```tsx
<TabPanel id="profile" label="Profile sections" mountPolicy="active-only">
    <Tab id="summary" label="Summary">Summary content</Tab>
    <Tab id="details" label="Details">Details content</Tab>
</TabPanel>
```

`SplitView` is a resizable two-pane composition primitive. Its required named
Layout panes keep their roles and independent arrangement visible:

```tsx
<SplitView horizontal allocation="flexible" primarySize="18rem"
    separatorLabel="Resize project navigation">
    <SplitPrimary vertical scroll label="Projects">
        <ProjectNavigation />
    </SplitPrimary>
    <SplitSecondary vertical scroll label="Details">
        <ProjectDetails />
    </SplitSecondary>
</SplitView>
```

Pointer dragging and orientation-appropriate arrow keys resize the primary
pane. Home and End move to the configured minimum and maximum; Shift multiplies
the keyboard step. SplitView reports pixel sizes through `onResize`, while the
application owns persistence and responsive policy. Set `resizable={false}`
only when a fixed divider is deliberate.

`NavigationBar` uses a native `nav`, list, and anchors. It preserves
`RouteLink` href generation, current-route state, modified clicks, targets,
and downloads. An item whose `to` is `{kind: 'external', href}` renders a
plain anchor for destinations outside the current router or origin: the
router never intercepts it, no `aria-current` applies, and no router is
required in the runtime. It has ordinary link tab order and no tab or
ARIA-menu keyboard
model. A disabled item is rendered as a visible non-link with
`aria-disabled="true"`. The bar navigates only; it never locates or owns the
content affected by a route. `href` is application-controlled and passed to
the native anchor: destination trust, allowed URL schemes, availability, and
cross-application policy remain application responsibilities.

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
| `ListView<T>` | Keyed single- or multi-select ARIA listbox | `items`, `itemKey`, `label`, `placeholderCount`, `renderItem`, `multiSelect`, selected emitter |
| `TreeItem<T>` | Declarative tree-node marker | `id`, `label`, `textValue`, `value`, nested `TreeItem` children |
| `TreeView<T>` | Keyed single-select ARIA tree | `nodes` or declarative items, `label`, `placeholderCount`, selected/expanded emitters, `renderItem`, per-label class/style callbacks, `onSelect` |
| `FilterPanel` | Semantic filter-control fieldset | `options`, `filters`, `filterModes`, `defaultSemanticState`, `label`, `onChange` |
| `TableHeaderCell` | Sort/filter header-cell control | column key/label plus sort/filter state callbacks |
| `TableHeader` | Header row over public column definitions | `columns`, sort/filter emitters and callbacks |
| `DataTable<T>` | Accessible local, caller-query, or REST-backed table | `columns`, one data input, `rowKey`, caption/messages, `placeholderCount`, semantic filter options, single/multi selection |

`ListView`, `TreeView`, and `DataTable` reconcile selection by stable keys when
fresh item objects arrive. Supply an explicit key for application data; index
fallbacks are only safe for immutable ordering. `ListView.items` and
`TreeView.nodes` accept static arrays or readable emitters and present loading,
empty, and error states from the emitter snapshot.

These collection views are their own scroll owners when a bounded layout
constrains them: they shrink before their parent must overflow, then scroll in
both axes as needed. Place them directly in a bounded `Layout`, `Panel`, or
SplitView pane; a parent may still opt into scrolling for its unrelated
content. `DataTable` keeps every header cell sticky at the top of its own
scrollport, including sortable and filterable headers.

`DataTable` and `ListView` default to a single selected row; pass
`multiSelect={true}` with an optional `selectedItemsEmitter` for multi-row
selection. In that mode Ctrl (or Cmd) toggles an individual row. Shift applies
the anchor row's selected or unselected state to every row in the inclusive
range while retaining selections outside that range.

On an initial snapshot, or a loading snapshot with no result, all three
collection views render deterministic, `aria-hidden` placeholder rows;
`placeholderCount` selects their count. A loading snapshot with retained rows
keeps those rows in place and marks the collection busy, avoiding flicker during
sort and filter refinements. Application renderers never receive dummy values,
and refreshes preserve valid keyed selections and expansions. Error snapshots
retain any available rows, add an error edge and overlay detail icon, and stop
the loading animation. A `DataTable` data source with `retry` also renders its
localized retry action.

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
`filtersEmitter`, optional `retry`, optional `sourceRows`, and `dispose()`.
Both direct data and query-shaped sources pass their rows through an
emitter-derived local table view, so their sort and filter state always
changes the rendered rows. `sourceRows` exposes the rows before local
sort/filter when the source can provide them — local and caller-query
sources do; remote sources leave it absent because filtering is
server-side.

`TableColumn` definitions own display and local comparison/filter functions.
When a column's visible `label` is rich content, supply its textual
`ariaLabel` for Capillary UI-generated sort and filter control names.
Set a column's `filterable` flag to derive its header filter options from
the field's distinct values across `sourceRows` (or the displayed rows when
the source cannot expose them), so the options stay stable while a filter
is applied. Explicit `filterOptions` take precedence over `filterable`.
The pure `applyLocalTableState`, `serializeTableQuery`, and related table-query
helpers keep local behavior and remote encoding explicit. Pagination,
virtualization, and server-specific wire policy remain application concerns.

### Dialog, status, and presentation selection

| Component | Purpose | Key props and state |
| --- | --- | --- |
| `Dialog` | Controlled native modal with focus containment and restoration | `title`, `description`, `DialogActions` and ordinary content children, `valueEmitter`/`defaultValue`, `closeLabel`, `showCloseButton`, `initialFocusRef`, `onClose` |
| `ProgressBar` | Labelled native progress with visual track | required `label`, `value` or `valueEmitter`, `max`, `valueText`; `null` is indeterminate |
| `ThemePicker` | Select and replace a Capillary UI theme link | value props, `options`, `label`/`ariaLabel`, `disabled`, `targetDocument`, `onChange` |
| `ColorPicker` | Select and replace a Capillary UI color link | same contract as `ThemePicker` |

The pickers use `capillaryUiThemeOptions` and `capillaryUiColorOptions` by default. An
application still owns whether runtime selection is offered, which options are
available, and whether the selected identifier is persisted.

## Semantic filter state

Capillary UI's filter helpers keep presentation symbols separate from matching policy.
A `FilterState` is plain, versionable data keyed by dimension and option. A
`FilterDimensionDefinition` supplies the application-owned matchers.

Dimensions combine with AND. Within a dimension, deny wins, every required
option must match, and at least one preferred option must match when any are
active. Unknown persisted keys survive serialization without constraining
current matching.

Use `matchesFilterState` or `filterByState` for pure evaluation;
`deriveFilterPredicate` and `deriveFilteredItems` for reactive results; and
`serializeFilterState`/`parseFilterState` for deterministic versioned data.

## Localization

Capillary UI can consume the result of your existing localization system for text and
formatting that Capillary UI itself owns. Configure it once when creating the runtime:

```tsx
import {createCapillaryUiRuntime} from '@capillaryjs/capillary-ui'
import type {CapillaryUiMessageOverrides} from '@capillaryjs/capillary-ui'

const messages: CapillaryUiMessageOverrides = {
    toolbarLabel: i18n.t('capillaryUi.toolbar.label'),
    dialogCloseLabel: i18n.t('capillaryUi.dialog.close'),
    dataTableEmpty: i18n.t('capillaryUi.table.empty'),
    tableSortColumnLabel: (label) => i18n.t('capillaryUi.table.sort', {label}),
    checkboxStateLabel: (label, state) =>
        i18n.t('capillaryUi.checkbox.state', {label, state}),
}

const runtime = createCapillaryUiRuntime({
    localization: {
        locale: i18n.locale,
        messages,
    },
})
```

`locale` is a non-empty BCP 47 tag. Capillary UI canonicalizes it and uses it for the
calendar's complete month/year heading, weekday names, and day numerals. The
calendar stays Gregorian and currently remains Sunday-first. Calendar display
values come from `Intl`; do not add them to the message object.

Every `CapillaryUiMessageOverrides` property is optional. Capillary UI copies supplied values
at runtime construction and fills omitted properties from English defaults.
Fixed messages are strings; messages that insert a label are typed functions,
so the organization's localization adapter controls word order and
interpolation. Explicit component props such as `Dialog.closeLabel`,
`Toolbar.label`, or `DataTable.emptyMessage` still take precedence.

The configuration is immutable and runtime-local. It is not a `ServiceScope`
service or a live locale binding. To select another language, create and mount
a runtime with the new localization configuration. Multiple runtimes may use
different locales on one page.

Capillary UI does not load catalogs, select or persist a locale, define fallbacks or
plural rules, translate caller-provided labels/errors/content, or set the
document's `lang` or `dir`. The application must set `lang` consistently with
the configured locale and owns RTL behavior. Localized parsing, locale-specific
week starts, time/number/percentage formatting, and collation are not part of
this contract.

`Checkbox.ariaLabel` and `TableColumn.ariaLabel` are textual alternatives for
rich visible labels used inside Capillary UI-generated accessibility messages. For
ordinary string/number labels they are unnecessary.

## Application services

Service implementations remain ordinary application TypeScript. Capillary UI provides
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

const runtime = createCapillaryUiRuntime({services})
```

Providers are immutable, lazy, and scope-shared. Factories can explicitly
resolve declared dependencies through their `ServiceResolver`; cycles and
missing providers fail clearly. `ServiceScope.dispose()` disposes initialized
services in reverse creation order. Components own the queries/results they
open; they do not dispose scope-shared services.

`CapillaryUiRuntime` carries one `ServiceScope`, optional router, optional static
localization, and isolated `StyleRegistry`. `createCapillaryUiRuntime()` is the normal
construction entry point; `defaultCapillaryUiRuntime` supports direct compatibility
mounting with English messages and the browser's default locale.

## Browser routing

Capillary UI routing binds explicit route vocabulary to ordinary writable emitters.
The application owns descriptors, codecs, data-dependent resolvers, and the
navigation adapter.

```tsx
const portfolioRoute = defineRoute('portfolio')
const registerRoute = defineRoute('register')
const projectRoute = defineRouteParameter('project', stringRouteCodec)
const selectedProject = new Emitter<string | null>(null)
const activeApplication = new Emitter<Key | null>('portfolio')

const router = createBrowserRouter({adapter: createHashNavigation()})
const runtime = createCapillaryUiRuntime({router})

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
- `NavigationBar` groups native route links and external-destination anchors
  but does not own destination DOM.
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

1. `@capillaryjs/capillary-ui/themes/base.css`
2. Collected CSS or `@capillaryjs/capillary-ui/styles/structural.css`
3. One `@capillaryjs/capillary-ui/colors/<name>/colors.css`
4. One `@capillaryjs/capillary-ui/themes/<name>/theme.css`

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

`capillaryUiThemeVariableCatalog` describes the supported palette and semantic
variable hierarchy. `findCapillaryUiStylesheetOption`, `replaceCapillaryUiStylesheet`,
`setCapillaryUiAppearance`, and `getCapillaryUiAppearance` support application-controlled
runtime selection.

### Line-control sizing

Textbox, Dropdown, Toggle, and Button use `--control-min-height: 2em` by
default: a 24px border-box minimum at the default 12px `--ui-font-size`.
This minimum is independent of general UI padding and the text line height.
Their labels and native controls inherit the font family and share a unitless
1.2 authored text line height. Native single-line inputs may clamp the used
line-height to platform font metrics (notably Firefox on Linux); their bodies
and text remain centered. Larger content can increase the minimum-sized body.
Textbox and Dropdown retain their `--input-width: 15em` default and existing
minimum-width/shrinking behavior. Field and button inline padding is 5px;
toggle segments use 6px. General `--space-xs`/`--space-sm` no longer determine
these line controls' padding.

Horizontal form `GroupBox` children use their natural content size: GroupBox
does not contribute a synthetic preferred width or an artificial size floor.
Intrinsic label/body tracks distinguish preferred field widths from the
configurable `--input-min-width` floor (default `6rem`). In wrapping rows,
fields shrink to that floor before groups wrap; below the combined child
minimum, the owning region must scroll. Vertical layouts stretch only across
their available inline axis and do not add height.

`variant="section"` is a natural-height, full-inline section: its larger
legend occupies the left end of a top rule and its body follows below without
a surrounding box. `variant="column"` is a natural-sized inner group with a
normal-size, semi-bold UI-font heading separated slightly from its contents.
Adjacent column variants in a horizontal `Layout`
are separated only by an inline divider and share the row's full block size.
In the transposed nesting, a horizontal outer Layout rotates a section's rule
to its inline edge, while vertically adjacent inner groups use block dividers
and share the Layout's full inline size. These variants express nested form
structure on either axis; themes provide their border color and other chrome.

### Island data surfaces

`DataTable`, `ListView`, and `TreeView` declare the static `dataSurface` host
trait, which emits `data-cap-surface="data"`. An island `Panel` with a header
and exactly one direct data-surface body child removes only its body inset, so
the panel chrome sits flush to the data surface. Other panel bodies retain
their normal inset. In this composition, omit a `DataTable` `caption`: the
labelled Panel header supplies the surrounding data-region name. Application
data-surface components can opt in by declaring the same static trait.

Checkbox variants and RadioButton retain compact 1.2em label rows with 1em
squares/circles. They center within stretched horizontal hosts without making
vertical lists as tall as text fields. Date/time controls consume the same
shared sizing rules. Themes may deliberately override the minimum (Java does),
but Shiny uses the structural defaults and adds chrome without text offsets.
Shadows do not participate in centering. Toggle borders and selected overlap
are painted independently of segment layout, so selection does not move text.

### Root sizing and typography

`CapillaryUiApp` is block-level and always applies `--application-background`,
`--ui-color`, `--font-family`, `--font-size`, and `--line-height`, so all of
its native and Capillary UI descendants inherit theme text treatment even when it is
embedded. Its `sizing` prop maps to `cap-fill-horizontal`,
`cap-fill-vertical`, or both to claim `100vw`, `100vh`, or the full viewport.
Its optional `layout` prop maps to the direction trait on that same host. This
is important for viewport shells: Flexbox only distributes an already bounded
size, so an auto-height intermediate wrapper does not inherit the root's
height constraint automatically.

The document itself remains application policy. A viewport-sized root claims
`100vh`, so the browser's default `body` margin would overflow it into
document scrollbars; dedicated app documents should remove it:

```css
html, body { margin: 0; }
```

The traits remain available for applications that use a plain `Component`
root. They now apply the same canvas, text color, and typography values. A
plain root without either trait remains content-sized and inherits host-page
text treatment.

### Native elements, traits, and component hosts

Capillary UI does not assign component or surface presentation to application-owned
native elements merely because of their element type. Native elements such as
`header`, `footer`, `main`, `section`, and `aside` retain their ordinary HTML
semantics.

Applications may explicitly opt native elements into Capillary UI presentation and
layout contracts by applying public Capillary UI traits such as `island`,
`cap-layout-horizontal`, `cap-layout-vertical`, `cap-size-natural`,
`cap-size-flexible`, and `cap-scroll`. These traits are intentionally
element-agnostic and may style application-owned native markup as well as
Capillary UI-owned hosts.

A Capillary UI component host is therefore not required merely to obtain Capillary UI layout or
surface treatment. Use `Layout` when no native semantic element is appropriate
and the container exists only to arrange children. Introduce any other component
when it owns a meaningful structural, behavioral, accessible, or presentation
contract.

In short: native element names provide semantics, Capillary UI traits provide opt-in
presentation and layout, and Capillary UI component hosts provide component-owned
contracts.

### Reusable traits

The allocation traits are structural and independently composable:

- `cap-layout-horizontal` and `cap-layout-vertical` arrange direct children
  and stretch them across the other axis;
- `cap-size-natural` keeps a direct child's application/content allocation;
- `cap-size-flexible` shares remaining main-axis space and supplies zero
  logical minimums so nested content can shrink;
- `cap-scroll` makes a bounded node the explicit overflow owner.

`DataTable`, `ListView`, and `TreeView` are a component-specific exception to
the otherwise explicit scroll-owner rule: each becomes the scroll owner when a
bounded flex parent constrains it. This prevents a collection's rows from
pushing its layout container into overflow. It does not make arbitrary sibling
content scrollable or select scrolling for application-owned native elements.

`Header`, `Layout`, `NavigationBar`, `Panel`, `Sidebar`, `SplitView`, and
`Toolbar` accept
`allocation="natural" | "flexible"` and map it to their outer host. `Panel`
uses `horizontal` or `vertical` for its inner Layout body rather than its
generated header and toolbar. SplitView applies direction to the relationship
between its two panes; each pane independently arranges its own children.
Application-owned elements may use the classes directly.

`Layout`, `Panel`, and `SplitView` reject simultaneous `horizontal` and
`vertical` modifiers. Layout requires one explicitly. Panel and SplitView retain
their former vertical and horizontal defaults, respectively, while the legacy
`orientation` and `direction` spellings remain compatibility aliases.

Flexible siblings have equal growth shares only when their box decoration is
equivalent. Application CSS may override ratios, sizes, and gaps. Flexible
allocation does not imply scrolling, and an island does not select the scroll
owner; filled-root island overflow remains a compatibility fallback. Rules use
no `!important`, so later application CSS can refine them. Capillary UI does not yet
provide breakpoint variants.

`island` marks one deliberate themeable surface boundary. Pass
`island={true}` to a wrapped component or use the class on application-owned
native markup. Capillary UI rejects nested component islands; application markup must
preserve the same one-layer invariant.

`colored` consumes an explicit `--c1`, `--c2`, `--c3` triplet for the shared
gradient and `--colored-shadow` treatment. It does not choose semantic colors
for the application.

## Accessibility and browser support

Capillary UI components use native controls and landmarks where possible, expose
accessible names, preserve focus during keyed updates, and render loading,
empty, and error messages outside collection semantics. The browser matrix
covers pinned Chromium, Firefox, and WebKit builds, including keyboard flows,
200% text, forced colors, and automated accessibility checks.

Applications remain responsible for meaningful labels, heading hierarchy,
domain validation messages, color contrast introduced by application CSS,
focus order across composed screens, and manual assistive-technology testing.

Capillary UI does not support SSR, hydration, Shadow DOM, registered Web Components,
legacy browsers, or a concurrent rendering scheduler.

## Further reference

- [Public API surface](../../docs/API_SURFACE.md)
- [Architecture](../../docs/architecture.md)
- [Application composition guide](docs/application-composition-guide.md) — design screens, component boundaries, state lifetimes, and layouts.
- [Repository layout guide](docs/application-layout-guide.md) — organize application source by responsibility and feature.
- [Theme contract](themes/README.md)
- [Color palette contract](colors/README.md)
- [Release history](CHANGELOG.md)

## Optional interaction-to-leaf diagnostics

With a Capillary diagnostic observer attached, native handlers and bindings
establish interaction roots. Component reads/watchers, class/function renders,
reactive children, and native/live-property bindings report causal consumers.
Without an observer these paths do not create diagnostic events.

Runtime `diagnosticScope` and static component `diagnosticScope` allow tool
subtrees to be excluded. Set static `diagnosticLabel` (or function component
`diagnosticLabel`) for names that survive minification; built-in hosts already
supply readable defaults. Keep the application in its normal runtime and use an
excluded runtime for custom inspection controls. Existing application-emitter
writes remain observable even if initiated by an excluded control.

These additive APIs require the diagnostics-enabled Capillary/Capillary UI 1.2
lines. See the [diagnostics guide](../../docs/diagnostics.md) and
[DevTools package](../capillary-devtools/README.md). Application policy remains
outside the UI runtime, and playback never rerenders the inspected application.
