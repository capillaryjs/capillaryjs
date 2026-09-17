# Capillary DevTools changelog

## Unreleased

### Added

- Add opt-in bounded, immutable nested value snapshots and expandable value/input/
  error details, including cycle, accessor, failure, and truncation markers.
- Report render/update calls separately from event counts, show consumer triggers
  and own renderer DOM writes, and identify UI consumers even with downstream children.

### Fixed

- Replace absent lifecycle payloads with execution/effect summaries, show fetch
  state on graph nodes, and place selected-node details beside the inspector graph.

## 1.0.0

Initial release candidate; not yet published. Requires the companion Capillary
and Capillary UI diagnostics updates (1.2 or later).

### Added

- Bounded, immutable causal recordings with explicit lifecycle, safe previews,
  redaction, raw-reference warnings, JSON export, and capture-limit notices.
- Independent causal, chronological, flow, timeline, activity, details, and
  playback views, plus an optional composed inspector with structural CSS.
- Interaction-to-leaf inspection, convergence-preserving filters, known but
  unobserved downstream leaves, and query/command attempt dispositions.
- Non-executing step/scrub/timed playback and diagnostic-scope self-exclusion.
