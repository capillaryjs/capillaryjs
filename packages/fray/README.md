# Fray

Fray is a browser-only component and DOM runtime built around
Glue emitters. It targets modern evergreen browsers. Its `0.x` API may change
with documented migration notes.

Install it together with its Glue peer:

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray
```

Fray is ESM-only and targets the current and previous major versions of
Chromium, Firefox, and Safari at candidate time. Its reproducible test matrix
uses Playwright's pinned Chromium, Firefox, and WebKit builds. Repository
tooling requires Node 22+ and pnpm 10; Fray's runtime itself is browser-only.

## Design model

Fray is the presentation half of a deliberately two-layer architecture:

```text
consumer application
  domain policy, composition, endpoints, active theme/color
                         │
                         ▼
Fray
  TSX/h(), components, DOM, events, lifecycle, structural CSS
                         │ get / subscribe / set
                         ▼
Glue
  mutable and derived values, live queries, status, causality
```

The libraries share a protocol, not a monolithic application framework. Glue
remains usable without a UI; Fray does not introduce hooks, a hidden component
state store, a query language, or transport policy to compete with Glue.

Fray follows these design rules:

- **Declarative structure, ordinary TypeScript logic.** TSX or `h()` describes
  the current DOM. Normal methods and event handlers express algorithms and
  commands.
- **Small components compose into larger widgets.** A table, for example, is
  assembled from headers, cells, filtering, selection, loading, and error
  pieces instead of becoming one opaque primitive.
- **Use the browser.** Native elements and semantics are preferred for inputs,
  buttons, labels, tables, progress, dialogs, and landmarks. Fray's custom host
  names are light-DOM ownership/styling hooks, not registered Web Components.
- **One reactive model.** Shared or composable state lives in Glue emitters;
  derived values replace manually mirrored state; live data lives in
  `LiveQuery`. Short-lived presentation details may remain explicit component
  fields when no other object must observe them.
- **Explicit ownership and cleanup.** Components own the child components,
  subscriptions, listeners, emitters, and queries they create, and release
  them with their lifecycle.
- **Stable browser state during updates.** The synchronous keyed patcher
  preserves compatible DOM nodes, focus, selection, input state, and event
  listener cardinality while reconciling a component's new vnode tree.
- **Progressive tooling.** JSX and generated structural CSS are build-time
  conveniences over the same small runtime contracts; they are not separate
  execution models.

Responsibility stays at the narrowest layer that understands it:

| Concern | Owner |
| --- | --- |
| Domain state, endpoint configuration, page composition, theme availability and selection policy | Application |
| DOM structure, native events, accessibility, component lifetime, visual async states | Fray components |
| Mutable/computed values, query timing/results, fetch state, optional causality | Glue |
| URL/wire serialization and retrieval mechanism | Injected Glue query handler/application adapter |
| Layout/flow CSS and stable component/part hooks | Fray structural styling |
| Look-and-feel treatment and palette | Separately loaded Fray-compatible theme/color CSS |

## Set up a browser application

Fray ships ESM, TypeScript declarations, automatic/classic JSX runtimes, one
generated structural stylesheet, replaceable theme treatments, and replaceable
color palettes. Glue is a peer dependency.

```ts
import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    Component,
    Panel,
    Sidebar,
    Textbox,
    Toolbar,
    createFrayRuntime,
    h,
} from '@sylwellsoftware/fray'
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
import '@sylwellsoftware/fray/themes/minimal/theme.css'

const name = new Emitter('Ada')

class App extends Component {
    static dependencies = [Button, Panel, Textbox, Toolbar]

    render() {
        return h(Panel, {header: 'Profile'},
            h(Textbox, {label: 'Name', valueEmitter: name}),
            h(Toolbar, {label: 'Profile actions'},
                h(Button, {label: 'Save', onClick: () => save(name.get())})))
    }
}

const runtime = createFrayRuntime()
runtime.mount(runtime.create(App), document.querySelector('#app')!)

function save(value: string) {
    console.log(value)
}
```

The prebuilt structural file targets Fray's default `fray-` hosts. Applications
with custom components or configured host names may instead register their root
dependencies and call `runtime.injectStyles(document)`; collection remains
idempotent and produces one application-scoped structural style element.

For automatic JSX, configure TypeScript with `"jsx": "react-jsx"` and
`"jsxImportSource": "@sylwellsoftware/fray"`. Classic JSX uses `h` as `jsxFactory` and
`Fragment` as `jsxFragmentFactory`. JSX and `h()` produce the same vnodes.

The same root can be written with automatic JSX:

```tsx
class App extends Component {
    render() {
        return <Panel header="Profile">
            <Textbox label="Name" valueEmitter={name} />
            <Button label="Save" onClick={() => save(name.get())} />
        </Panel>
    }

