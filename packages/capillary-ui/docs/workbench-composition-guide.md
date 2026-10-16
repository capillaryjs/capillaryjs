# Workbench interaction recipes

Compose an explorer, workspace and inspector around the user's task, not around
a generic editor schema. Applications own selection meaning, buffered values,
validation, source/history, permissions and persistence. Capillary UI supplies
presentation and browser interaction; Capillary supplies reactive/async state.

These recipes extend the [composition guide](application-composition-guide.md)
and [interaction rules](interaction-design-guide.md). Component contracts and
imports are in the [reference](../README.md#component-reference). Names such as
Navigator, Workspace and Review below stand for application components.

## Arrange persistent regions deliberately

Keep the complete interface inside the intended CapillaryUiApp typography/theme
boundary, including account bars and contextual surfaces. Choose one main
landmark. Carry bounded allocation from the root to each scroll owner; a themed
surface, component boundary and scroll container are different decisions.

```tsx
<Layout vertical allocation="flexible">
    <SplitView horizontal allocation="flexible" primarySize={explorerWidth}
        collapsed={explorerHidden ? 'primary' : null}
        collapseFocusRef={explorerToggle} onResize={rememberExplorerWidth}>
        <SplitPrimary label="Explorer"><Navigator /></SplitPrimary>
        <SplitSecondary scroll={false}><Workspace /></SplitSecondary>
    </SplitView>
    <Drawer label="Changes" edge="block-end" size="12rem"
        valueEmitter={reviewOpen} mountPolicy="active-only" scroll={false}
        returnFocusRef={reviewToggle}>
        <Review />
    </Drawer>
</Layout>
```

Here the explorer pane owns its scrolling; Workspace and Review explicitly own
theirs. A workspace can compose another SplitView for its inspector. Keep the
expanded width while collapsed; do not set it to zero or hide framework pane
internals with application selectors. Hidden split content stays mounted.

The app chooses breakpoints and which region to prioritize. Measure a component's
available space where useful; keep DOM measurements out of domain/view services.
At narrow widths, a named explorer dialog or a deliberate inspector-only mode
can be clearer than squeezing three panes. Keep local input in an owner whose
lifetime matches that promise and provide a visible route back. Test keyboard
order and focus after a focused pane closes, not just the desktop screenshot.

Choose Drawer mount policy explicitly. Active-only avoids hidden analysis or
queries; lazy retains visited DOM/input; eager starts immediately. Destroying a
view does not dispose app-owned work elsewhere. A drawer is nonmodal and does
not trap focus; use Dialog for modality and Popover for anchored forms.

## Keep editing buffered and revision-aware

Own one edit buffer with a captured target/revision. FormField and FormLayout
associate and align controls; they do not create a second model or validate
business rules. TextArea handles ordinary multiline strings, and ComboBox keeps
accepted selection separate from its search text.

```tsx
<Form label="Edit details" submitCommand={applyDraft}
    submitArguments={() => captureValidatedDraft()}>
    <FormLayout>
        <FormField controlId="edit-title" label="Title" required
            control={field => <Textbox {...field} valueEmitter={draft.title} />} />
        <FormField controlId="edit-description" label="Description"
            control={field => <TextArea {...field} valueEmitter={draft.description} rows={3} />} />
        <FormField controlId="edit-type" label="Type" help="Choose a known type"
            control={field => <ComboBox {...field} valueEmitter={draft.type}
                options={knownTypes} />} />
    </FormLayout>
    <Button type="submit">Apply</Button>
    <Button onClick={cancelDraft}>Cancel</Button>
</Form>
```

applyDraft is an app-owned AsyncCommand. Sample and validate the buffer against
the captured revision before committing; do not read a moving target halfway
through an awaited operation. Native validity remains useful, but it is not a
substitute for transaction/permission checks. The submit button reuses Form's
command without a second click invocation. Form's repeat guard does not disable
editable fields or Cancel automatically; any additional lock is app policy.

Keep local input after validation, conflict or required-result failure. If the
captured source changes, mark the buffer stale, disable unsafe Apply, and offer
an explicit reload/review/cancel path. Cancel discards only unapplied input, not
already accepted source. Restore focus to a connected opener or meaningful region.

A synchronous preview or opening a review dialog is already complete. It may
use a native form and synchronous handler; do not manufacture an AsyncCommand
to make every form look identical. Confirmed async work still needs an explicit
owner and scoped feedback. Keep an exact source editor's BOM/newline projection,
selection mapping and history in the application; TextArea is not a source codec.

Use nullable ComboBox state for clearing. If a model buffer stores strings,
adapt null to its explicit empty/removal representation with a writable
projection. Do not cast a string emitter to nullable and write null into it.
Local options/derivations need no busy state. A caller-owned LiveQuery may supply
options; search, debounce and transport policy remain outside the control.

## Preserve outcomes when contextual surfaces close

Use MenuButton for commands, Dropdown/ComboBox for values and Popover for
interactive forms. Keep popup state separate from the edit buffer: dismissing
the surface need not discard input or cancel accepted work.

```tsx
<MenuButton label="Edit" buttonRef={editTrigger}
    busy={live(applyDraft.isRunning)} error={applyError}
    items={[{id: 'details', label: 'Edit details', onSelect: openDetails}]} />
<Popover label="Details" anchor={editTrigger.current} valueEmitter={detailsOpen}>
    <DetailsForm />
</Popover>
```

Use a stable trigger ref rather than querying another component's private DOM.
Watch popup-open state in its owner so opening resolves the mounted anchor ref.
MenuButton retains outcomes of commands invoked by its items; external busy/
error inputs also carry work owned by a contextual form after it closes. Other
menu actions remain available unless explicitly disabled. Standalone menus and
custom surfaces need the same persistent outcome boundary. Keep held input
discoverable with a named Resume/Discard path; do not silently replace it.

An unknown write outcome is not a failed write. Keep its receipt/context and
offer inspection or reconciliation, not blind resubmission. If persistence is
confirmed but an independent refresh fails, report those outcomes separately.
Scope busy to required work at its origin/results; do not aggregate subscribers
or decorate siblings for synchronous local updates. Standard visual feedback
already has the shared delay; guards, errors and ARIA remain immediate.

Tooltip adds supplemental text to an independently named trigger. Compose its
description id/ref, merge existing help ids, and suppress duplicate native
title hints. It dismisses on activation and never contains actions. Essential
instructions and touch paths remain visible.

## Keep manipulation direct

Render object names as content with the owning widget's selection/focus model.
Keep a recognizable grip available; it is not a separate Move button. Use
createPointerDrag for capture/threshold/preview/commit/cancel mechanics. The app
captures context, validates revision/permission at commit, and cancels stale
gestures. Keep preview separate from accepted source and provide keyboard moves.

A named +/connect button can offer both dragging and an anchored chooser. The
click/keyboard alternative must complete the same task without dragging. Keep
connection details near the originating port, with Escape, target feedback and
focus restoration. Do not replace this with an unrelated panel above the canvas.

PanZoomViewport owns the coordinate plane, camera mechanics and native scrolling.
Supply app-rendered objects and world bounds; use a direct PanZoomToolbar child
for application actions such as Fit selection. Camera/history persistence,
node/edge geometry and source edits stay in the app. Use keyed fit requests for
hidden content rather than measuring zero dimensions and guessing a later delay.
Preserve child editing and native wheel/touch/browser interactions.

## Use disclosures for content, menus for commands

Native details/summary is useful for optional explanations, source metadata,
legends or genuinely advanced settings. Its contents remain ordinary document/
form controls with their own operation owners. A row of routine commands is not
advanced content merely because a disclosure was easy to implement: use a menu
or discoverable toolbar instead. Familiar toolbar actions can use named icons;
menu labels remain descriptive for reading, keyboard navigation and typeahead.

Review the complete task through create/edit/cancel, stale input, pending/error,
popup dismissal, pane collapse, camera changes, keyboard, touch alternatives,
narrow widths and enlarged text. Verify actual scroll ranges, focus and cleanup.
Do not let implementation convenience silently replace a more intuitive model.
