# Fray

Fray is an experimental, browser-only component and DOM runtime built around
Glue emitters. It targets modern evergreen browsers. Its `0.x` API may change
with documented migration notes.

After publication, install Fray together with its Glue peer:

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray
```

Fray is ESM-only and targets the current and previous major versions of
Chromium, Firefox, and Safari at candidate time. Its reproducible test matrix
uses Playwright's pinned Chromium, Firefox, and WebKit builds. Repository
tooling requires Node 22+ and pnpm 10; Fray's runtime itself is browser-only.

## Set up a browser application

Fray ships ESM, TypeScript declarations, automatic/classic JSX runtimes, and
two supported CSS theme subpaths. Glue is a peer dependency.

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
import '@sylwellsoftware/fray/themes/light.css'

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
runtime.registerStyles(App).injectStyles(document)
runtime.mount(runtime.create(App), document.querySelector('#app')!)

function save(value: string) {
    console.log(value)
}
```

Register the root component's dependencies before injecting styles. Injection
is idempotent within a runtime, so another application root may register
additional component styles and inject again safely.

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

Fray's own stable and experimental built-ins are authored in TSX. Direct
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

Structural styles use semantic custom properties and leave colors to the
supported light/dark bundles. See [`themes/README.md`](themes/README.md) for the
public variable contract and consumer overrides.

Stable examples are tested with axe in Chromium, Firefox, and WebKit and have
no serious or critical automated violations. Browser tests also cover keyboard
operation, labelled roles, reduced motion, 200% configured text sizing, and
forced-colors focus visibility. A formal manual screen-reader pass is still a
release-candidate requirement; automated checks are not a substitute for it.

## Experimental data components

`ListView`, `DataTable`, `TreeView`, `TreeItem`, `Dialog`, filters, selection
handlers, and `Placeholder` are available only from
`@sylwellsoftware/fray/experimental`. They are outside the stable alpha
compatibility surface and may change without a migration bridge. Their state
model, keyboard behavior, measured data boundary, and current limitations are
documented in [EXPERIMENTAL.md](EXPERIMENTAL.md).

Fray is not a replacement for an SSR/hydration framework, Web Components,
React/Vue adapters, a broad design system, a virtualized production data grid,
legacy-browser support, or a stable `1.0` API. See the [workspace
overview](../../README.md), [alpha API surface](../../docs/API_SURFACE.md),
[architecture overview](../../docs/architecture.md),
[changelog](../../CHANGELOG.md), [contribution guide](../../CONTRIBUTING.md),
and [security policy](../../SECURITY.md).
