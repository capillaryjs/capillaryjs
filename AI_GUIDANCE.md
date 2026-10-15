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
forms for implementation convenience, or omit busy feedback from async work.
Inspect existing primitives and examples before inventing private replacements.
Keep application policy, presentation and reactive/async ownership separate.

Use the same human-facing review checklist as any other developer. Keep
AI-specific process language out of primary package documentation and examples.