    static dependencies = [Button, Panel, Textbox]
}
```

## Component host elements

Fray components with a wrapper render a standards-valid custom host element,
not a framework identity class. The default application runtime therefore
produces DOM such as:

```html
<fray-panel data-fray-component="panel">
    <fray-textbox data-fray-component="textbox">
        <input type="text">
    </fray-textbox>
    <button data-fray-component="button">Save</button>
</fray-panel>
```

Native semantics remain native: `Button` renders `button`, `Toggle` renders
`fieldset`, `Sidebar` renders `aside`, and table header components render
`thead`/`th`. `Tab` is a declarative child consumed by `TabPanel` and has no
independent root. The
`data-fray-component` attribute keeps diagnostics unambiguous without taking
ownership of the consumer's `class`/`className`.

Element naming is an immutable application-runtime setting:

```ts
const defaultNames = createFrayRuntime()
// <fray-panel>, <fray-list-view>, ...

const productNames = createFrayRuntime({
    elementNames: {prefix: 'acme'},
})
// <acme-panel>, <acme-list-view>, ...

const prefixlessNames = createFrayRuntime({
    elementNames: {prefix: null},
})
// <layout-panel>, <list-view>, <text-box>, ...

const selectedOverrides = createFrayRuntime({
    elementNames: {
        prefix: null,
        overrides: {'panel': 'change-panel'},
    },
})
// <change-panel>, with standalone names for the other components
```

HTML custom-element names must contain a hyphen, so prefixless mode uses each
component's standards-valid standalone name rather than invalid names such as
`<panel>` or `<listview>`. Prefixes and overrides must be lowercase kebab-case;
an exact override must itself be a non-reserved custom-element name.

Each runtime owns its element-name mapping and structural-style registry.
Create the runtime once at application startup, then create and mount the root
through that runtime. Nested components inherit it automatically. A separate
compiled Fray build is unnecessary. Two runtimes with different mappings can
coexist in one document without their component-host selectors colliding.
Styles still live in the document's global cascade because these hosts are
deliberately unregistered light-DOM elements, not Web Components or Shadow DOM
boundaries.

## Reactive templates

TypeScript TSX is Fray's supported template syntax. Classic JSX and direct
`h()` calls are equivalent frontends: both lower to the same vnode tree and
use the same renderer. A future template-file syntax can target this vnode
contract without changing Glue binding semantics.

Fray's built-ins are authored in TSX. Direct
`h()` remains supported for consumers that do not use JSX and as the renderer's
canonical vnode operation, but it is not the built-in component authoring
format. The workspace lint gate rejects new `h()` templates under
`packages/fray/src/Components`.

Configured custom hosts are also available inside a TSX component through its
protected `Host` template component:

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
    static override standaloneHostName = 'ui-badge'
}
```

At runtime that template produces `<fray-badge>` by default,
`<acme-badge>` under an `acme` prefix, or `<ui-badge>` in prefixless mode.
Native-root components such as `Button` use their native tag directly in TSX
instead of `Host`.

Glue values have explicit behavior at each template boundary:

| Template form | Meaning |
| --- | --- |
| `{emitter}` | Render the current value and patch only that child range on emission. |
| `<Child source={emitter} />` | Pass the emitter object unchanged; the child owns how it consumes it. |
| `prop={live(emitter)}` | Subscribe a scalar DOM or component prop one way to the emitter's current value. |
| `<input bind:value={emitter} />` | Bind a writable string emitter and native `value` two ways. |
| `<input bind:checked={emitter} />` | Bind a writable boolean emitter and native `checked` two ways. |
| `this.read(emitter)` | Read during `render()` and rerender the component while that dependency is used. |
| `this.snapshot(emitter)` | Track and read `{value, fetchState, error}` for stateful rendering. |

Direct child and `live()` subscriptions are renderer-owned and are released
when their nodes disappear. Render-time `read()`/`snapshot()` dependencies are
reconciled after every render, so conditional dependencies are also released.
The component still owns and disposes emitters it creates. Direct rendering
uses only an emitter's value; use `snapshot()` when loading and error state
must affect the markup.

