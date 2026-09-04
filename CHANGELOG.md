# Changelog

All notable changes to Glue, Fray, and Fray Visualization are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic
Versioning.

## Unreleased

## 0.6.0 - 2026-09-04

### Added

- Prefix-free public theme traits for complete and split custom-component
  treatments, including data-component and colored visualization surfaces.
- Primary, secondary, and neutral 50–950 palette ramps with documented
  light/default/dark aliases and contrast endpoints.

### Changed

- Themes now target native elements, traits, and native/ARIA state inside
  `@scope`; component and part diagnostics are no longer presentation hooks.
- Color files now expose palette language only. Themes map that palette to
  button, input, panel, status, selection, and visualization roles.
- Theme/color root attributes and public custom properties are prefix-free;
  see Change 005 migration guidance.

## 0.5.0 - 2026-09-03

### Added

- New `@sylwellsoftware/fray-visualization` package with reactive static and
  dynamic grouping criteria, blacklist filters, explicit split/block state,
  accessible controls, and deterministic cleanup.
- Strict proportional `BlockGraph` layouts whose categories form complete
  disjoint partitions, with surfaced unmatched/multiple-match diagnostics.
- Civil-date `SeriesBuilder` and responsive `LineGraph` line/stacked-area
  rendering with pure scale/path calculations and pointer/keyboard readout.
- Deterministic packing, isolated consumer, privacy, cross-browser private-demo,
  and dependency-ordered release integration for the third public package.

### Changed

- Fray two-state checkboxes with custom semantic values now expose the second
  value as the checked state, so native checkbox interactions remain correct
  for bindings such as `visible`/`hidden`.

## 0.4.0 - 2026-09-03

### Added

- Immutable `QueryEndpoint`, `RestEndpoint`, and `DerivedEndpoint`
  declarations with shared `LiveResult` contracts and caller-owned instances.
- Opt-in `LiveQuery` polling with reactive controls, overlap prevention,
  injectable scheduling, and deterministic cleanup.
- Optional `RestQueryHandler.parseResult` response validation after JSON
  parsing.
- Typed Fray service keys, immutable providers, lazy application scopes, and
  declared class-component service access through `FrayRuntime`.

### Changed

- `LiveQuery` now exposes explicit `abort()` without disposing the query.
- Application service classes can declare reusable remote and offline-filtered
  endpoints without a Glue registry, cache, or dependency-injection system.
- Command-triggered query reconciliation is documented as application-owned;
  refreshed query failures do not alter the settled command state.
- Application services are registered once at the composition root and become
  available to nested class components without service prop-drilling. Service
  instances are scope-shared while opened endpoint results remain caller-owned.

## 0.3.0 - 2026-09-03

### Added

- Stable Fray exports for list, tree, table, dialog, filter, selection, and
  placeholder workflows.
- Versioned semantic filter-state composition and persistence helpers.
- Read-only keyed tree-node projections and immutable writable-root updates.
- Explicit local, caller-query, handler, and REST table data-source adapters.

### Changed

- `FilterMode` values are now `neutral`, `prefer`, `require`, and `deny`;
  checkbox symbols and REST tokens remain separate presentation/transport data.
- Generic filter dimensions reject denied matches, require every required value,
  accept any preferred value when preferences are active, and ignore neutral
  values.
- Single-select lists and tables use item-or-null emitters; array emitters now
  require explicit multi-selection.
- DataTable replaces its `mode` and loose query/REST props with one of `data`,
  `dataSource`, or `rest`.

These changes require a Fray minor release. Migration guidance is in the Fray
package guide.

## 0.2.0 - 2026-09-03

### Added

- Generated theme-neutral Fray structural CSS and independently replaceable
  Shiny, Java, and Minimal treatment bundles.
- Eight independently replaceable Fray color palettes, a documented
  hierarchical CSS-variable catalog, and theme/color picker components.
- Package-level architecture and integration documentation reconstructed from
  the original Glue and Fray design discussions.

### Changed

- Fray components now consume semantic palette, family, variant, and
  component-level styling variables instead of embedding theme colors.
- Fray packaging and consumer checks now validate structural, theme, and color
  CSS subpaths as real external assets.
- Fray's published peer dependency now follows the compatible Glue `0.2.x`
  release line.

## 0.1.0-alpha.1 - 2026-09-02

### Added

- Initial public packaging for `@sylwellsoftware/glue` and
  `@sylwellsoftware/fray`.
- Strict TypeScript source and declarations, ESM package exports, JSX runtimes,
  accessible controls, supported light/dark themes, and initial data APIs.
- Generic caller-supplied scenario adapters for in-memory and Node HTTP tests.
- Standalone verification, deterministic tarball inspection, isolated consumer
  tests, privacy scanning, and checked Gradle orchestration.

### Changed

- Glue is an external Fray peer dependency.
- Package metadata now points exclusively to the public Sylwell Software
  repository and Apache-2.0 license.
