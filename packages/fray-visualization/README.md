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

Load both structural stylesheets and an application-selected Fray theme/color
pair:

```ts
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray-visualization/styles/structural.css'
import '@sylwellsoftware/fray/themes/minimal/theme.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
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
            key: 'drama', label: 'Drama', colors: ['#eef', '#88c', '#225'],
            predicate: movie => movie.genre === 'drama',
        },
        {
            key: 'comedy', label: 'Comedy', colors: ['#efe', '#8c8', '#252'],
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
  stable criterion/category path and selected-items emitters.
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

`LineGraph` accepts reactive `shapes$`, `stacked$`, `smooth$`, and `range$`
inputs. Arrow keys move the readout by a day, Shift+Arrow by a week, Home/End
jump to range bounds, and Escape clears the pinned cursor.

## Styling boundary

The package keeps `data-fray-visualization` as a package-owned structural root
discriminator and diagnostic label. It lets component-local structural CSS
distinguish the four native `section` roots without an identity class, a custom
host wrapper, or a brittle descendant-shape selector. It is not a theme hook.
`data-part` remains only for chart geometry, scrolling, SVG drawing, and
interaction mechanics. Themes do not select either attribute. Visualization
roots opt into `datacomponentlike`; independently framed regions use
`datacomponentshell`; blocks and legend swatches use `coloredlike`, with block
labels using `coloredinner`.

Category and series colors feed `--colored-light`, `--colored-base`,
`--colored-dark`, and `--colored-contrast`. Missing block colors therefore
default to the active theme's primary palette. Layout still exposes narrow
`--viz-*` sizing and drawing inputs where no ordinary theme trait applies.
Forced-colors mode remains usable without relying on color alone.
