# Fray changelog

All notable changes to `@sylwellsoftware/fray` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic
Versioning.

## Unreleased

### Added

- Added external destinations to `NavigationBar`: an item whose `to` is
  `{kind: 'external', href}` renders a plain anchor the router never
  intercepts, preserving native link behavior for cross-application and
  cross-origin navigation without requiring a router in the runtime.
- Added the `Breadcrumb` navigation component: an ordered path of ancestor
  router-aware links ending in an `aria-current="page"` current item, with
  optional per-item `onClick` actions and accessible `nav`/`ol` semantics.
- Added the presentation-only `Layout` component with mutually exclusive
  `horizontal`/`vertical` modifiers, named parent allocation, and explicit
  scrolling. `Panel` now composes Layout as its body.
- Made `SplitView` a resizable two-pane control with required SplitPrimary and
  SplitSecondary Layout panes, a focusable separator, pointer dragging,
  orientation-appropriate keyboard resizing, minimum sizes, and `onResize`.
- Expanded the application composition guide with a decision rule for Layout,
  Panel, and SplitView; guidance to prefer intentional layout boundaries over
  anonymous layout wrappers; and updated allocation examples.

- Added `DeclarativeRegion` and `readDeclarativeRegions()` for defining
  parent-specific, non-visual named content regions with duplicate, foreign,
  required-region, and ordinary-content validation.
- Added `PanelToolbar`, `SidebarToolbar`, `SplitPrimary`, `SplitSecondary`,
  `DialogActions`, and `OptionGroupHeaderEnd` declarative region markers.

- Added a packaged application composition guide covering workflow-led screen
  design, persistent shells, state lifetime, layout and scrolling contracts,
  content composition, and component reuse, alongside the repository layout guide.

- Added bounded layout allocation traits: `fray-layout-horizontal`,
  `fray-layout-vertical`, `fray-size-natural`, `fray-size-flexible`, and
  `fray-scroll`. `FrayApp` accepts root `layout`; `Header`, `NavigationBar`,
  `Panel`, `Sidebar`, and `Toolbar` accept explicit host `allocation`.

- **Experimental:** `DatePicker`, `TimePicker`, and `DateTimePicker` components,
  plus `CivilDate` and `TimeString` utility types and helpers. These are exported
  from the package root and tagged `@experimental`; they may change in any
  release until they stabilize and are not yet covered by the 1.x semver
  guarantee.
- `InfoPanel` and `InfoField` components for presenting key-value summary
  information in a bordered panel with an optional title. `InfoPanel` renders
  panel chrome (background, border, shadow) with a `Header` when a `title` is
  provided, and a native `<dl>` grid of `InfoField` children. `InfoField` renders
  a native `dt`/`dd` pair with `label` and `value` props.

### Fixed

- `ListView` now re-renders when its plain-array `items` prop changes. A static
  `items` array was wrapped in an internal emitter only once at construction and
  never synced on `setProps`, so a parent re-render with new items left the list
  showing stale (or empty) content. `setProps` now syncs the owned items emitter,
  matching `TreeView`'s `nodes` contract.

- Sized input controls (`Textbox`, `SelectControl`, `DatePicker`) no longer clip
  invisibly inside narrow containers. Each now caps its field at the container
  width (`max-width: 100%`), shrinks to a usable floor via the new optional
  `--input-min-width` variable (default `6rem`), and lets its host shrink. A
  `Sidebar` toolbar region (`fray-toolbarcontent`) now scrolls horizontally
  (`overflow-x: auto`) when content sits below its floor, matching the existing
  `fray-content` scroll contract — so a control in a resizable pane shrinks,
  then scrolls, rather than being cut off.

- The dropdown trigger glyph now defaults to a universally supported Unicode
  character (U+25BE) in `base.css` instead of `none`, so all themes render the
  `::before` pseudo-element glyph without a per-theme override. The previous
  Shiny-only value used U+23F7, which is absent from Helvetica and common
  sans-serif fonts and did not display in Chrome.

### Changed

- Panel content now emits a `fray-layout` host instead of `fray-content`.
  SplitView panes are visible Layout components rather than non-visual region
  markers; the previous `orientation`, `direction`, and parent-level pane-label
  props remain migration aliases.

- `Panel`, `Sidebar`, `SplitView`, `Dialog`, and `OptionGroup` now accept their
  secondary structural content through parent-specific region children rather
  than `FrayChild`-valued `toolbar`, `primary`, `secondary`, `actions`, and
  `headerEnd` props. The removed prop forms fail with migration guidance.

- Documented and enforced the theme contract as it actually works. Custom
  properties remain the primary instrument and must be declared on `:root`
  inside `@layer theme`, but a theme may also write ordinary CSS rules,
  including component-host, trait, part, ARIA-state, and pseudo-element
  selectors, when no variable expresses the intended difference. Such rules
  must sit outside `@layer theme`, since component CSS is injected as an
  unlayered `<style>` element prepended to `<head>` and would otherwise outrank
  them. The previous documentation restricted every theme except Shiny to
  variables only, which contradicted both the cascade design and the shipped
  Shiny theme.

