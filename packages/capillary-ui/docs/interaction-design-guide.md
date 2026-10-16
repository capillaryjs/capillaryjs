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

## Decide what completes the interaction

Every asynchronous operation needs an owned lifecycle and appropriate error
handling. Show pending state at an initiating control for work that belongs to
completing the user's intended interaction. The existence of subscribers does
not establish that relationship; the application declares it.

Three common contracts need different presentation:

| Contract | Example | Completion and failure |
| --- | --- | --- |
| An operation with a required outcome | Save a draft to the backend | Keep the action busy until its required outcome is known. Report failure at the action and retain the input needed for recovery. |
| A state change whose purpose includes a result | Select a customer to view their details | Accept selection immediately and show pending feedback for the requested details at the selector and result panel. Keep selection available for replacement; a failed load belongs to the selected customer's details, not to the accepted selection itself. |
| A complete interaction with independent reactions | Select an item while another subscriber updates recent activity | Selection is complete when accepted. Each reaction owns its pending/error state; it does not keep the selector busy or reverse selection when it fails. |

Classify the relationship to each operation, rather than assigning a permanent
class to a control. One selection can start required detail loading and an
independent recent-activity update. Only the detail loading contributes to that
selection's pending presentation. Show a collection's own data loading even when
that refresh was started independently; this describes its data, not a failed
selection.

For result-driven selection, retain the selected item on load failure and offer
recovery in its result panel. Label retained older results or clear them when
they belong to a different item. An older request must not supply the result,
error or completion of a newer selection. Busy does not require disabling input.

Independent reactions still need error handling. Observe query/command error
snapshots, or a connection's `errors`/`onError`, and present failures where they
can be understood and recovered from. Use an inline error, notification or
diagnostic sink according to the reaction's meaning. Do not label a successful
selection or save as failed because an independent reaction failed.

Required outcomes can have distinct phases. If persistence succeeds but a view
refresh fails, report "Saved; refresh failed" and retry the refresh. Do not offer
a blind repeat of a write whose success is already known. A lost write response
may instead mean an unknown outcome, which needs inspection or the application's
idempotency/reconciliation policy before retry.

## Scope feedback to the work and allow brief operations to finish

Place loading feedback on the specific interaction and results that are waiting.
A selected tree node can be waiting for details while the tree's own data is
already complete. Use `selectionBusy` for required selected-item results on
TreeView, ListView and DataTable; use `busy` for collection data loading. Command
selection feedback follows the selected items automatically. Do not mark the
whole collection busy for a detail query. Keep selection available for replacement
where the task allows it.

A Refresh button shows its own refresh operation. A search/filter/sort control
shows work requested by that criterion, not every request sharing a result
query. For example, selecting a project must not mark an unchanged tree filter
or an idle Refresh action busy. Result loading does not imply that every
control above the result is working.

Synchronous filtering, sorting and other derivations from available data need
no busy lifecycle. Local worker operations can still take time, while cached
remote data may be immediate; transport location does not determine feedback.
Preserve actual pending/error state and let the framework suppress brief flashes.

Standard loading decoration and busy labels appear after 150 ms by default.
Configure `createCapillaryUiRuntime({busyDelayMs: 200})` once to choose another
delay, or use zero for immediate visual feedback. ARIA busy state and activation
guards apply immediately, and errors appear immediately. Completion removes
loading decoration immediately without extending the operation or forcing a
minimum display time. Reduced motion retains delayed static feedback.

Custom components use `this.presentBusy(pending)` during render and apply
`data-cap-busy-visible={visible ? '' : null}` with `className="cap-working"`
and immediate `aria-busy`. Named slots and an optional operation identity let
independent surfaces and replacement selections share the same component safely.
The component owns and disposes the timers; consumers need no delay logic.
Declare `StatusPresentation` in the custom component's static `dependencies`
when using the shared `cap-working` decoration.

## Present the declared asynchronous work

Use the standard busy/loading mechanism for asynchronous action buttons. Prefer
`AsyncCommand` for an operation with a required outcome:

```tsx
<Button command={saveCommand} label="Save" busyLabel="Saving…" />
```

The application owns the command and returns the work required by that command
from its executor. Independent success reactions keep their own lifecycles.
Use `bindCommand()` when arguments must be sampled at
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
results belong to one interaction. Exclude independent reactions and unrelated
polling. Required detail loading belongs to its selection; an independent
recent-activity update does not. A result panel alone is insufficient feedback
for an action control whose required operation is still running.

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
- Is each interaction's completion defined, with required work reflected at its
  origin and independent reactions owning their own loading and errors?
- Do failures distinguish an unsuccessful operation, unavailable requested
  results, an independent reaction failure and an unknown write outcome?
- Do narrow layouts, repeated input, focus return and component disposal retain
  the same contract?