This complete example uses mutable and derived emitters, direct emitter
children, raw emitter props, native two-way bindings, a one-way live property,
conditional tracked state, and a `LiveQuery` passed to a child:

```tsx
import {
    DerivedEmitter,
    Emitter,
    FetchState,
    LiveQuery,
    QueryHandler,
} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'
import {
    Button,
    Component,
    Panel,
    Textbox,
    createFrayRuntime,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, WritableEmitter} from '@sylwellsoftware/fray'

interface Change {
    id: number
    title: string
}

const fixtures: readonly Change[] = [
    {id: 101, title: 'Add release attestations'},
    {id: 102, title: 'Migrate the demo to TypeScript'},
]

class ChangeQueryHandler extends QueryHandler<{filter: string}, readonly Change[]> {
    override fetch({filter}: {filter: string}): readonly Change[] {
        const needle = filter.trim().toLocaleLowerCase()
        return needle === ''
            ? fixtures
            : fixtures.filter(({title}) =>
                title.toLocaleLowerCase().includes(needle))
    }
}

interface PreviewProps extends ComponentProps {
    heading: ReadableEmitter<string, unknown>
    approved: WritableEmitter<boolean>
}

class Preview extends Component<PreviewProps> {
    render() {
        return <section aria-label="Live change preview">
            <h3>{this.props.heading}</h3>
            <label>
                <input type="checkbox" bind:checked={this.props.approved} />
                Approved
            </label>
        </section>
    }
}

interface ResultsProps extends ComponentProps {
    results: ReadableEmitter<readonly Change[] | undefined, unknown>
}

class Results extends Component<ResultsProps> {
    render() {
        const {value, fetchState, error} = this.snapshot(this.props.results)
        if (fetchState === FetchState.Error) {
            return <p role="alert">{String(error)}</p>
        }
        return <ul aria-busy={fetchState === FetchState.Loading}>
            {(value ?? []).map(({id, title}) => <li key={id}>{title}</li>)}
        </ul>
    }
}

class ChangeApp extends Component {
    readonly title = new Emitter('Add native Glue template bindings')
    readonly approved = new Emitter(false)
    readonly filter = new Emitter('')
    readonly showPreview = new Emitter(true)
    readonly heading = new DerivedEmitter(
        [this.title, this.approved] as const,
        ([title, approved]) => `${title} — ${approved ? 'approved' : 'draft'}`,
    )
    readonly results = new LiveQuery({
        handler: new ChangeQueryHandler(),
        args: {filter: this.filter},
    })

    render() {
        return <Panel header={this.heading}>
            <Textbox label="Title" valueEmitter={this.title} />
            <label>Search <input bind:value={this.filter} /></label>

            <output title={live(this.heading)}>Current title: {this.title}</output>

            <label>
                <input type="checkbox" bind:checked={this.showPreview} />
                Show preview
            </label>
            {this.read(this.showPreview)
                ? <Preview heading={this.heading} approved={this.approved} />
                : null}

            <Results results={this.results} />
            <Button
                label="Refresh results"
                onClick={() => void this.results.refresh()}
            />
        </Panel>
    }

    onDestroy(): void {
        this.results.dispose()
        this.heading.dispose()
        this.showPreview.dispose()
        this.filter.dispose()
        this.approved.dispose()
        this.title.dispose()
    }

    static dependencies = [Button, Panel, Preview, Results, Textbox]
}

const runtime = createFrayRuntime({elementNames: {prefix: 'acme'}})
runtime.registerStyles(ChangeApp).injectStyles(document)
runtime.mount(runtime.create(ChangeApp), document.querySelector('#app')!)
```

Emitter props are raw by default on purpose: automatically unwrapping every
prop would make it impossible for controls such as `Textbox` and application
components such as `Preview` to receive a stable emitter. Use `live()` only
when the receiver expects a scalar prop and one-way updates are desired.

## Glue integration and ownership

The smallest Fray/Glue seam is a current value plus subscription:

```text
readable: get() + subscribe(listener)
writable: readable contract + set(next)
```

Choose the integration mechanism according to what should update:

- render an emitter as a child or use `live(emitter)` for fine-grained scalar
  DOM/component updates;
- use `this.read(emitter)` when the component's structure depends on its value;
- use `this.snapshot(emitter)` when loading/error state affects the structure;
- pass the emitter object as a normal prop when a child control owns the
  interaction;
