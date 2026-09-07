# Fray Visualization changelog

All notable changes to `@sylwellsoftware/fray-visualization` are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and Semantic Versioning.

## Unreleased

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
