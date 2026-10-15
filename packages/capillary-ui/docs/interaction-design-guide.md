# Capillary UI interaction design guide

Choose the interaction model that makes the user's task easiest and most
intuitive. Prefer familiar, direct interactions and keep contextual controls
close to the objects they affect. Evaluate implementation constraints explicitly
rather than allowing them to dictate the user experience.

This guide complements the [application composition guide](application-composition-guide.md).
Applications own task meaning, validation and persistence; Capillary UI owns
presentation and browser lifecycle; Capillary owns reactive and async state.

## Apply the theme to the whole interface

Load the variable base, palette and theme, and mount the complete intended
interface inside `CapillaryUiApp`. It consumes the typography and canvas tokens;
importing the CSS variables alone does not style unrelated elements. Include
account bars, navigation, settings and dialogs, not just a central work area.

```tsx
import '@capillaryjs/capillary-ui/themes/base.css'
import '@capillaryjs/capillary-ui/colors/iceblue/colors.css'
import '@capillaryjs/capillary-ui/themes/minimal/theme.css'

// Application-owned components are registered in the root's dependencies.
<CapillaryUiApp sizing="embedded" landmark="none">
    <AccountBar />
    <Navigation />
    <main><Workspace /></main>
</CapillaryUiApp>
```

`sizing="embedded"` is sizing-neutral, not typography-neutral. Choose one main
landmark: use the default root landmark when it is the primary content, or
`landmark="none"` when an inner view or surrounding document supplies it.
Independently mounted views may still need their own root. Preserve intentional
monospace code and source text.

Structural CSS is a separate input. Use the root's transitive `dependencies`
and `mountCapillaryUiApp()` to collect it, or import `styles/structural.css`.
If a contextual surface is mounted elsewhere in the document, retain a theme
boundary around it; DOM inheritance does not cross unrelated mounting roots.
Do not repair a missing root with scattered application font declarations.

## Match semantics to the interaction

A click handler does not make an element a button. Use `Button` for action
intent, such as Save, Delete, opening a dialog or confirming a choice. Use
links for navigation and the appropriate widget semantics for selection,
expansion and manipulation. Do not wrap content in buttons merely to make it
clickable or focusable, or add `role="button"` to a drag grip.

| Interaction | Appropriate model | Avoid |
| --- | --- | --- |
| Select a tree node or expand its children | Tree item state, direct handlers and the tree's keyboard/focus model | A separate action button for every node label or expander |
| Select a row or diagram object | Collection/object selection with appropriate keyboard access | A button around every selectable label |
| Move or resize an object | Recognizable grip or handle with pointer and keyboard manipulation | A text Move button that must first be revealed by clicking the object's name |
| Open a table-header filter panel | A compact contextual button with an accessible name | Either ordinary large button chrome or a mouse-only icon |
| Open a dialog, save or delete | An action button | A clickable label with no action semantics |

Use the built-in `TreeView`, collection controls and native elements where
they express the task. Custom widget interactions need explicit keyboard,
focus and selected/expanded state, not just a pointer handler. Do not apply
the rule mechanically: a filter trigger can legitimately be a native button
without looking like an ordinary standalone button.

## Keep manipulation direct and contextual

For a diagram, expose a recognizable drag grip rather than a selection step
whose only purpose is to reveal a Move button. Keep names as content. A
connection port can support dragging to a target, with a visible preview and
valid-target feedback. Provide a click/keyboard alternative that does not
require dragging.

Place contextual choosers near their initiating control. Avoid a detached form
that appears above the canvas and shifts the user's working area. Keep the
surface usable during pan, zoom, scrolling and narrow layouts. Cancellation,
Escape, focus return and any additional required relationship details are part
of the interaction, not cleanup to add later.

Visibility alone is not the goal. Some controls appropriately appear in
context; judge whether the complete task is understandable and efficient.

## Prefer recognizable icons for familiar actions

Use a consistent icon vocabulary for unambiguous contextual actions such as
pan, zoom, fit, add, remove and delete. Keep text for complex or ambiguous
actions and dialog decisions. Distinguish removing something from a view from
deleting its underlying data.

Icon-only action buttons need an accessible name, contextual help, a usable
hit area and visible focus/disabled/active/busy states. Decorative icons should
not duplicate the accessible name. Tooltips supplement names; they do not
replace them. A grip is still a manipulation handle, not automatically an icon
button. Do not shorten an unclear action merely to remove its text.

For native widget markup, supply ARIA states as strings, for example
`aria-expanded={String(expanded)}`. ARIA values are not HTML boolean attributes.

## Show pending work for every asynchronous interaction

Every proper button must use the standard busy/loading mechanism. Prefer
`AsyncCommand` for asynchronous action buttons:

```tsx
<Button command={saveCommand} label="Save" busyLabel="Saving…" />
```

The application owns the command and returns the entire operation's promise
from its executor. Use `bindCommand()` when arguments must be sampled at
activation. `changeCommand` and `selectionCommand` provide the same lifecycle
at supported value-change and completed-selection boundaries. See the
[command reference](../README.md#commands-at-declared-interactions).

The same feedback requirement applies to dropdown changes, checkbox/toggle
changes, collection selection, lazy expansion and other interactions that
start work the user is waiting for. Show pending state at the initiating
control and in the affected results where useful. Do not substitute disabled
styling for a working indication. Icon-only actions are not exceptions.

`Button` guards activation while busy by default. Deliberately repeatable or
replaceable work can use `disableWhileRunning={false}` without losing its working
indication. Explicit `disabled` still wins; do not disable query inputs merely
because a previous request is pending.

Reactive queries remain queries, not mutation commands. A control does not
infer which downstream work its value starts. The application connects that
work's state explicitly, using a tracked snapshot and the control's `busy`
prop, for example:

```tsx
// In an application component's render(), results is the caller-owned query
// that reacts to category. snapshot() tracks loading/error-only changes too.
const result = this.snapshot(results)
return <Dropdown
    label="Category"
    valueEmitter={category}
    options={categories}
    busy={result.fetchState === FetchState.Loading}
/>
```

Read all relevant query snapshots before combining pending flags when several
results belong to one operation. Keep that relationship scoped: unrelated
polling must not lock an initiating control indefinitely. A result panel alone
is insufficient feedback for an action control that otherwise appears idle.

`onClick`, `onChange`, subscriptions and command success listeners do not
automatically await a returned promise. Do not discard an async result and
assume feedback will follow. Use the declared command integration or explicitly
present the lifecycle the application owns. A command settling does not mean
an independently triggered downstream query has settled.

Busy presentation does not universally imply disabled. Preserve the intended
concurrency, cancellation and replacement policy. An older completion must not
clear newer pending work; errors must have separate feedback. Synchronous
interactions need no artificial delay or spinner. Do not treat subscriber count
as evidence of asynchronous work or introduce ad hoc booleans for a lifecycle
already represented by a query or command.

## Review the whole task

- Does the complete shell inherit the intended typography, including contextual
  surfaces, while code retains its intentional font?
- Do actions, navigation, selection, expansion and manipulation have the right
  semantics and appropriate visual treatment?
- Can users perform the task directly, with contextual controls near its subject,
  using both pointer and keyboard?
- Are familiar actions recognizable without turning ambiguous decisions into
  unexplained icons?
- Does every async interaction show pending state for all work the user awaits,
  then settle correctly on success, failure, cancellation or replacement?
- Do narrow layouts, repeated input, focus return and component disposal retain
  the same contract?