- use callbacks for one-way commands and emitters for values that must be read,
  composed, or observed elsewhere.

A data-aware component normally watches the downstream value it renders rather
than every upstream input. Leaf controls write ordinary emitters; a coordinator
owns any semantic `DerivedEmitter`; a data owner constructs or receives the
`LiveQuery`; the injected handler alone owns transport serialization.

```text
control event ──► Emitter ──► DerivedEmitter ──► LiveQuery
                      │              │                │
                      └──────────────┴────────────────┘
                                  Fray view
```

Construction itself is side-effect-free with respect to DOM mounting.
`initialize()` establishes component subscriptions, mounting creates/attaches
the rendered tree, updates reconcile it, and `destroy()` releases renderer and
component-owned resources. State created by a component should be disposed in
`onDestroy()` as shown above. State supplied through props remains owned by the
caller unless an API explicitly says otherwise.

For asynchronous views, keep the widget's semantic structure present whenever
practical and render initial loading, refresh-with-previous-data, empty, error,
and ready states explicitly. Glue owns the query state transition; Fray owns
how that state is presented.

## State convention

Every stateful control follows one ownership rule:

- pass a writable `valueEmitter` to share and externally update state;
- otherwise pass `defaultValue` to initialize the control's owned emitter;
- read the active emitter from the component instance's `valueEmitter`
  property;
- use `onInput` or `onChange` to observe user actions. The callback runs after
  the emitter changes and does not replace the emitter contract.

`value` remains an initial-value alias for imported `0.x` call-site
compatibility; it is not a prop-driven controlled mode. Prefer `valueEmitter`
or `defaultValue` in new code.

## Stable component reference

All components also accept `children`, `className` (`class` is an alias), and a
sibling-local `key` through the common component props.

| Component | Important props | User callback | State/emitter behavior |
| --- | --- | --- | --- |
| `Button` | `label`, `type`, `disabled`, `pressed`, `busy`, `busyLabel`, `ariaLabel`, native `id`/`name`/`value`/`title` | `onClick(event)` | Stateless native button; busy state disables activation and is presentation only. |
| `Toolbar` | `label`, `orientation`, `id`, `children` | None | Stateless named toolbar; orientation is horizontal or vertical. |
| `Textbox` | `label` or `ariaLabel`, value props, `disabled`, `required`, `readOnly`, `error`, native text constraints, `inputRef` | `onInput(value, event)`, `onChange(value, event)` | String `valueEmitter`; external emitter changes patch the native input without replacing it. |
| `Dropdown<T>` | `options`, `label` or `ariaLabel`, value props, `disabled`, `required`, `error`, `placeholder`, `name` | `onChange(value, event)` | Typed string/number `valueEmitter`; `options` may be an array or readable emitter. |
| `Toggle<T>` | `options`, `label` or `ariaLabel`, value props, `disabled`, `required` | `onChange(value, event)` | One selected value; arrow keys, Home, and End move and select within the radio group. |
| `Checkbox<T>` | `symbols`, `label`, value props, `disabled`, `required`, `name` | `onChange(value, event)` | Two-state semantic value by default; click/Space advances and arrow keys move in either direction. |
| `TriCheckbox` | Checkbox props except `symbols` | `onChange(value, event)` | Cycles deny → neutral → prefer using `FilterMode`. |
| `QuadCheckbox` | Checkbox props except `symbols` | `onChange(value, event)` | Cycles deny → neutral → prefer → require using `FilterMode`. |
| `Panel` | `header`, `toolbar`, `orientation`, `disabled`, `id`, `children` | None | Stateless labelled section when a header exists; `disabled` describes the region but does not mutate descendant controls. |
| `Sidebar` | `header`, `toolbar`, `ariaLabel`, `id`, `children` | None | Native complementary region with fixed header/toolbar parts and independently scrolling content. |
| `SplitView` | `primary`, `secondary`, `direction`, `primarySize`, pane labels | None | Stateless, non-resizable two-pane layout with explicit overflow ownership. |
| `DescriptionList` / `DescriptionItem` | list `label`; item `term`, `value` or children | None | Native `dl`/`dt`/`dd` record summary with responsive term/value wrapping. |
| `ProgressBar` | `label`, `value` or `valueEmitter`, `max`, `valueText` | None | Labelled native progress; a null value is indeterminate. |
| `ThemePicker` | `label` or `ariaLabel`, theme `options`, value props, `targetDocument`, `disabled` | `onChange(value, option, event)` | String `valueEmitter`; replaces only the theme stylesheet link. |
| `ColorPicker` | `label` or `ariaLabel`, color `options`, value props, `targetDocument`, `disabled` | `onChange(value, option, event)` | String `valueEmitter`; replaces only the color stylesheet link. |
| `Tab` | `id`, `label`, `disabled`, `children` | None | Declarative content marker consumed by `TabPanel`; not rendered as a tab by itself. |
| `TabLine` | `tabs`, `label`, `baseId`, value props | `onChange(id, event)` | Active-tab `valueEmitter`; arrow keys skip disabled tabs, with Home/End support. |
| `TabPanel` | `tabs` or `Tab` children, `label`, `id`, value props | `onChange(id, event)` | Owns or consumes the active-tab emitter and wires the selected tab to its tabpanel. |

