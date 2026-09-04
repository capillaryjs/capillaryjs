# Fray changelog

All notable changes to `@sylwellsoftware/fray` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic
Versioning.

## Unreleased

### Added

- Explicit component-specific `live()` prop allowlists, enforced consistently
  by typed JSX/`h()` authoring and the runtime renderer.

### Changed

- Interactive controls now expose consistent live availability and validation
  contracts: `Textbox`/`Dropdown` accept live disabled, required, and error
  state; checkboxes, radio controls, and toggles accept live disabled, required,
  and error state; standalone radios also accept live checked state.
- `RadioGroup.options` remains an ordinary array supplied through explicit owner
  renders, and raw `valueEmitter` behavior is unchanged.

## 0.7.0 - 2026-09-04

### Added

- Contextually discovered hierarchical browser routing with immutable literal
  and dynamic route descriptors, ordered cancellable resolvers, canonical
  fallback, and structured transition/issue state.
- History/path, hash, and memory navigation adapters plus native `RouteLink`,
  `RouteValue`, `RouteQuery`, and route-aware `TabPanel` integration.

### Changed

- `FrayRuntime` can carry a caller-owned router, and routed component children
  inherit their mounted route lineage without changing Glue or unrouted
  component behavior.

## 0.6.0 - 2026-09-04

### Added

- Prefix-free public theme traits for complete and split custom-component
  treatments, including data-component and colored visualization surfaces.
- Primary, secondary, and neutral 50–950 palette ramps with documented
  light/default/dark aliases and contrast endpoints.

### Changed

- Themes now target native elements, traits, and native/ARIA state inside
  `@scope`; component and part diagnostics are no longer presentation hooks.
- Color files expose palette language only. Themes map that palette to button,
  input, panel, status, selection, and visualization roles.
- Theme/color root attributes and public custom properties are prefix-free;
  see the semantic-markup and theming migration guidance.

## 0.5.0 - 2026-09-03

### Changed

- Two-state checkboxes with custom semantic values expose the second value as
  the checked state, so native checkbox interactions remain correct for
  bindings such as `visible`/`hidden`.

## 0.4.0 - 2026-09-03

### Added

- Typed service keys, immutable providers, lazy application scopes, and
  declared class-component service access through `FrayRuntime`.

### Changed

- Application services are registered at the composition root and inherited by
  nested class components without service prop-drilling.

## 0.3.0 - 2026-09-03

### Added

- Stable list, tree, table, dialog, filter, selection, and placeholder exports.
- Versioned semantic filter-state composition and persistence helpers.
- Read-only keyed tree-node projections and immutable writable-root updates.
- Explicit local, caller-query, handler, and REST table data-source adapters.

### Changed

- `FilterMode` values are `neutral`, `prefer`, `require`, and `deny`.
- Generic filter dimensions reject denied matches, require every required value,
  accept any preferred value when preferences are active, and ignore neutral
  values.
- Single-select lists and tables use item-or-null emitters; array emitters
  require explicit multi-selection.
- `DataTable` uses one of `data`, `dataSource`, or `rest` instead of legacy
  query/REST props.

## 0.2.0 - 2026-09-03

### Added

- Generated theme-neutral structural CSS, replaceable treatment bundles, color
  palettes, and theme/color picker components.

### Changed

- Components consume semantic styling variables rather than embedded theme
  colors, and published package checks validate CSS subpaths.
- Fray's Glue peer range follows the compatible Glue `0.2.x` line.

## 0.1.0-alpha.1 - 2026-09-02

### Added

- Initial public packaging with strict TypeScript declarations, ESM JSX
  runtimes, accessible controls, supported themes, and initial data APIs.

### Changed

- Glue is Fray's external peer dependency.
