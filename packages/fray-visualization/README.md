# Fray Visualization

`@sylwellsoftware/fray-visualization` provides domain-neutral analytical models
and accessible Fray components: stable-key categories, category visibility,
ordered recursive splits, proportional block diagrams, civil-date history
series, and responsive charts.

The package is ESM-only and currently follows 0.x compatibility rules. Install
it with its Glue and Fray peers:

```bash
pnpm add @sylwellsoftware/glue @sylwellsoftware/fray \
  @sylwellsoftware/fray-visualization
```

Import Fray's normal presentation files and either collect component styles or
load the complete visualization structural asset:

```ts
import '@sylwellsoftware/fray/themes/base.css'
import '@sylwellsoftware/fray/styles/structural.css'
import '@sylwellsoftware/fray-visualization/styles/structural.css'
import '@sylwellsoftware/fray/colors/iceblue/colors.css'
import '@sylwellsoftware/fray/themes/minimal/theme.css'
```

With dependency collection, declare `BlockGraph`, `CategoryHidePanel`,
`SplitSelectionPanel`, or `LineGraph` in the owning component's
`static dependencies` instead.

## Ownership model

Applications supply items, stable keys, domain predicates, labels, semantic
colors, split presets, and dates. This package coordinates those declarations
and presents them; it does not fetch, persist, or infer domain policy.

Models and derived emitters are caller-owned. Dispose them at the composition
boundary that created them. Components observe passed models but never dispose
them.

```text
application items and domain declarations
                 │
                 ▼
GroupingCriterion / SplitSelectionModel / BlockSelectionModel / SeriesBuilder
                 │ caller-owned emitters and models
                 ▼
CategoryHidePanel / SplitSelectionPanel / BlockGraph / LineGraph
```

## Categories and visibility

A `Category<T>` has a stable `key`, visible `label`, predicate, and ordered
`[dark, base, light]` CSS colors. Optional `hiddenByDefault` applies only the
first time that key appears.

Use `staticCriterion()` for a fixed category vocabulary:

```tsx
interface Finding {
    severity: 'critical' | 'high' | 'medium'
    projectId: string
    detected: CivilDate
    resolved?: CivilDate
}

const severity = staticCriterion<Finding>({
    key: 'severity',
    label: 'Severity',
    categories: [
        {
            key: 'critical',
            label: 'Critical',
            predicate: (finding) => finding.severity === 'critical',
            colors: ['#6b0000', '#c62828', '#ffcdd2'],
        },
        {
            key: 'high',
            label: 'High',
            predicate: (finding) => finding.severity === 'high',
            colors: ['#8a3b00', '#ef6c00', '#ffe0b2'],
        },
        {
            key: 'medium',
            label: 'Medium',
            predicate: (finding) => finding.severity === 'medium',
            colors: ['#725400', '#f9a825', '#fff9c4'],
        },
    ],
})
```

Use `derivedCriterion()` when categories come from current item values. It
extracts one or more keys per item, drops empty categories, sorts populated
categories deterministically, and preserves hidden state when a key disappears
and later returns:

```tsx
const projects = derivedCriterion({
    key: 'project',
    label: 'Project',
    source$: findings,
    extractKeys: (finding: Finding) => finding.projectId,
    describe: (projectId) => ({
        label: projectId,
        colors: ['#263238', '#607d8b', '#cfd8dc'],
    }),
})
```

`GroupingCriterion` exposes:

- `categories$`, `hidden$`, and `visibleCategories$`;
- `visibility(categoryKey)` for a writable `'hidden' | 'visible'` adapter;
- `setAllVisible()` and `pruneHidden()` commands;
- `allowResorting`, used by recursive block layout;
- `dispose()`.

`deriveCategories()` is the pure dynamic-category calculation.
`filterByHidden(items$, criteria)` creates a blacklist-style derived item
collection, and `categoryCounts(items$, criterion)` reports unfiltered live
counts. The caller owns and disposes both derived emitters.

## Ordered splits and block selection

`createSplitSelection(criteria, options)` returns a `SplitSelectionModel`.
Its `order$` contains every criterion, while `activeSplits$` contains the
currently enabled subset in recursive split order. Optional presets name exact
active/inactive arrangements.

```tsx
const splits = createSplitSelection(
    [severity, projects],
    {
        active: ['severity', 'project'],
        presets: [
            {key: 'severity-first', label: 'Severity first', active: ['severity', 'project']},
            {key: 'project-only', label: 'Project only', active: ['project'], inactive: ['severity']},
        ],
    },
)

const blocks = createBlockSelection(findings, splits.activeSplits$, {
    rootLabel: 'All findings',
    readabilityThreshold: 0.02,
})
```

The split model exposes `activeState()`, `isActive()`, `toggle()`, `move()`,
`moveBy()`, `setSplits()`, `applyPreset()`, and `dispose()`.

`BlockSelectionModel` owns a reactive strict-partition layout and rebuild-safe
selection:

- `layout$` contains the root block, child blocks, and partition issues;
- `selectedPath$` is the stable criterion/category path;
- `selectedBlock$` re-resolves that path after every rebuild;
- `selectedItems$` exposes the selected subset;
- `select()`, `clear()`, and `dispose()` manage selection and lifetime.

Every active criterion must assign every item under each parent to exactly one
category. Zero matches and multiple matches make the layout invalid and are
reported as `BlockPartitionIssue` entries; the model does not silently guess.

For non-reactive use, `buildBlockLayout()` performs the pure calculation,
`criterionSnapshot()` converts a criterion to a split snapshot, and
`findBlock()` resolves a path.

## Component reference

### CategoryHidePanel