Invalid option arrays, duplicate tab IDs, unsupported orientations, malformed
emitters, and non-function callbacks fail with descriptive errors.

## Component examples

### Actions and toolbar

```ts
h(Toolbar, {label: 'Editor actions'},
    h(Button, {label: 'Save', onClick: save}),
    h(Button, {label: 'Delete', disabled: true}))
```

### Textbox

```ts
const query = new Emitter('')

h(Textbox, {
    label: 'Search',
    valueEmitter: query,
    required: true,
    error: query.get() === '' ? 'Enter a search term' : null,
    onInput: (value) => console.log('search changed', value),
})
```

### Dropdown

```ts
const role = new Emitter<'author' | 'reviewer'>('author')

h(Dropdown, {
    label: 'Role',
    valueEmitter: role,
    options: [
        {value: 'author', label: 'Author'},
        {value: 'reviewer', label: 'Reviewer'},
    ],
    onChange: (value) => console.log(value),
})
```

### Toggle

```ts
h(Toggle, {
    label: 'View',
    defaultValue: 'list',
    options: [['list', 'List'], ['grid', 'Grid']],
    onChange: (value) => console.log(value),
})
```

### Checkbox variants

```ts
h(Checkbox, {label: 'Include archived'})
h(TriCheckbox, {label: 'Match policy', defaultValue: FilterMode.Neutral})
h(QuadCheckbox, {label: 'Required tags', defaultValue: FilterMode.Require})
```

`FilterMode` values are `Deny`, `Neutral`, `Prefer`, and `Require`. The basic
checkbox uses neutral/prefer, while the variants expose the additional states.

### Panel

```ts
h(Panel, {
    header: 'Account',
    orientation: 'vertical',
    toolbar: h(Toolbar, {label: 'Account actions'},
        h(Button, {label: 'Edit'})),
}, h('p', null, 'Account details'))
```

### Sidebar

```ts
h(Sidebar, {
    id: 'project-navigation',
    header: 'Projects',
    toolbar: h(Toolbar, {label: 'Project filters'},
        h(Textbox, {label: 'Search projects'})),
}, h('ul', null, h('li', null, 'Release automation')))
```

The surrounding grid or flex layout must bound the Sidebar's height. Its
header and toolbar remain fixed while the dedicated content part owns vertical
scrolling and is keyboard-focusable. Supply `ariaLabel` when there is no visible
`header`.

### Declarative tabs

```ts
h(TabPanel, {id: 'profile', label: 'Profile sections'},
    h(Tab, {id: 'summary', label: 'Summary'}, 'Summary content'),
    h(Tab, {id: 'details', label: 'Details'}, 'Details content'))
```

### Standalone tab line

```ts
h(TabLine, {
    baseId: 'settings',
    label: 'Settings sections',
    defaultValue: 'general',
    tabs: [
        {id: 'general', label: 'General'},
        {id: 'advanced', label: 'Advanced'},
    ],
    onChange: (id) => console.log('active tab', id),
})
```

Use `TabPanel` when Fray should render content and ARIA relationships. Use a
standalone `TabLine` only when the consumer owns the corresponding tabpanel
content and IDs.

## Styling and accessibility

Fray's styling system has three physically and conceptually separate layers:

