import {Emitter} from '@sylwellsoftware/glue'

import {
    BlockGraph,
    CategoryHidePanel,
    LineGraph,
    SeriesBuilder,
    SplitSelectionPanel,
    createBlockSelection,
    createSplitSelection,
    derivedCriterion,
    filterByHidden,
    staticCriterion,
} from '../src/index.js'

type Item = {id: number; kind: string; date: `${number}-${number}-${number}`}
const items$ = new Emitter<readonly Item[]>([{id: 1, kind: 'a', date: '2026-01-01'}])
const kind = staticCriterion<Item>({
    key: 'kind',
    label: 'Kind',
    categories: [{
        key: 'a',
        label: 'A',
        colors: ['#eef', '#88c', '#225'],
        predicate: item => item.kind === 'a',
    }],
})
const dynamic = derivedCriterion<Item>({
    key: 'dynamic-kind',
    label: 'Dynamic kind',
    source$: items$,
    extractKeys: item => item.kind,
    describe: key => ({label: key, colors: ['#efe', '#8c8', '#252']}),
})
const filtered$ = filterByHidden(items$, [kind])
const splits = createSplitSelection([kind], {active: ['kind']})
const selection = createBlockSelection(filtered$, splits.activeSplits$)

new CategoryHidePanel<Item>({items$, criteria: [kind, dynamic]})
new SplitSelectionPanel<Item>({model: splits})
new BlockGraph({model: selection})

const builder = new SeriesBuilder([{key: 'all', label: 'All', color: '#48c'}])
for (const item of items$.get()) builder.addOne(item.date, 'all')
new LineGraph({
    shapes$: new Emitter(builder.buildCumulative()),
    stacked$: new Emitter(false),
    smooth$: new Emitter(false),
    range$: new Emitter({minX: '2026-01-01', maxX: '2026-12-31'}),
})
new LineGraph({
    shapes$: builder.buildCumulative(),
    stacked$: false,
    smooth$: false,
    range$: {minX: '2026-01-01', maxX: '2026-12-31'},
})

// @ts-expect-error Criteria require stable keys.
staticCriterion<Item>({label: 'Missing key', categories: []})

selection.dispose()
splits.dispose()
filtered$.dispose()
dynamic.dispose()
kind.dispose()
