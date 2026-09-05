# Fray Visualization changelog

All notable changes to `@sylwellsoftware/fray-visualization` are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and Semantic Versioning.

## Unreleased

### Changed

- `LineGraph` accepts static values as well as readable sources for shapes,
  stacked, smooth, and range inputs.
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