| Layer | Shipped path | Responsibility | Runtime behavior |
| --- | --- | --- | --- |
| Structure | `styles/structural.css` | Generated component layout, flow, sizing, positioning, accessibility mechanics, stable hooks, and variable consumption | Loaded once; remains stable during presentation changes |
| Theme | `themes/<name>/theme.css` | Typography, spacing, geometry, depth, surface treatment, semantic family mappings, and exceptional pseudo/native rendering | Loaded separately and independently replaceable |
| Colors | `colors/<name>/colors.css` | Palette primitives and semantic color roles | Loaded separately and independently replaceable |

Component authors place only structure and mechanics in `static css`: display,
flow, sizing, positioning, overflow, stable state hooks, and consumption of
semantic variables. Reusable `static baseStyles` mappings apply named
structural rules to component selectors, while `static dependencies` let the
collector traverse a complete application tree, deduplicate definitions, and
generate one artifact. Literal palettes and treatment-specific shadows,
gradients, radii, and decoration do not belong in component CSS.

The initial supported treatments are `shiny`, `java`, and `minimal`. The color
catalog contains `iceblue`, `ocean`, `green`, `gray`, `orange`, `purple`, `red`,
and `yellow`. The older top-level `themes/light.css` and `themes/dark.css`
remain compatibility bundles; new applications should use the separated
contract.

These three treatments adapt the useful intent of earlier styling experiments
rather than preserving their CSS literally. Application-specific selectors,
duplicated declarations, and mixed structural/presentation rules were removed;
the characteristic restrained Minimal, classic raised Java, and layered glossy
Shiny treatments were rebuilt on the current component hooks and variables.

### Hierarchical custom properties

CSS custom properties are Fray's primary theme integration protocol:

```text
colors.css
  --fray-color-* palette/semantic roles
                  │
                  ▼
theme.css
  global UI roles (font, spacing, shape, surface)
                  │
                  ▼
  generic families (header, button, input, panel, selection)
                  │
                  ▼
  optional variants (table header, tab button, toggle button,
                     dropdown trigger, dialog header)
                  │
                  ▼
structural CSS and custom components
```

Components request the narrowest useful variable and explicitly fall back
toward its generic family. A theme can therefore change all header-like or
button-like elements with a few assignments, then override only the variants
that should look different. `frayThemeVariableCatalog` exports this contract in
machine-readable form, including every variable's layer, family, value kind,
purpose, and optional fallback.

A custom component should consume the same hierarchy rather than forcing every
theme to learn a new selector:

```css
acme-grid > header {
  color: var(
    --acme-grid-header-color,
    var(--fray-table-header-color, var(--fray-header-color))
  );
  background: var(
    --acme-grid-header-background,
    var(--fray-table-header-background, var(--fray-header-background))
  );
}
```

That component immediately follows compatible Fray themes while retaining a
consumer/component-specific escape hatch.

Variables are preferred, not mandatory. Some visual treatments require actual
selectors and pseudo-elements. Shiny uses theme-scoped stable
`data-fray-component`, `data-part`, role, and ARIA-state hooks to layer
highlights over headers and button-like controls, draw custom dropdown arrows
and checkbox surfaces, and style native progress pseudo-parts. These rules must
not depend on application classes or generated IDs, must never intercept
pointer events, and must yield to native representation under forced colors.

### Runtime selection

`replaceFrayStylesheet` maintains one
`link[data-fray-stylesheet="theme"]` and one
`link[data-fray-stylesheet="colors"]`. Replacing either link also sets the
corresponding `data-fray-theme` or `data-fray-color` root attribute. The
`ThemePicker` and `ColorPicker` controls expose the same operation through the
normal Fray value-control contract.

The default option catalogs resolve URLs against Fray's published package
layout for direct ESM/CDN use. A bundled application should ask its bundler to
emit each selectable CSS file as an asset and supply those resulting URLs:

```tsx
import {ColorPicker, Component, ThemePicker} from '@sylwellsoftware/fray'
import iceblueHref from '@sylwellsoftware/fray/colors/iceblue/colors.css?url'
import purpleHref from '@sylwellsoftware/fray/colors/purple/colors.css?url'
import minimalHref from '@sylwellsoftware/fray/themes/minimal/theme.css?url'
import shinyHref from '@sylwellsoftware/fray/themes/shiny/theme.css?url'

const themes = [
    {value: 'shiny', label: 'Shiny', href: shinyHref},
    {value: 'minimal', label: 'Minimal', href: minimalHref},
]
const colors = [
    {value: 'iceblue', label: 'Ice blue', href: iceblueHref},
    {value: 'purple', label: 'Purple', href: purpleHref},
]

class AppearanceControls extends Component {
    render() {
        return <aside aria-label="Appearance">
            <ThemePicker label="Theme" options={themes} defaultValue="shiny" />
            <ColorPicker label="Colors" options={colors} defaultValue="iceblue" />
        </aside>
    }

    static dependencies = [ColorPicker, ThemePicker]
}
```