`CategoryHidePanel<T>` renders collapsible criterion groups, per-category
visibility checkboxes, color swatches, and counts against the unfiltered item
source.

| Prop | Meaning |
| --- | --- |
| `items$` | Required readable source used for live counts |
| `criteria` | Required criterion list |
| `label` | GroupPanel heading; defaults to “Show or hide categories” |
| `description` | Introductory help text |
| `initiallyOpen` | Initial disclosure policy per criterion |

The outer surface inherits Fray's `GroupPanel` contract: a labelled group with
a vertical chromed header. Criterion summaries remain horizontal disclosure
headers above their options.

### SplitSelectionPanel

`SplitSelectionPanel<T>` enables criteria, applies presets, and changes their
recursive order.

| Prop | Meaning |
| --- | --- |
| `model` | Required caller-owned `SplitSelectionModel` |
| `label` | GroupPanel heading |
| `description` | Introductory help text |

Pointer dragging reorders entries. From a drag handle,
`Alt+ArrowUp`/`Alt+ArrowDown` provides the keyboard equivalent and announces
the new position. Preset buttons expose their active state with
`aria-pressed`.

### BlockGraph

`BlockGraph<T>` renders a nested proportional mosaic from a
`BlockSelectionModel`.

| Prop | Meaning |
| --- | --- |
| `model` | Required caller-owned block selection model |
| `label` | Accessible graph name and visible heading |
| `description` | Visible explanation of the area encoding |
| `emptyMessage` | Message for an empty valid layout |

The graph exposes an ARIA tree, keyboard selection, a current-path readout,
clear-selection action, loading/error states, and explicit partition
diagnostics. Each block applies Fray's `colored` trait using the category's
`--c1`, `--c2`, and `--c3` values. Nested mosaics are inset by
`--viz-block-graph-child-inset` (default `1.6em`) so parent surfaces remain
visible. Labels overlay their surfaces and keep criterion and category on one
line without distorting area ratios. Hover emphasis targets only the deepest
block under the pointer.

### LineGraph

`LineGraph` renders responsive SVG history as individual lines or stacked
areas.

| Prop | Meaning |
| --- | --- |
| `shapes$` | Static `HistoryShape[]` or readable source |
| `stacked$` | Static boolean or readable source |
| `smooth$` | Static boolean or readable source |
| `range$` | Static or readable `{minX?, maxX?, minY?}` |
| `label`, `emptyMessage` | Accessible heading and empty state |
| `formatDate`, `formatValue` | Optional readout formatters |

Pointer movement updates the readout. Arrow keys move by one day, Shift+Arrow
by one week, Home/End jump to the range bounds, and Escape clears a pinned
cursor. Readable inputs propagate loading/error state; static values are
wrapped in component-owned ready sources.

## Civil dates and history series

`CivilDate` is a strict `YYYY-MM-DD` string interpreted with UTC-day arithmetic,
so calculations do not move across daylight-saving boundaries. The date module
exports validation/day conversion, comparison, addition, and current-date
helpers.

`SeriesBuilder` converts dated category deltas into ordinary or cumulative
`HistoryShape` arrays:

```ts
const history = new SeriesBuilder(severity.categories$.get())
for (const finding of currentFindings) {
    history.addOne(finding.detected, finding.severity)
    if (finding.resolved != null) history.removeOne(finding.resolved, finding.severity)
}

const cumulativeShapes = history.buildCumulative()
```

An ordinary series reports date deltas. A cumulative series carries values
forward and includes a pre-range anchor when earlier activity affects the
visible period.

For custom renderers, `buildLineChartModel()` computes normalized chart data
without a DOM. `linePath()`, `areaPath()`, `valueAtDate()`, and
`buildIntegerTicks()` expose the same pure calculations used by `LineGraph`.

## Complete export groups

| Module area | Public exports |
| --- | --- |
| Grouping | `Category`, `CategoryColors`, `GroupingCriterion`, `staticCriterion`, `derivedCriterion`, `deriveCategories`, `filterByHidden`, `categoryCounts`, `categoryColorVariables`, `setsEqual` and related option/state types |
| Splits | `SplitSelectionModel`, `SplitPreset`, `createSplitSelection` |
| Blocks | `BlockSelectionModel`, `createBlockSelection`, `buildBlockLayout`, `criterionSnapshot`, `findBlock` and block path/layout/issue types |
| History | `SeriesBuilder`, `HistoryShape`, `SeriesCategory` |
| Dates | `CivilDate`, `civilDateToDay`, `dayToCivilDate`, `addCivilDays`, `todayCivilDate`, `compareCivilDates` |
| Charts | `buildLineChartModel`, `linePath`, `areaPath`, `valueAtDate`, `buildIntegerTicks` and chart model types |
| Components | `CategoryHidePanel`, `SplitSelectionPanel`, `BlockGraph`, `LineGraph` and their props |

## Styling and accessibility

Visualization components use fixed Fray hosts:
`fray-categoryhidepanel`, `fray-splitselectionpanel`, `fray-blockgraph`, and
`fray-linegraph`. Structural CSS remains owned by component classes. Themes
provide values, not component selectors.

Category triples populate both the established `--c1`/`--c2`/`--c3` inputs
and the descriptive `--colored-dark`/`--colored-base`/`--colored-light`
aliases. Fray's base trait supplies the gradient; themes may add treatment such
as Shiny's shared colored shadow. Series use the base color for paths and
legend swatches.

The components expose names, statuses, keyboard equivalents, and forced-color
fallbacks, but applications remain responsible for meaningful domain labels,
contrast in supplied category colors, and manual assistive-technology review.

See the [Fray guide](../fray/README.md), the repository
[API surface](../../docs/API_SURFACE.md), and this package's
[release history](CHANGELOG.md).
