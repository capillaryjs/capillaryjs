# AI directed implementation guidance

This document is specifically for AI-assisted development. Normal application
authoring guidance is in the [Capillary UI interaction design guide](packages/capillary-ui/docs/interaction-design-guide.md).

First identify the most intuitive interaction for the user's task. If that
interaction is not readily supported or requires substantial complexity,
explain the gap, alternatives and user-facing trade-offs to the human. Consult
them before adopting a simpler-to-implement interaction that compromises
usability. Do not invent an approval requirement for routine implementation
choices within an already agreed design.

Do not turn every clickable element into a button, hide basic manipulation
behind an unexplained selection step, replace contextual panels with detached
forms for implementation convenience, or omit busy feedback from work the user
is waiting for.
Inspect existing primitives and examples before inventing private replacements.
Use the [workbench recipes](packages/capillary-ui/docs/workbench-composition-guide.md)
for menus/forms, buffered input, persistent outcomes, panes and manipulation.
Keep named content regions visible in TSX rather than hiding markup in props.
Keep application policy, presentation and reactive/async ownership separate.

Before wiring busy state, identify what completes the user's request: a required
operation outcome, accepted state followed by a required result, or an already
complete interaction with independent reactions. Classify each relationship;
one interaction may have both required and independent work. Never aggregate all
subscriber activity into the originating control. Keep independent failures
observable in their own query/command/connection owner, preserve accepted
selection on detail-load failure, and distinguish a successful write followed
by refresh failure from a failed or unknown write. Audit downstream handlers as
well as the initiating control; do not infer completion from subscriber count.

Scope pending presentation to the changed criterion, selected item and affected
results. Do not apply a shared query's loading flag to every sibling control.
Use collection `selectionBusy` for required detail work and `busy` for the
collection's own data. Refresh actions own their own command lifecycle. Keep
derivation from available data synchronous where appropriate. Use the framework's
shared visual delay and `Component.presentBusy()` for custom surfaces; do not
reimplement timers or suppress actual errors/activation guards for brief work.

Apply [progressive rendering and independent interaction](packages/capillary-ui/docs/interaction-design-guide.md#render-progressively-and-keep-independent-controls-usable)
from startup onward. Identify each control's real prerequisites before wiring
availability. Render known structure and controls early, with region/field
loading feedback; keep independent navigation, actions and editable input
usable. Optional discovery triggered by sign-in must keep its own lifecycle
rather than prolong a global authentication lock. Preserve input, focus and
valid prior content while loading, and cancel or fence obsolete responses by
their captured account/selection/revision.

Review runtime changes with individual initial/refresh requests deliberately
held pending. Exercise independent controls, Cancel and replacement selection,
then release responses out of order and fail an independent read. Verify that
loading remains local, failures offer local recovery, and newer input/context
cannot be overwritten. Use the shared feedback timing and reduced-motion
behavior; animation is optional.

Use the same human-facing review checklist as any other developer. Keep
AI-specific process language out of primary package documentation and examples.