The `?url` syntax above is supported by Vite; use the equivalent emitted-asset
mechanism for another bundler. The structural stylesheet is not replaced.

See [`themes/README.md`](themes/README.md) for the complete architecture and
variable families, and [`colors/README.md`](colors/README.md) for the palette
contract.

Stable examples are tested with axe in Chromium, Firefox, and WebKit and have
no serious or critical automated violations. Browser tests also cover keyboard
operation, labelled roles, reduced motion, 200% configured text sizing, and
forced-colors focus visibility. A formal manual screen-reader pass is still a
release-candidate requirement; automated checks are not a substitute for it.

## Data workflows

`ListView`, `DataTable`, `TreeView`, `TreeItem`, `Dialog`, `FilterPanel`, and
their model helpers are part of the package entry point. All accept
ordinary Glue emitters; they do not introduce a second state store.

List and table selection is discriminated by cardinality. Single selection is
an item or `null`; array state is reserved for explicit multi-selection:

```tsx
const selected = new Emitter<Project | null>(null)
const selectedRows = new Emitter<Project[]>([])

<ListView items={projects} selectedItemEmitter={selected} itemKey="id" />
<DataTable
    data={projects}
    columns={columns}
    multiSelect
    selectedItemsEmitter={selectedRows}
/>
```

Both modes reconcile selected keys to fresh objects when data is replaced.
Multi-selection retains Control/Command toggles, Shift and pointer-drag ranges,
and keyboard operation.

DataTable accepts exactly one data boundary:

```tsx
// Direct local data; Fray derives sorted/filtered rows.
<DataTable data={projects} columns={columns} />

// Convenient REST adapter; the table creates and disposes this source.
<DataTable
    rest={{url: '/api/projects', baseUrl: location.href}}
    columns={columns}
/>

// Explicit source; the caller owns and eventually disposes it.
const source = createQueryTableDataSource({query, sortEmitter, filtersEmitter})
<DataTable dataSource={source} columns={columns} />
```

`createLocalTableDataSource`, `createQueryTableDataSource`,
`createHandlerTableDataSource`, and `createRestTableDataSource` make ownership
visible. Sources package the row query with sort/filter emitters, retry, and
disposal. The default REST serializer retains the compact existing endpoint
tokens; inject `serializeQuery` when an endpoint uses another wire contract.

Tree node state is projected from complete immutable snapshots:

```ts
const selectedNode = deriveTreeNode(treeNodes, selectedKey)

// Only for an authoritative writable root:
updateWritableTreeNode(treeNodes, 'project-1', (node) => ({...node, label: 'Updated'}))
```

For a tree derived from domain state, a callback updates that real source; the
tree derivation then rebuilds and `deriveTreeNode` resolves the fresh node.
`updateTreeNode` is the equivalent pure path-copy operation.

Generic `FilterState` keeps `neutral`, `prefer`, `require`, and `deny` semantic
values separate from glyphs and transport. `filterByState`,
`deriveFilterPredicate`, and `deriveFilteredItems` consume caller-supplied
dimension matchers. `serializeFilterState`/`parseFilterState` round-trip
validated version-1 plain data without owning URL or storage access. Unknown
valid keys are preserved and ignored until a matching definition exists.
Dimensions combine with AND. Within each dimension, a denied match always
rejects, every required option must match, and at least one preferred option
must match when preferences are active. Neutral options do not constrain the
result.

The stable non-virtualized performance boundary and detailed state behavior are
documented in this guide. See the migration notes in the changelog before
upgrading from 0.2.x.

Fray is not a replacement for an SSR/hydration framework, Web Components,
React/Vue adapters, a broad design system, a virtualized production data grid,
legacy-browser support, or a stable `1.0` API. See the [workspace
overview](../../README.md), [API surface](../../docs/API_SURFACE.md),
[architecture overview](../../docs/architecture.md),
[changelog](../../CHANGELOG.md), [contribution guide](../../CONTRIBUTING.md),
and [security policy](../../SECURITY.md).
