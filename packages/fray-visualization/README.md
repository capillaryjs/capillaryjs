# Fray Visualization

`@sylwellsoftware/fray-visualization` provides reactive analytical controls,
strictly partitioned block mosaics, and history charts for Fray applications.
It is domain-neutral: applications supply items, predicates, stable keys,
labels, and semantic colors.

The package is ESM-only and targets modern evergreen browsers. Its `0.x` API
may change with documented migration notes. Install it with its peers:

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray \
  @sylwellsoftware/fray-visualization
```

Load Fray's variable base and an application-selected theme/color pair. Register
the application root so Fray and Visualization component CSS is collected from
declared dependencies:

```ts
import '@sylwellsoftware/fray/themes/base.css'
import '@sylwellsoftware/fray/themes/minimal/theme.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'

runtime.registerStyles(App).injectStyles(document)
```

## Grouping and filtering

A grouping criterion owns a reactive category collection and hidden-key set.
Keys are identity; labels are presentation. Static and dynamically derived
criteria therefore expose the same interface.

```ts
import {Emitter} from '@sylwellsoftware/glue'
import {
    CategoryHidePanel,
    createBlockSelection,
    createSplitSelection,
    filterByHidden,
    staticCriterion,
} from '@sylwellsoftware/fray-visualization'

const movies$ = new Emitter(movies)
const genre = staticCriterion({
    key: 'genre',
    label: 'Genre',
    categories: [
        {
            key: 'drama', label: 'Drama', colors: ['#225', '#88c', '#eef'],
            predicate: movie => movie.genre === 'drama',
        },
        {
            key: 'comedy', label: 'Comedy', colors: ['#252', '#8c8', '#efe'],
            predicate: movie => movie.genre === 'comedy',
        },
    ],
})
const visibleMovies$ = filterByHidden(movies$, [genre])
const splits = createSplitSelection([genre], {active: ['genre']})
const blocks = createBlockSelection(visibleMovies$, splits.activeSplits$)
```

`filterByHidden` is blacklist filtering: an item is removed when it matches any
hidden category. Overlapping predicates are valid for filtering. Block splits
are deliberately stricter—at each active level every item must match exactly
one category. Zero or multiple matches produce partition diagnostics instead
of a plausible but mathematically incorrect graph.

Dynamic criteria use application-owned key extraction, drop empty categories,
and preserve hidden state by key when categories disappear and return. A
category's `hiddenByDefault` setting is applied only the first time its key is
seen.

The state models are explicit and caller-owned. Dispose criteria, derived
emitters, split models, and block models at the same composition boundary that
created them. Components do not take ownership of passed models.

## Components

- `CategoryHidePanel` shows collapsible category controls and live counts from
  the unfiltered item source.
- `SplitSelectionPanel` enables, presets, and reorders the active split subset.
  It supports pointer dragging and `Alt+ArrowUp`/`Alt+ArrowDown`.
- `BlockGraph` renders a nested proportional mosaic. Selection is exposed by
  stable criterion/category path and selected-items emitters. Every block uses
  its model-supplied `c1`/`c2`/`c3` category triplet even without an ornamental
  theme; themes may add presentation such as Shiny's glossy chrome through
  BlockGraph tokens. Child mosaics are inset from their parent by
  `--viz-block-graph-child-inset` (default `1.6em`) so the parent surface
  remains visible around every nested layer. Block labels are positioned over
  their surfaces and do not reserve layout space, so area ratios continue to
  represent item-count ratios.
- `LineGraph` renders responsive SVG line or stacked-area history with pointer
  and keyboard readout.

Register those root components as ordinary Fray dependencies, or use the
prebuilt visualization structural stylesheet shown above.

## History data

`SeriesBuilder` converts dated add/remove events into ordinary or cumulative
`HistoryShape` series. Dates are strict civil `YYYY-MM-DD` values interpreted
with UTC-day arithmetic, so behavior is independent of the consumer's time
zone. A cumulative series includes a pre-range anchor when earlier activity
affects the visible range.

```ts
const history = new SeriesBuilder(severities)
for (const finding of findings) history.addOne(finding.detected, finding.severity)
const shapes = history.buildCumulative()
```

`LineGraph` accepts either static values or readable emitters for `shapes$`,
`stacked$`, `smooth$`, and `range$`. An emitter drives loading/error state and
incremental redraws; a static value is wrapped as an owned ready source. Arrow
keys move the readout by a day, Shift+Arrow by a week, Home/End jump to range
bounds, and Escape clears the pinned cursor.

## Styling boundary

Each component renders one fixed Fray host (`fray-categoryhidepanel`,
`fray-splitselectionpanel`, `fray-blockgraph`, or `fray-linegraph`). Structural
CSS is collected from those component classes and scoped to those hosts.
Component-owned non-native HTML parts use fixed `fray-*` elements; native and
ARIA state is the presentation hook for disclosure, checkbox, selection, and
focus state. SVG drawing parts use private classes because SVG cannot contain
HTML custom elements. No visualization selector is a theme hook.

Category color triples are ordered dark, base, light and feed
the legacy `--c1`, `--c2`, and `--c3` inputs directly into every BlockGraph
block, as well as `--colored-dark`, `--colored-base`, and `--colored-light`
aliases. Series colors use the base value for legend swatches and paths.
Missing block colors therefore default to the active theme's primary palette.
The base block surface is painted directly from each block's `c2` inline value,
so it remains colored even before structural CSS is available; themes may opt
into the catalogued border, radius, shadow, and glossy-overlay variables to add
ornament.
CategoryHidePanel renders the same small gradient swatch beside each category,
muted when that category is hidden. Layout still exposes narrow `--viz-*`
sizing and drawing inputs where no ordinary theme variable applies.
Forced-colors mode remains usable without relying on color alone.

See the package [changelog](CHANGELOG.md) for migration notes and release
history.