- Component chrome text is now consistently non-selectable. `user-select: none`
  covers section `Header` titles, `OptionGroup`/`OptionsPanel` legends, native
  `select` shells (`Dropdown`, `TimePicker`, `ThemePicker`, `ColorPicker`),
  `Toolbar`, `Breadcrumb`, `NavigationBar`, `ProgressBar`, `InfoPanel`,
  `DescriptionList`, `FilterPanel`, `Dialog` titles, the `DatePicker` trigger
  and calendar popup, the `DateTimePicker` legend, and every Fray-rendered
  `label` element. The `DatePicker` text input explicitly keeps
  `user-select: text`. The generated `styles/structural.css` now also includes
  `Breadcrumb`, `Header`, `InfoPanel`, `OptionGroup`, `OptionsPanel`,
  `RadioGroup`, `DatePicker`, `DateTimePicker`, and `TimePicker`, which were
  missing from the stylesheet manifest.

## 1.3.1 - 2026-09-08

### Fixed

- Removed the fixed height from checkable controls so their layout follows the
  active line-height and supports wrapped label content.

- Published npm packages now include this changelog alongside their release
  history.

## 1.3.0 - 2026-09-08

### Added

- Added independent `--navigation-bar-*` and `--navigation-link-*` theme
  variables. Navigation now defaults to text-link presentation rather than
  inheriting generic button chrome.
- Added `NavigationBar`, a labelled native navigation list over `RouteLink`
  destinations, and `RouteOutlet`, an application-emitter-backed owner for
  non-tab literal routes with nested scope propagation.
- Added the shared `ContentMountPolicy` type. Outlets support eager,
  lazy-retained, and active-only branch lifetime and preselect a pending direct
  route before mounting content.
- Added `TabPanel.mountPolicy` with eager, lazy-retained, and active-only
  content lifecycles while preserving stable semantic tabpanel shells and the
  current eager default. Routed panels preselect a matching pending literal
  route before first content render, avoiding transient default-view mounts
  during direct nested restoration.

### Changed

- Shiny now presents `NavigationBar` as a light, text-link navigation strip
  beneath application chrome instead of a dark action-bar surface.

## 1.2.0 - 2026-09-08

### Added

- Added `OptionGroup`, a labelled `fieldset`/`legend` shell with a `headerEnd` slot for controls that need a standardized semantic grouping.
- Added `OptionsPanel`, extending `GroupPanel` with a flex-column content area and a configurable group gap, designed to contain `OptionGroup` children. `OptionsPanel` now styles nested `fieldset`/`legend` elements with flex-column stretch layout, bordered legends, and neutral palette text color.
- Added `FrayHostElementTagNameMap` and `FrayElementTagNameMap` types to register
  custom `fray-*` host elements as JSX intrinsic tags, enabling TSX-only
  authoring without explicit `h()` calls.
- Added `FrayApp` and `mountFrayApp()`. `FrayApp` provides a fixed block-level
  `fray-app` root, optional viewport-axis sizing, and a `main`/`none` landmark
  policy; the mount helper collects and injects its dependency CSS before the
  first commit.
- Adjusted font-styling in general to be more sensible
- Improved base css of CategoryHidepanel for more compact layout

### Changed

- Refined `GroupPanel` layout from a rigid grid to a flexible row so the
  vertical header and content adapt naturally to varying label lengths and
  content sizes. The header chrome is now self-contained, removing the need
  for per-heading-level style overrides.
- Tightened `OptionsPanel` and `OptionGroup` spacing for a more compact,
  form-like appearance that better suits dense control panels. The content
  area now stretches to fill available height, and fieldset legends sit
  closer to their controls with reduced gaps and padding.
- Gave `CheckableControl` a fixed row height so checkboxes and radios align
  consistently across different label and font configurations.
- Added a shared `border-radius` to the `.colored` trait so gradient
  surfaces round consistently with other bordered elements.

### Fixed

- `FrayApp` now applies the theme canvas, text color, font family, font size,
  and line height even when embedded. Existing viewport root traits now apply
  the published text color as well as typography.
- RadioGroup basic rendering adjusted

## 1.1.1 - 2026-09-07

### Changed

- Replaced legacy `h()`-first documentation with a comprehensive TSX-first
  guide covering every public component, reactive template form, data-source
  ownership rule, service/routing boundary, and styling contract.
- Restored the framework overview's design rationale for native browser
  semantics, meaningful HTML/CSS separation, and the complementary intent
  behind the Glue and Fray names.

## 1.1.0 - 2026-09-07

### Added

- Added `GroupPanel`, a labelled control-group surface with a bordered body
  and a full-height vertical `Header` using the normal section-header chrome.

### Changed

- Added a reusable `colored` presentation trait that paints explicit
  `--c1`/`--c2`/`--c3` triplets as a gradient and lets Shiny add shared depth
  through `--colored-shadow`. `TreeView` now accepts `itemLabelClassName` and
  `itemLabelStyle` callbacks so applications can decorate the block label next
  to an expander without painting the entire semantic tree row.
