# Capillary UI

Capillary UI is a browser-only TypeScript UI runtime that gives Capillary application models native, interactive browser structure. It provides TSX rendering, explicit component lifecycle, accessible controls and data views, scoped services and routing, runtime localization, and dependency-collected structural CSS. Application views should first use the existing Capillary UI or project-owned component whose contract matches the interaction; use native semantic HTML directly for document content and where no component owns the task. Framework components use native HTML internally when it is the right semantic implementation.

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

Application authors follow a component-first rule: reuse an existing Capillary UI
or project component when it provides the needed interaction and presentation
contract. Do not rebuild the same validation, keyboard/focus, selection,
accessibility, busy/error, or lifecycle behavior in raw markup without a concrete
gap. Native semantic elements remain appropriate for document structure and
content, and are the normal implementation inside Capillary UI components. See
the [application composition guide](docs/application-composition-guide.md) for
the practical reuse and extraction threshold.

The [interaction design guide](docs/interaction-design-guide.md) covers complete
theme boundaries, buttons versus widget interactions, direct manipulation,
icons and required feedback for asynchronous user operations. Its
[progressive-rendering rule](docs/interaction-design-guide.md#render-progressively-and-keep-independent-controls-usable)
keeps known structure visible and independent controls usable while data loads. The
[application composition guide](docs/application-composition-guide.md) applies
those choices to screen structure and lifetime.

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

Put the complete intended interface inside that theme boundary, including its
account/navigation/settings shell. Loading CSS variables alone does not apply
the font to siblings outside `cap-app`. Embedded sizing still applies typography;
use `landmark="none"` when an inner view or surrounding document owns the main
landmark. Contextual surfaces mounted outside the root need their own theme
boundary. Keep deliberate source/code monospace styling.

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
`presentBusy(pending, slot?, identity?)` is protected shared visual timing for
custom components. Use fixed slot names for separate surfaces and an operation
identity when replacement should restart the delay. Declare `StatusPresentation`
as a style dependency and apply its `cap-working` trait with
`data-cap-busy-visible` from this method; keep `aria-busy` tied to actual pending
state. Timers are cancelled on completion, identity replacement and destruction.
`onCleanup()` registers listeners or other cleanup functions that Capillary UI invokes
on destruction.

`listen(target, type, callback, options?)` attaches a traced native listener until
destruction. `listenWhile(...)` has the same owner/tracing contract but returns a
disposer; calling it removes both the listener and its cleanup registration.
Use it for temporary integrations instead of accumulating dormant listeners.

### Pointer dragging

`createPointerDrag<TContext>(owner, options)` owns one pointer gesture for a
Component. Call `begin(event, capturedContext, captureElement?)` from the native
pointerdown handler. The default capture element is event.currentTarget; use the
owning focusable widget when the visual grip is decorative. Primary left-pointer
starts only are accepted. Native pointer capture is required; keep touch-action
appropriate to the handle. Starting a new gesture cancels the previous one.

```ts
const drag = createPointerDrag<{x: number; y: number}>(owner, {
    onMove: ({context, dx, dy}) => preview.set({x: context.x + dx, y: context.y + dy}),
    onCommit: ({context, dx, dy}) => {
        preview.set(null)
        commitMove({x: context.x + dx, y: context.y + dy})
    },
    onCancel: () => preview.set(null),
})
```

Start/preview callbacks run only beyond `threshold` CSS pixels (default 3,
Euclidean distance); release commits once if that distance was crossed, including
a release without an intervening move event. A click does not commit a drag.
Snapshots contain context, capture element, start/current points, dx/dy and the
native PointerEvent. `preventDefault` defaults to true. Context is caller-owned;
capture revision/permission/callback identity and recheck before accepting edits.
Callbacks are synchronous, not implicitly awaited; explicit commands and owned
feedback handle required async outcomes.

`active`, `dragging` and `context` describe the current gesture. `cancel(reason?)`
clears it; calling cancel while idle also clears pending click suppression.
Cancellation reports the last pointer snapshot and a reason such as
replaced, pointercancel, lostcapture, escape, blur, capturefailed or disposed.
Listeners/capture are released on every terminal path and owner destruction;
`dispose()` allows earlier cleanup. `consumeClick(event)` consumes only the
immediate pointer-generated click on the captured widget after a drag, never
keyboard activation. Check it in a widget's click handler when click is the
non-drag alternative. A new pointer start clears stale suppression.

Keep recognizable grips, keyboard manipulation and a non-drag alternative in the
owning widget. This helper provides no button semantics, domain transaction,
coordinate system, selection store or model-specific validation.

### Component diagnostics and example

Diagnostic labels default to static `diagnosticLabel`, `hostName`, then the class
name. Override the instance `diagnosticLabel` getter when instances need distinct
names; identity labels are captured at first observation. Table diagnostics expose
`Table header`, column-specific header cells, and `Table body`. Unchanged header
props skip parent-driven rendering, while sort/filter subscriptions remain active.
Consumer events distinguish render passes from own renderer DOM writes; see the
[diagnostics guide](../../docs/diagnostics.md) for the exact counting boundary.

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
        &[data-tone="positive"] { color: var(--palette-status-positive); }
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

### Commands at declared interactions

Attach an `AsyncCommand` to a semantic interaction instead of manually wiring
the callback plus its busy/error state. Button commands take no arguments;
commands needing application values use `bindCommand()`, which samples them
only when activated:

```tsx
<Button label="Add a work item"
    command={bindCommand(addItem, {screen: 'projects'})}
    busyLabel="Adding…" />
```

The control presents the original command's running/execution-error state and
blocks the interaction while it runs by default. `disableWhileRunning={false}`
deliberately delegates repeated interaction to the command's concurrency policy;
application `disabled` and `readOnly` still win.

`changeCommand` runs after a changed accepted value on value controls (Textbox
and temporal inputs run on committed `change`, not every input). `selectionCommand`
runs after a completed user selection on ListView, DataTable, or TreeView.
Mounting, programmatic writes, query/data reconciliation, focus, and tree
expansion never execute a command. The callback for the same interaction
(`onClick`, `onChange`, or `onSelect`) is mutually exclusive with its command.
Applications retain arguments, validation, confirmation, navigation, and
success effects; use `succeeded`, `connect`, and `refreshOn` for the latter.

First define what completes the user's request. A command owns its required
outcome; a selection-driven query can load required details while selection
remains accepted and replaceable; independent reactions own their own loading
and errors. Only work required by the interaction contributes to its origin's
busy state. Connections do not extend command completion. See the
[three completion contracts](docs/interaction-design-guide.md#decide-what-completes-the-interaction)
for failure, replacement and partial-success guidance.

Controls show command executor errors and argument-sampler/concurrency
invocation failures inline by default. Set `commandErrors="external"` together
with `onCommandInvocationError` to own invocation-error presentation elsewhere;
the command's error snapshot remains available to the application.

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

#### Native forms and associated fields

`Form` retains native validation and Enter/click submission while invoking one
explicit command. It does not own field values or business validation rules.
Use ordinary `Button type="submit"` children, including through nested components;
do not also attach a click command. Only the initiating submit button receives
busy/error presentation. Other submitters are guarded by default without busy
decoration; editable fields and ordinary Cancel buttons remain independent.

```tsx
<Form submitCommand={saveDetails} submitArguments={({form, submitter}) => {
    const values = new FormData(form, submitter as HTMLButtonElement | null)
    return {name: String(values.get('name') ?? ''), description: String(values.get('description') ?? '')}
}}>
    <FormLayout>
        <FormField controlId="name" label="Name" required help="Choose a unique name"
            control={field => <Textbox {...field} name="name" valueEmitter={name}/>}/>
        <FormField controlId="description" label="Description"
            control={field => <TextArea {...field} name="description" rows={4} valueEmitter={description}/>}/>
    </FormLayout>
    <Button type="submit">Save</Button>
    <Button onClick={() => closeEditor()}>Cancel</Button>
</Form>
```

`Form<TArguments>` requires `submitCommand` and, for non-void arguments,
`submitArguments({form, submitter, event})`. A pre-bound command needs no second
sampler. Optional props are `id`, `name`, `label`, `disabled` (submission only),
`disableWhileRunning`, `noValidate`, `formRef` and the normal command-error
options. `disabled` does not disable an entire fieldset. Use an explicit fieldset
when the application requires locking edits. Native `formNoValidate` on a submit
Button is respected. Programmatic submission must use `requestSubmit()`;
native `form.submit()` bypasses both validation and the submit event.

A sampling failure is reported without invoking the command. Form displays its
inline error once and associates the originating Button with it. An external
error owner uses `commandErrors="external"` and an explicit invocation-error sink.
Raw native submit controls still submit through Form; automatic button feedback
is supplied by Capillary UI Button. Closing a form does not abort an app-owned
command: its persistent owning view must present any remaining outcome/recovery.

`TextArea` uses the same string value-control, `onInput`/committed `onChange` or
`changeCommand`, disabled/readOnly/required/busy/error and command-error contracts
as Textbox. It adds `rows`, `cols`, `wrap`, `spellCheck`, a textarea `inputRef`,
and focus/blur callbacks for explicit integrations; name, placeholder,
autoComplete and min/maxLength are native attributes. Native editing/IME and
textarea newline behavior remain native; source codecs belong to the application.
It is not a code editor or a lossless source-file codec. Textbox also exposes
native `list`, `autoCapitalize`, `spellCheck`, `min`, `max`, and `step` for
browser features that belong alongside the standard input contract. The bounds
also let an app-owned range-filter component reuse Textbox's value and label
contract for a native range input.

`FormField` requires `controlId`, `label` and a `control` function, with optional
help/error/required props. The function receives `id`, `ariaDescribedBy`,
`ariaInvalid` and `required`. Spread these onto Textbox/TextArea/Dropdown/Checkbox,
or map them explicitly to native attributes. Do not add a second inner label.
Control-owned errors append to, rather than replace, field descriptions.
FormField's error is presentation; it does not invent a native validity rule.
Use OptionGroup/fieldset for groups rather than labelling a composite as one input.

`FormLayout` aligns direct FormField children in two columns and stacks them in
narrow containers. Give it an available width; contextual forms should have an
intentional panel width. It does not provide scrolling, model state or persistence.
`Button.ariaDescribedBy` also composes supplementary help with its own errors.

#### Searchable values

Use `ComboBox` for an editable search field with a list of values, not a menu
of commands. Options have a string/number `value`, optional string `label` and
`disabled` state. Values must be unique and finite; labels must be nonempty.
The accepted `TValue | null` value is independent of the editable search text.

```tsx
<ComboBox label="Field type" valueEmitter={fieldType}
    options={knownTypes} searchEmitter={typeSearch} />
<ComboBox<string> label="Suggested code" valueEmitter={code}
    options={suggestions} allowCustomValue />
```

The normal value-control convention applies. Use a nullable emitter for a
clearable accepted value, and write to it for programmatic reconciliation;
reconciliation never invokes `changeCommand`. `searchEmitter` is an optional
caller-owned string emitter; otherwise the control owns its search buffer.
Typing/search and active-option exploration do not change the accepted value.
The default local filter is synchronous and case-insensitive in the runtime
locale. Opening a fresh chooser clears the search buffer to show all options;
opening while editing preserves the current query. `filter="none"`
trusts supplied results, for example from an application-owned LiveQuery driven
by the search emitter. The control never creates a transport, debounce policy
or query. Option emitters may initially be undefined, and source replacement
releases the old subscriptions. Controlled value/search emitters are stable for
the component's lifetime.

Arrow keys open/navigate enabled choices while DOM focus stays in the input.
Enter accepts the active option or an exact unique label; native text-editing
keys and composition Enter are not intercepted. Escape abandons search without
undoing the accepted value. In strict mode, unaccepted nonempty text is discarded
on blur. Clearing text and committing it accepts null. With `allowCustomValue`,
Enter without an active choice or blur commits custom text; this mode requires
the broad `string` type, not numbers or a closed literal union. Empty custom text
also commits null. Clicking the toggle opens/closes the anchored listbox.

Optional props include label/ariaLabel/optionsLabel, id/name/placeholder,
disabled/readOnly/required, inputRef and the ordinary busy/error/description and
changeCommand/onChange contracts. Required native validity tests the accepted
value (null and an empty string are missing), not the transient query. A named hidden native input serializes the
accepted option id rather than its display label. Option/query loading remains
separate from a declared selection command; errors do not roll back acceptance.
Owned UI text is configurable through the `comboBoxOptionsLabel`,
`comboBoxOpenLabel`, `comboBoxEmpty`, `comboBoxLoading` and `comboBoxRequired`
runtime messages, with ordinary English fallback.

#### Supplemental tooltips

`Tooltip` supplements an independently named trigger with plain text. It appears
after 350 ms of hover/focus (override `delayMs`), stays open while the pointer is
over either surface, and dismisses on activation, Escape or leaving both. Focus never moves.
It shares native top-layer positioning but does not dismiss an open menu.

```tsx
<Tooltip text="Use arrow keys on the canvas to pan." trigger={({ariaDescribedBy, triggerRef}) =>
    <Button icon="pan" ariaLabel="Pan canvas" title=""
        ariaDescribedBy={ariaDescribedBy} buttonRef={triggerRef}/>} />
```

Attach `triggerRef` to the actual native element; use Button.buttonRef,
Textbox.inputRef, or native `ref`. Merge `ariaDescribedBy` with existing help ids
instead of replacing them. Button preserves its own error/form descriptions.
Use `title=""` to suppress duplicate native title hints. Optional `id` sets the
tooltip id. Text must be nonempty and delay finite/nonnegative. The ref, timers
and listeners are cleaned up with the owner or trigger replacement.

Tooltips cannot contain actions; use Popover for interactive content. Do not put
an action's only name or essential instructions in hover-only help. Touch users
must be able to complete the task without discovering a tooltip.

#### Action menus

Use `MenuButton` to offer a compact set of actions, not to select a persistent
field value. `DropdownMenu` exposes the separately anchored menu surface.

```tsx
<MenuButton icon="add" appearance="subtle" ariaLabel="Create definition" items={[
    {id: 'class', label: 'Class', onSelect: () => openClassEditor()},
    {id: 'type', label: 'Type', onSelect: () => openTypeEditor()},
    {id: 'save', label: 'Save', command: saveCommand},
]}/>
```

Items have stable unique `id`s and string `label`s, optional `icon`/`disabled`,
and exactly one `command` or synchronous `onSelect`. Separators use
`{kind: 'separator', id}`; labelled groups use `{kind: 'group', id, label, items}`.
`MenuButton` accepts `label` or a named `icon`, `appearance`, `disabled`, `id`,
and the normal Boolean value-control convention for open state. A labelled
trigger includes a dropdown indicator. Opening performs no asynchronous work.

`DropdownMenu` requires `label`, `anchor` and `items`, accepts the same open-state
convention, `id`, `initialFocus: 'first' | 'last'`, `onClose`, `onAction` and
`onActionError`. `onAction` is a synchronous notification, not awaited work.
It owns only menu content, not arbitrary form children or nested submenus.
Both controls support arrows, Home/End, typeahead, native Enter/Space activation,
Escape, Tab exit and outside dismissal. Disabled actions remain focusable for
discovery but cannot run. Closing precedes activation so an action may safely
open its own dialog or remove its trigger.

MenuButton retains busy/error presentation for commands invoked from that menu
after it closes, and accepts external `busy`/`error` for work owned by an associated form. These
inputs do not disable unrelated menu actions. `buttonRef`, `ariaDescribedBy`
and `title` compose stable triggers/help with Tooltip or an anchored Popover.
Each item presents only its own command. An independently composed DropdownMenu must
provide persistent outcome/error feedback in its owning view when it closes;
observe command errors and use `onActionError` for invocation/handler failures.
Do not pass async work as a synchronous `onSelect` handler. Use an explicit command.

| Component | Purpose | Key props and state |
| --- | --- | --- |
| `Button` | Native button with optional pressed and busy state | `label`, `type`, `disabled`, `pressed`, `busy`, `busyLabel`, `error`, `command`, `disableWhileRunning`, `onClick`; a command requires native `type="button"`; live: `disabled`, `pressed`, `busy`, `error` |
| `Toolbar` | Named action group | `label`, `orientation` |
| `Label` | Native label for rich or live text | `text`, `htmlFor`; live: `text` |
| `Textbox` | Labelled native input with validation | Existing value/native props (including `list`, `autoCapitalize`, `spellCheck`, `min`, `max`, and `step`) plus `changeCommand`, `disableWhileRunning`, `onInput`, `onChange`; live: availability, `busy`, and `error` |
| `Dropdown<T>` | Labelled native select | Existing option/value props plus `changeCommand`, `disableWhileRunning`, `onChange`; `readOnly` retains focusability and restores the selected value; options may be static or a readable emitter with loading/error feedback |
| `RadioButton` | Standalone native radio and label | Existing native state props plus `changeCommand`, `disableWhileRunning`, `onChange`; live: state, availability, `busy`, `error` |
| `RadioGroup<T>` | Named native-radio fieldset owning one value | Existing option/value props plus `changeCommand`, `disableWhileRunning`, `onChange`; options are ordinary render data |
| `Toggle<T>` | ARIA radio group rendered as toggle buttons | Existing option/value props plus `changeCommand`, `disableWhileRunning`, `onChange` |
| `Checkbox<T>` | Configurable keyboard-operable semantic state cycle, including ordinary boolean values | Existing symbol/value props plus `changeCommand`, `disableWhileRunning`, `onChange` |
| `TriCheckbox` | Neutral/prefer/deny `FilterMode` cycle | Same public props as `Checkbox`, except fixed symbols |
| `QuadCheckbox` | Neutral/prefer/require/deny `FilterMode` cycle | Same public props as `Checkbox`, except fixed symbols |
| `DatePicker` (experimental) | Native `<input type="date">` | `CivilDate` value props, `label`/`ariaLabel`, `name`, `autoComplete`, `disabled`, `required`, `readOnly`, `busy`, `error`, `min`/`max`/`step`, `inputRef`, input/change callbacks |
| `TimePicker` (experimental) | Native `<input type="time">` | `TimeString` value props, `label`/`ariaLabel`, `name`, `autoComplete`, `disabled`, `required`, `readOnly`, `busy`, `error`, `min`/`max`/`step`, `inputRef`, input/change callbacks |
| `DateTimePicker` (experimental) | Native `<input type="datetime-local">` | `LocalDateTime` value props, `label`/`ariaLabel`, `name`, `autoComplete`, `disabled`, `required`, `readOnly`, `busy`, `error`, `min`/`max`/`step`, `inputRef`, input/change callbacks |

`FilterMode` exports `neutral`, `prefer`, `require`, and `deny` semantic values.
Arrow keys move backward or forward through a multi-state checkbox; Space uses
the native forward cycle.

`busy` sets native/ARIA busy semantics immediately. Standard visual loading
treatment and `Button.busyLabel` appear after 150 ms, configured once with
`createCapillaryUiRuntime({busyDelayMs})`. Zero selects immediate presentation.
Brief work finishes without a loading flash; completion and errors have no visual
delay. Reduced motion uses delayed static feedback. Actual interaction guards
remain immediate. Input and choice busy state does not itself disable them.
`Button` guards activation while busy by default. Use `disableWhileRunning={false}`
only when the application deliberately supports repeat/replacement; explicit
`disabled` still wins. A busy action
keeps its normal button colors, border, and elevation with the working
texture layered on top. `ProgressBar` only paints that working texture when it
has a `valueEmitter` whose fetch state is `Loading`; this applies to both
determinate and indeterminate bars. A literal `value={null}` is simply an
unfilled indeterminate bar.
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
| `CapillaryUiApp` | Fixed `cap-app` application shell and theme-text boundary | `sizing`: `embedded`/viewport axes; `layout`: `horizontal`/`vertical`; `islands`: inherited surface spacing; `landmark`: `main`/`none`; content or overridden `renderContent()` |
| `Header` | Styled native heading surface | `level` (1–6), `headingId`, content |
| `GroupBox` | Labelled group; defaults to a bordered vertical-header group and may be a section or column | required `header`, direct content arranged vertically (`section` arranges direct content horizontally); optional `variant`: `section` or `column` |
| `OptionGroup` | Labelled native fieldset for related controls | `label`/`ariaLabel`, `OptionGroupHeaderEnd` and ordinary content children, `disabled`, `required`, `busy`, `error`; state props are live. Use for related direct checkboxes or multiple distinct controls. |
| `OptionsBox` | GroupBox specialization arranging compact choice groups | required `header`, direct `OptionGroup` and/or `RadioGroup` content |
| `Layout` | Presentation-only arrangement of arbitrary children | exactly one of `horizontal`/`vertical`; `allocation`, `scroll`, inherited `islands` spacing, optional accessible-region configuration |
| `Panel` | Optional labelled, themed region composed over a Layout body | `header`, `horizontal`/`vertical`, `allocation`, `scroll`, `disabled`; `PanelToolbar` and ordinary content children; live: `disabled` |
| `Sidebar` | Labelled complementary region with fixed header/toolbar and scrolling content | `header`, `ariaLabel`; `SidebarToolbar` and ordinary content children |
| `SplitView` | Resizable two-pane layout | required `SplitPrimary` and `SplitSecondary` Layout panes; `horizontal`/`vertical`, `allocation`, initial/minimum sizes, separator label, `onResize`, live `collapsed`, `collapseFocusRef` |
| `Drawer` | Inline nonmodal edge region | required `label`; Boolean value-control state, logical `edge`, CSS `size`, `mountPolicy`, `scroll`, `closeLabel`, initial/return focus refs, `onClose` |
| `PanZoomViewport` | Bounded, scrollable coordinate plane | `label`, worldWidth/worldHeight; controlled camera/onCameraChange or defaultCamera; limits/steps, height, disabled, panEnabled, canStartPan, interactionKey, fitRequest, direct PanZoomToolbar child, viewportRef, ariaDescribedBy, onResize |

`Layout scroll` supplies a default `tabIndex={0}` so keyboard users can reach
and scroll read-only content, including a scrolling Panel body. An explicit
`tabIndex` overrides that default. A non-scrolling Layout has no default tab stop;
removing scrolling clears the generated focus entry, not an explicit override.
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

Set `collapsed="primary"`, `collapsed="secondary"`, or null to control pane
visibility; `collapsed={live(pane)}` is supported. Keep passing the expanded
primary size: the framework retains its resize override and fills the remaining
pane while collapsed. Do not fake collapse with zero sizes or selectors targeting
pane internals. Hidden content stays mounted; remove app children explicitly if
hidden work should stop. Collapse hides the separator from layout/tab order and
cancels an active resize. If focus was inside the hidden pane or separator,
`collapseFocusRef.current` is focused, falling back to the split host. Unrelated
focus is not moved. The app supplies named show/hide controls and breakpoints.

`Drawer` is an inline nonmodal named region, not a dialog or overlay. Put it in
a flex layout whose axis matches its logical edge; start edges precede ordinary
siblings and end edges follow them. It supports `inline-start`, `inline-end`
(default), `block-start`, `block-end` and CSS `size` (default `20rem`).

```tsx
<Drawer label="Changes" edge="block-end" size="12rem"
    valueEmitter={changesOpen} mountPolicy="active-only">
    <ChangeReview />
</Drawer>
```

Boolean value-control conventions apply; call `close()` or use the named close
icon/Escape inside the drawer. `closeLabel` overrides runtime `drawerCloseLabel`.
Nested controls can consume Escape first. `onClose` notifies once per close
transition. There is no focus trap or default autofocus. An optional object
`initialFocusRef` requests focus inside on opening. Closing/unmounting restores
focus only if it was inside (or its own close icon was activated), to
`returnFocusRef.current` or the element focused
when opened. Supply an explicit return ref for pointer openers that do not take
focus on the user's browser/platform.
Use a Dialog for modality and a Popover for an anchored interactive popup.

`mountPolicy` shares the existing `ContentMountPolicy`: eager (default) mounts
immediately, lazy retains after first open, and active-only disposes content on
close. Choose explicitly when hidden content may own queries or buffered input.
The body scrolls by default; `scroll={false}` delegates scrolling to its content.
Drawer owns neither persistence nor responsive policy; provide a narrow-screen
alternative in the application. Optional `id` names the region's DOM target.

`PanZoomViewport` hosts arbitrary application-rendered world content; it is not
a graph editor. Supply finite nonnegative `worldWidth`/`worldHeight` and a named
viewport. Children use world coordinates within the bounded plane. The framework
owns the scaled scroll range, not nodes, edges, layout algorithms or selection.

```tsx
<PanZoomViewport label="Diagram viewport" worldWidth={world.width} worldHeight={world.height}
    camera={view.camera} onCameraChange={camera => updateView({camera})}
    interactionKey={sourceRevision}>
    <DiagramObjects />
</PanZoomViewport>
```

A camera is `{x, y, zoom}`: x/y are native CSS-pixel scroll offsets, not world
translation. With `camera`, accept `onCameraChange` synchronously into app state;
without a callback a supplied camera is read-only. Without `camera`, the control
owns state initialized by `defaultCamera` (default `{x: 0, y: 0, zoom: 1}`).
`onCameraChange` may observe owned-state changes too. Native scroll quantization
is reconciled into accepted state. No camera persistence or async waiting is
inferred. Runtime `panZoom*` messages supply control names and visible help.

Named icon controls provide zoom, reset, fit and a pan menu. Defaults are zoom
0.25–2 in 0.25 steps, 80-pixel pan steps, and a 32rem viewport height. Limits,
`zoomStep`, `panStep` and CSS `height` are configurable. Zoom preserves the visible
center (or a method's explicit inner-viewport anchor), subject to world bounds.
Fit uses 30px padding and caps enlargement at 1 (or the minimum allowed zoom).
Reset restores defaultCamera. A direct `PanZoomToolbar` child adds app actions
such as Fit selection, outside the scaled world. Toolbar content uses this named
region, not a toolbar prop; duplicate/foreign regions are rejected.

Use `fitRequest={{key, bounds: {x, y, width, height}}}` to request application
bounds once per key. A hidden/zero-sized viewport defers fitting until visible;
ordinary resize clamps offsets but does not replay an old fit. `viewportRef`
provides a stable native-element ref; `onResize` reports client dimensions.
`zoomTo`, `panBy`, `fit`, `reset`, `clientToWorld` and `worldToClient` are also
available on a directly owned component instance. `id` and `ariaDescribedBy`
support external association; built-in visible instructions are retained.

Mouse/pen background dragging uses the owner-scoped pointer helper. Native wheel
and touch scrolling remain native. Focus the viewport for arrow pan (+ Shift
for larger steps), +/− zoom or 0 reset; child editing and browser modifier keys
are not intercepted. World coordinates remain left-to-right in RTL applications,
while content text keeps the surrounding direction. Focusable/interactive
children and `data-cap-pan-exclude` are excluded from background gestures;
`canStartPan` supports app-owned hit policy. `panEnabled={false}` disables only
background dragging; `disabled` freezes camera interaction. Change
`interactionKey` or the controlled camera to cancel obsolete gestures without
restoring stale state. Hidden cameras are retained; destruction releases drag,
resize, ref and emitter resources without writing back an old camera.

Pure `panZoomClampCamera`, `panZoomZoomAt`, `panZoomFitCamera`,
`panZoomClientToWorld` and `panZoomWorldToClient` support independent geometry.
Conversion origins are the viewport's client-space inner corner (rect plus
border); fit/zoom results can be passed through clamp with world/viewport sizes.

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
| `ListView<T>` | Keyed single- or multi-select ARIA listbox | Existing item/selection props plus `selectionCommand`, `disableWhileRunning` |
| `TreeItem<T>` | Declarative tree-node marker | `id`, `label`, `textValue`, `value`, nested `TreeItem` children |
| `TreeView<T>` | Keyed single-select ARIA tree | Existing node/selection props plus `selectionCommand`, `disableWhileRunning`, `onSelect` |
| `FilterPanel` | Semantic filter-control fieldset | `options`, `filters`, `filterModes`, `defaultSemanticState`, `label`, `onChange` |
| `TableHeaderCell` | Sort/filter header-cell control | column key/label plus sort/filter state callbacks |
| `TableHeader` | Header row over public column definitions | `columns`, sort/filter emitters and callbacks |
| `DataTable<T>` | Accessible local, caller-query, or REST-backed table | Existing data/filter/selection props plus `selectionCommand`, `disableWhileRunning` |

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
keeps those rows in place, marks the collection busy, and displays a thin
animated translucent working texture, avoiding flicker during sort and filter
refinements.
Application renderers never receive dummy values, and refreshes preserve valid
keyed selections and expansions. Error snapshots retain any available rows,
add an error edge and overlay detail icon, and stop the loading animation. A
`DataTable` data source with `retry` also renders its localized retry action.

Advanced compositions may use `BaseSelectionHandler`,
`SingleSelectionHandler`, `MultiSelectionHandler`, and
`createSelectionHandler` directly. Ordinary applications should prefer the
selection behavior already owned by `ListView` and `DataTable`.

`TreeView` owns keyboard navigation, expansion, typeahead, and selection. Use
`itemLabelClassName` and `itemLabelStyle` when only the label beside the
expander needs a reusable presentation trait such as `colored`.

Collections accept live `busy` for their own data and live `selectionBusy` for
required results of the selected items. Selection commands present pending work
on selected rows/nodes automatically. Detail loading does not mark the entire
collection busy. Independent reactions keep their own pending/error state.
Table query loading marks only the initiating sort/filter header; synchronous
local sort/filter does not show busy on its controls. Tabs track selected-tab
work; routed tabs and RouteLink also track their own router transition.
This presentation does not disable selection or infer asynchronous subscribers.

Advanced direct `TableHeader` compositions identify their pending criterion with
`busyInteraction={{field: 'name', kind: 'sort'}}` (or `kind: 'filter'`) alongside
`busy`. `DataTable` supplies this attribution automatically for its own query.

#### DataTable inputs and ownership

`DataTable` requires exactly one data mode. Static arrays and column renderers
can be replaced together with `setProps`; switching data-source ownership requires
a new table instance:

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
| `Popover` | Anchored native nonmodal top-layer panel | required `label`, `anchor: HTMLElement \| null`, `valueEmitter`/`defaultValue`, `id`, `initialFocusRef`, `onClose`, ordinary content children |
| `Tooltip` | Noninteractive supplemental text | required `text`, `trigger({ariaDescribedBy, triggerRef})`; optional `id`, `delayMs` (350 ms); trigger keeps its own name and focus |
| `Icon` | Decorative current-color intent glyph | required `name: IconName`; compose with an accessible control, not as a standalone named action |
| `ProgressBar` | Labelled native progress with visual track | required `label`, `value` or `valueEmitter`, `max`, `valueText`; fills its available width; `null` is indeterminate; emitter-backed busy chrome (including determinate bars) requires `FetchState.Loading` |
| `ThemePicker` | Select and await a Capillary UI theme link | value props, `options`, `label`/`ariaLabel`, live `disabled`/`readOnly`/`busy`/`error`, `targetDocument`, `onChange` |
| `ColorPicker` | Select and replace a Capillary UI color link | same contract as `ThemePicker` |

Use `Button icon="add" ariaLabel="Add item" appearance="subtle"` for a compact
contextual action. Icon-only buttons require `ariaLabel`, which also supplies the
default native title hint; icons remain decorative and visible while busy. Supported
`IconName` values are `add`, `remove`, `close`, `delete`, `grip`, `pan`, `zoom-in`,
`zoom-out`, `fit`, `reset`, `refresh`, `undo`, `redo`, `pin`, `connect`, `download`,
`play`, `pause`, `first`, `previous`, `next`, `up`, `down`, `last`.

Popover positions beside its connected anchor, flips/clamps inside the viewport
and scrolls oversized content. Escape restores focus; outside dismissal preserves
the outside control's focus. It is not modal and requires the native Popover API.
The opener owns its name and `aria-expanded`/`aria-controls` relationship;
Button supplies native `ariaExpanded`, `ariaControls` and `ariaHasPopup` props. Keep
the panel inside the application's theme boundary even though it paints in the
top layer. Use Dialog for modal confirmation.

Theme/color selection updates synchronously, but its working texture persists
until native stylesheet load or failure. Failure offers a compact retry; localize
`stylesheetLoadError` and `stylesheetRetryLabel` as needed. A changed URL replaces
the managed link element so stale resource events cannot settle newer work.

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

The three chrome backgrounds (`--ui-primary-bg-color`, `--ui-medium-bg-color`,
and `--ui-dark-bg-color`) alias muted primary surface tones derived from the
palette's primary anchor and light endpoint. Ice blue retains the exact legacy
colors `#f5f7f8`, `#ebeff3`, and `#d7dee3`; other palettes recolor these surfaces.
See the [palette contract](colors/README.md#muted-primary-surfaces) for the
relative-HSL/sRGB calibration, including the `0`–`1`
`--palette-primary-surface-saturation` palette control and override points.

Theme files provide intentional overrides. Custom properties are the primary
instrument and belong on `:root` inside `@layer theme`, with `color-scheme` as
the only ordinary property in that block. A theme may also write ordinary CSS
rules when no variable expresses the intended difference, but those rules must
be placed after the `@layer theme` block: component CSS is injected as an
unlayered `<style>` element prepended to `<head>`, so unlayered theme rules win
by document order while layered ones would always lose.

The built-in theme options are Capillary, Shiny, Soft, White, and Minimal.
Capillary is a bright, compact card treatment with restrained elevation and
palette-primary selections. Minimal is adaptive; the other options are fixed
light treatments.

`capillaryUiThemeVariableCatalog` describes the supported palette and semantic
variable hierarchy. `findCapillaryUiStylesheetOption`, `replaceCapillaryUiStylesheet`,
`setCapillaryUiAppearance`, and `getCapillaryUiAppearance` support application-controlled
runtime selection.

### Line-control sizing

All single-line controls reserve the same vertical row space: Textbox,
Dropdown (including theme/color pickers), Toggle, Button, checkbox variants,
RadioButton, date/time controls, and ProgressBar. Their existing painted
bodies remain centered within that row; small checkbox/radio shapes do not
grow to look like text fields.

`--control-min-height: 2em` sets the body minimum (24px at the default 12px
`--ui-font-size`). The row uses the greater of that minimum and
`--control-row-min-height` (default `0px`), plus
`--control-row-padding-block: .25em` on each side. Default rows are therefore
30px with 3px above and below the body. Capillary supplies a `2.75em` row
floor (39px including padding) to accommodate its roomier chrome and native
temporal inputs while retaining its `6px 5px` control padding. Additional
layout `gap` is optional and adds to this built-in breathing room.

These are minimum sizes: multiline/rich content can grow without clipping.
Labels and native controls inherit the font family and share a unitless
1.2 authored text line height. Native single-line inputs may clamp the used
line-height to platform font metrics (notably Firefox on Linux); their bodies
and text remain centered. Larger content can increase the minimum-sized body.
Textbox and Dropdown retain their `--input-width: 15em` default and existing
minimum-width/shrinking behavior. Field and button inline padding is 5px;
toggle segments use 6px. General `--space-xs`/`--space-sm` no longer determine
these line controls' padding.

`OptionsBox` deliberately keeps compact descendants, including through nested
`OptionGroup` and `Layout` wrappers: it removes the shared row floor and
block padding while retaining each control's natural body size. Its checkbox
and radio rows are normally 1.2em, or the theme's larger painted-shell size.
OptionsBox owns a fixed 2px vertical option rhythm—between nested groups,
checkboxes, and radio options—regardless of theme. Ordinary GroupBox and
Toolbar do not opt into compact spacing. RadioGroup elsewhere adds no
inter-option gap by default, so the same number of radio and checkbox rows
occupies the same height (excluding any group legend). Set
`--radio-group-gap` to add spacing explicitly outside OptionsBox.

An `OptionGroup` and a labelled `RadioGroup` both produce a native
`fieldset`/`legend`. For one mutually exclusive choice, put the `RadioGroup`
directly in an `OptionsBox` and give it the one visible label. Use an
`OptionGroup` for a collection of direct checkboxes (or when its legend adds a
separate, meaningful concept around several controls). Do not wrap a single
labelled `RadioGroup` in an `OptionGroup` merely for layout; that creates
redundant legends and nested fieldsets.

Maintained themes add chrome without text offsets. Shadows do not participate
in centering. Toggle borders and selected overlap are painted independently
of segment layout, so selection does not move text.

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
`cap-size-flexible`, `cap-scroll`, and `cap-island-layout`. These traits are intentionally
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

### Composing islands without margin doubling

Enable `islands` once on the app or the Layout that contains the composition:

```tsx
<CapillaryUiApp sizing="viewport" islands>
    <Header island>Application header</Header>
    <Layout horizontal allocation="flexible">
        <Sidebar island header="Navigation">...</Sidebar>
        <Layout vertical allocation="flexible">
            <Panel island header="Overview">...</Panel>
            <Panel island header="Results" allocation="flexible">...</Panel>
        </Layout>
    </Layout>
    <footer className="island cap-size-natural">Status</footer>
</CapillaryUiApp>
```

`islands` is a **layout mode**; `island` still marks each **surface**. The
outermost enabled container gets one perimeter inset. Participating layouts
then place a single shared gutter between their children, with no island
margins to add up. Nested Layouts inherit the mode automatically, including
through ordinary wrappers and `RouteOutlet`. Repeating `islands` on an already
enabled nested Layout does not add another inset. An app with `islands` and no
explicit `layout` defaults to vertical; Layout still requires an axis.

The public `CapillaryUiIslandLayoutProps` contract is static `islands?: boolean`:

- `true` enables managed composition;
- omitted or `undefined` inherits the surrounding mode;
- `false` stops inheritance and restores legacy spacing in that subtree.

Surface boundaries stop managed layout gaps from reaching controls inside
them. Panel padding, toolbar gaps, and other internal spacing keep their own
contracts. A later explicit enabled scope below an opt-out starts a fresh
perimeter inset. Neither this mode nor nested layouts permit nested islands.

Use `--island-gap` for gutters and `--island-inset` for the outer inset. Base
defaults both to `1rem`; White uses zero. Override these on the composition,
and optionally `--island-gap` on a nested Layout for a local gutter.
`--island-padding` remains the padding **inside** each surface, except a direct
app-root header: `cap-app > header.island` and `cap-app > cap-header.island`
have zero padding. These shell headers delegate internal spacing to their
navbar, toolbar, and branding rows. Their border, shadow, outer inset, and
gutter remain unchanged. Nested headers and non-island headings are unaffected;
this rule also applies outside managed island mode. Use a native `<header
className="island">` for a shell containing navigation/toolbars; `Header`
remains the component for a native heading.

`SplitView`
inherits the mode and places its separator in one shared gutter; a zero gutter
retains an overlapping drag target and keyboard resizing.

Scrolling layouts automatically include surrounding gutter space in their
scrollport, so an island's border and shadow can paint there. Equal padding
and negative margin extend the clip by half a gutter without moving the
surfaces or increasing their separation. Nested scrollports reuse this space;
RouteOutlet and SplitView leave clipping to their content/panes. Themes only
declare their ordinary borders and shadows: no clearance token is required.
Surface contents and opt-outs retain ordinary scrolling behavior. A zero
gutter deliberately leaves no paint space between adjacent surfaces.

Native markup can use `cap-island-layout` and `cap-island-layout-off`. Combine
them with a direction trait, or with your own `display: grid` rules. A wrapper
around one region needs no new trait. A native wrapper arranging multiple
regions must opt into a layout: inheritance does not turn arbitrary elements
into flex/grid containers. Axes, dimensions, responsive wrapping, allocation,
and scroll ownership remain explicit application choices.

Migration is opt-in. Existing layouts outside managed scopes keep
`--island-margin` and their former behavior. When enabling a scope, remove
margin-cancellation selectors and redundant gap rules, and move any intended
spacing override to `--island-gap`/`--island-inset` on the layout. A direct CSS
`margin` or `gap` override still wins through the normal cascade; the framework
does not measure or rewrite application styles. `islands={false}` can isolate
a legacy region during incremental migration.

### Semantic category color

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
- [Workbench recipes](docs/workbench-composition-guide.md) — compose editing, menus, contextual feedback, panes and direct manipulation.
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
