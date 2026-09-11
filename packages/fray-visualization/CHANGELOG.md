# Fray Visualization changelog

All notable changes to `@sylwellsoftware/fray-visualization` are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and Semantic Versioning.

## Unreleased

### Changed

- `CollapsibleOptionGroup` now consumes `OptionGroupHeaderEnd` declarative
  region children, matching Fray's parent-specific content-region contract.

## 0.11.1 - 2026-09-08

### Fixed

- Corrected category and split-selection panel layout so their option content
  can size and flex correctly.

- Published npm packages now include this changelog alongside their release
  history.

## 0.11.0 - 2026-09-08

### Added

- `CollapsibleOptionGroup` component extending `OptionGroup` with an
  expand/collapse toggle button in the legend, supporting an optional
  `collapsed` prop to start collapsed.

### Changed

- `CategoryHidePanel` now uses `CollapsibleOptionGroup` instead of `OptionGroup`
  for each criterion, giving each criterion group an expand/collapse toggle.

## 0.10.0 - 2026-09-08

### Changed

- `SplitSelectionPanel` now extends `Component` instead of `GroupPanel` and
  renders two inner `GroupPanel` children — one for split presets and one for
  the ordered enablement list — matching the two-panel layout shown in the
  style lab. The `presetsLabel` prop customizes the presets panel header.
  Preset buttons are now stacked vertically (full-width, stretched) instead of
  flex-wrapped. The default `description` is now empty. The host element no
  longer carries `role="group"`; each inner `GroupPanel` provides its own
  labeled group semantics.
- `CategoryHidePanel` now extends `OptionsPanel` instead of `GroupPanel` and
  renders each criterion as an `OptionGroup` with a `headerEnd` visible-count
  slot, replacing the previous `details`/`summary` disclosure structure.
- Replaced all explicit `h()` calls in `BlockGraph`, `CategoryHidePanel`,
  `LineGraph`, and `SplitSelectionPanel` with equivalent TSX syntax, using the
  new `FrayHostElementTagNameMap` intrinsic element types from Fray.
- Reduced the criterion-group gap in `CategoryHidePanel` from `1.5em` to
  `1em` for a denser, more compact panel layout.

## 0.9.1 - 2026-09-07

### Changed

- Expanded the package guide to document every public model, component,
  calculation helper, ownership rule, keyboard interaction, and styling seam.
- Restored the framework overview's explanation of how the optional
  visualization layer fits the direct Glue-to-Fray application model.

## 0.9.0 - 2026-09-07

### Changed

- Every `BlockGraph` block now opts into Fray's reusable `colored` trait. Its
  model-supplied `--c1`/`--c2`/`--c3` triplet drives the shared gradient, and
  the existing BlockGraph shadow token delegates to the shared colored shadow.
  The former block pseudo-element overlay was removed so it cannot cover that
  shadow. Block labels now keep the criterion and category value on one line
  without imposing a minimum height, and hover emphasis applies only to the
  deepest block beneath the pointer rather than its ancestor blocks.
- Tightened `SplitSelectionPanel` rows and drag handles while giving each row
  the shared button background treatment.
- `CategoryHidePanel` and `SplitSelectionPanel` now share Fray's `GroupPanel`
  structure: a bordered control group with a normal chromed Header presented
  vertically at the left. Category criterion summaries remain horizontal.

## 0.8.0 - 2026-09-06

### Changed

- Regenerated structural CSS against Fray's fixed one-hyphen component-host
  contract.
- `CategoryHidePanel`, `SplitSelectionPanel`, `BlockGraph`, and `LineGraph`
  now render fixed Fray hosts and owned custom parts. Obsolete trait classes,
  structural `data-*` selectors, and redundant visualization diagnostics were
  removed; native/ARIA state and private SVG classes now drive presentation.
- `BlockGraph` composes Fray's `Button` for its clear action and always renders
  a flat model-supplied `c2` category color; it bakes every category's
  `c1`/`c2`/`c3` triplet and inline base paint into its blocks. Fray themes may
  add ornamental block chrome through explicit BlockGraph tokens. Category
  color triples map in their declared dark, base, light order;
  CategoryHidePanel shows the matching muted-on-hidden gradient swatch. Nested
  child mosaics retain a configurable inset that exposes their parent layer,
  while overlaid labels consume no proportional layout area.
- `LineGraph` accepts static values as well as readable sources for shapes,
  stacked, smooth, and range inputs.
- `CategoryHidePanel` retains its natural height inside flex-column owners,
  clips each disclosure to its own bounds, and targets the fixed
  `fray-checkbox` host so open category groups cannot paint over following
  controls under compact Shiny sizing.
- Enabled strict TypeScript compiler checking.

## 0.7.0 - 2026-09-04

- No public visualization API changes; version synchronized with the framework
  release.

## 0.6.0 - 2026-09-04

### Changed

- Visualization surfaces participate in the prefix-free Fray theme/color trait
  migration.

## 0.5.0 - 2026-09-03

### Added

- Initial package with reactive static/dynamic grouping criteria, blacklist
  filters, explicit split/block selection models, accessible controls, and
  deterministic cleanup.
- Strict proportional `BlockGraph` layouts that surface unmatched and
  multiple-match diagnostics.
- Civil-date `SeriesBuilder` and responsive `LineGraph` line/stacked-area
  rendering with pointer and keyboard readout.