- Made `GroupPanel` headers narrower and corrected their box model, with a
  small content gap, right inset, and a minimal inset between the vertical
  header and the group border.
- Replaced Shiny's hard-coded blue section-header gradient stop with the
  existing primary palette anchor and derived its translucent highlight stops
  from the light palette endpoint.
- Reorganized the public Meridian style lab around a persistent Scope/View
  navigation rail and flat sibling-island layouts for Portfolio, Register,
  Change, and Analysis. Portfolio attention, Register criteria, and Analysis
  visibility now derive independently from shared application scope while the
  selected change remains durable across local filtering.

### Fixed

- Application roots using either `fray-fill-horizontal` or
  `fray-fill-vertical` now consume the published `--font-family`,
  `--font-size`, and `--line-height` tokens, preventing inherited controls and
  native content from falling back to the browser's serif defaults.

## 1.0.0 - 2026-09-06

### Added

- Independent `fray-fill-horizontal` and `fray-fill-vertical` application-root
  modifiers with axis-specific sizing/overflow behavior and a white
  `--application-background` canvas. Applications combine both modifiers for
  fullscreen behavior; runtime mounting itself remains sizing-neutral.
- An explicit common `island` component modifier and catalogued
  `--island-*` surface variables, allowing themes to elevate only deliberate
  application surfaces instead of inferring boundaries from component nesting.
- `data-fray` renderer ownership markers on every Fray-created element, fixed
  one-hyphen `fray-<stem>` component hosts, a variable-only base stylesheet,
  and the `setFrayAppearance()`/`getFrayAppearance()` document appearance API.
- Base-to-derived component CSS collection, including dependencies declared at
  every class level, for meaningful component styling inheritance.
- Explicit component-specific `live()` prop allowlists, enforced consistently
  by typed JSX/`h()` authoring and the runtime renderer.
- `Label` component with a live `text` prop for accessible form field labeling.
- `Header` component with a native `h1`–`h6` level and source-owned Section
  Header treatment.

### Changed

- Regenerated structural CSS to match the fixed component host names.
- Palette ramps can independently mix their primary, secondary, or neutral
  light and dark sides toward palette-selected hue endpoints.
- Normal applications register their root component and inject only reachable
  component CSS. Base owns semantic defaults and palette derivation; named
  colors and themes are independent variable-only files with no base import.
- The public style lab has returned to a native zero-component baseline for
  strict component-at-a-time CSS review.
- Interactive controls now expose consistent live availability and validation
  contracts: `Textbox`/`Dropdown` accept live disabled, required, and error
  state; checkboxes, radio controls, and toggles accept live disabled, required,
  and error state; standalone radios also accept live checked state.
- `RadioGroup.options` remains an ordinary array supplied through explicit owner
  renders, and raw `valueEmitter` behavior is unchanged.
- Enabled strict TypeScript compiler checking.
- Restarted the public component treatments for Button, the Checkbox family,
  DescriptionList/DescriptionItem, Dialog, Dropdown, FilterPanel, Header,
  ListView, Panel, Placeholder, ProgressBar, RadioGroup/RadioButton, Sidebar,
  SplitView, the DataTable/TableHeader family, TabLine/TabPanel, Textbox,
  Toggle, and Toolbar around fixed light-DOM parts, native/ARIA state
  selectors, and reachable component-local CSS. ProgressBar preserves native
  progress semantics while presenting its label through the legacy-compatible
  clipped completed surface.
- Rebuilt the public style lab as the reactive Meridian Change Office workflow
  so approved component CSS is exercised through application-owned scope,
  filtering, selection, routing, and retained-screen state.
- Restarted TreeView around a native tree list, fixed expander/label parts,
  semantic selection and expansion selectors, and declarative TreeItem updates;
  the style lab now uses that hierarchy alongside live theme and colour pickers.

### Removed

- Configurable Fray component host prefixes and overrides, plus the obsolete
  top-level `themes/light.css` and `themes/dark.css` compatibility bundles.
- The named `baseStyles` recipe registry and its public types; shared component
  CSS now follows meaningful class inheritance.

### Fixed

- Island sizing reacts to the application root's opted-in viewport axes with
  corresponding bounds and overflow, and component ancestry rejects islands
  nested within other islands.
- Toggle and TabLine native buttons now honor configured UI text scaling;
  Toggle's default selected surface also preserves AA text contrast, and the
  Sidebar browser contract follows its fixed light-DOM content part.
- `SplitView` panes are keyboard-focusable so their owned overflow remains
  operable without a pointing device.
- `Panel` now composes `Header`, uses trait classes for content orientation, and
  owns only its surface, content layout, and live disabled presentation.
- `Sidebar` now has a fixed `fray-sidebar` CSS host while retaining its native
  complementary `aside` region.
- `SplitView` now uses class-owned direction and pane hooks, a simple two-pane
  flex layout, and its existing native/ARIA pane semantics.
- FilterPanel retains its component-relative Bank2 anchor without a deferred
  viewport offset that caused the panel to flicker out of view.
- Multi-state Checkbox variants synchronize the native checked property after
  every semantic transition.

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
