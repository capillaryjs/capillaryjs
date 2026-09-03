import {Emitter} from '@sylwellsoftware/glue'
import {
    BlockGraph,
    CategoryHidePanel,
    createBlockSelection,
    createSplitSelection,
    staticCriterion,
} from '@sylwellsoftware/fray-visualization'

type Row = {id: number; state: 'open' | 'closed'}
const rows$ = new Emitter<readonly Row[]>([{id: 1, state: 'open'}])
const state = staticCriterion<Row>({
    key: 'state',
    label: 'State',
    categories: [
        {
            key: 'open', label: 'Open', colors: ['#efe', '#8c8', '#252'],
            predicate: row => row.state === 'open',
        },
        {
            key: 'closed', label: 'Closed', colors: ['#fee', '#c88', '#522'],
            predicate: row => row.state === 'closed',
        },
    ],
})
const splits = createSplitSelection([state], {active: ['state']})
const selection = createBlockSelection(rows$, splits.activeSplits$)

class App extends CategoryHidePanel<Row> {}
new App({items$: rows$, criteria: [state]})
new BlockGraph({model: selection})

// @ts-expect-error BlockGraph requires a block-selection model.
new BlockGraph({model: rows$})
