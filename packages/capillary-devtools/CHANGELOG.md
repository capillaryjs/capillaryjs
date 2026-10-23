# Capillary DevTools changelog

## Unreleased

## 1.4.0 - 2026-10-23

### Changed

- Align bundled control styling with Capillary UI's delayed visual busy marker,
  keeping immediate pending semantics separate from loading decoration.
- Present trace content as selectable lists, tree, table and canvas options,
  not action buttons. Use named icon buttons for capture and playback while
  preserving selection, keyboard navigation and diagnostic self-exclusion.

### Fixed

- Apply trace-node pointer selection on primary press as well as click, so a
  concurrent trace update cannot leave the inspector on the previous root.

## 1.3.0 - 2026-09-29

### Added

- Add opt-in interaction retention: `TraceRecorder({retainInteractionsWithoutDescendants:
  false})` evicts sterile interaction roots preferentially under the event/byte
  budgets, counts them separately as `capture.suppressedInteractions`, and reports
  them via `captureLimitations`. Ancestor walks are capped at 64 hops and
  truncations surface as `capture.walkDepthExceeded`. The default remains
  record-everything; the option is fixed at construction.

## 1.2.0 - 2026-09-19

### Added

- Distinguish flow graph node kinds with themeable accents and shape families,
  and expose each node's raw diagnostic kind as a `data-kind` styling hook.
- Show flow-edge states in the graph legend with representative arrow samples.

## 1.1.0 - 2026-09-18

### Changed

- Use flexbox for the inspector's single-axis stacks and root list, retaining
  grid for the responsive multi-column workbench layout.

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
