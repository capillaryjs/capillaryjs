import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {Emitter, FetchState} from '@sylwellsoftware/glue'

import {
    buildBlockLayout,
    createBlockSelection,
    createSplitSelection,
    criterionSnapshot,
    staticCriterion,
} from '../src/index.js'
import type {BlockPath, Category} from '../src/index.js'

interface Item {
    id: number
    state: 'open' | 'closed'
    severity: 'high' | 'low'
    tags: readonly string[]
}

const colors = ['#111', '#555', '#999'] as const

const stateCategories: readonly Category<Item>[] = [
    {key: 'open', label: 'Open', colors, predicate: ({state}) => state === 'open'},
    {key: 'closed', label: 'Closed', colors, predicate: ({state}) => state === 'closed'},
]
const severityCategories: readonly Category<Item>[] = [
    {key: 'high', label: 'High', colors, predicate: ({severity}) => severity === 'high'},
    {key: 'low', label: 'Low', colors, predicate: ({severity}) => severity === 'low'},
]

const records: readonly Item[] = [
    {id: 1, state: 'open', severity: 'high', tags: ['a']},
    {id: 2, state: 'open', severity: 'low', tags: ['a', 'b']},
    {id: 3, state: 'closed', severity: 'low', tags: ['b']},
]

describe('block layout', () => {
    test('builds disjoint recursive partitions whose children sum to every parent', () => {
        const state = staticCriterion({
            key: 'state', label: 'State', categories: stateCategories,
        })
        const severity = staticCriterion({
            key: 'severity', label: 'Severity', categories: severityCategories,
        })
        const layout = buildBlockLayout(records, [
            criterionSnapshot(state),
            criterionSnapshot(severity),
        ])

        assert.equal(layout.valid, true)
        assert.equal(layout.root.count, 3)
        assert.equal(sum(layout.root.children.map(({count}) => count)), 3)
        assert.deepEqual(layout.root.children.map(({categoryKey}) => categoryKey), [
            'open',
            'closed',
        ])
        for (const child of layout.root.children) {
            assert.equal(sum(child.children.map(({count}) => count)), child.count)
        }
        assert.equal(layout.root.children[0]?.children[0]?.totalShare, 1 / 3)

        state.dispose()
        severity.dispose()
    })

    test('surfaces unmatched and multiple-match criteria instead of guessing', () => {
        const incomplete = staticCriterion<Item>({
            key: 'tag',
            label: 'Tag',
            categories: [
                {key: 'a', label: 'A', colors, predicate: ({tags}) => tags.includes('a')},
                {key: 'b', label: 'B', colors, predicate: ({tags}) => tags.includes('b')},
            ],
        })
        const layout = buildBlockLayout([
            ...records,
            {id: 4, state: 'open', severity: 'low', tags: []},
        ], [criterionSnapshot(incomplete)])

        assert.equal(layout.valid, false)
        assert.deepEqual(layout.issues.map(({kind, item}) => [kind, item.id]), [
            ['multiple-matches', 2],
            ['unmatched', 4],
        ])
        assert.equal(layout.root.children.length, 0)
        incomplete.dispose()
    })

    test('sorts populated blocks only after assignment and suppresses tiny descendants', () => {
        const state = staticCriterion({
            key: 'state',
            label: 'State',
            categories: stateCategories,
            allowResorting: true,
        })
        const severity = staticCriterion({
            key: 'severity', label: 'Severity', categories: severityCategories,
        })
        const many: Item[] = Array.from({length: 99}, (_unused, index) => ({
            id: index,
            state: 'open',
            severity: index === 0 ? 'high' : 'low',
            tags: [],
        }))
        many.push({id: 100, state: 'closed', severity: 'high', tags: []})
        const layout = buildBlockLayout(many, [
            criterionSnapshot(state),
            criterionSnapshot(severity),
        ], {readabilityThreshold: 0.02})

        assert.deepEqual(layout.root.children.map(({categoryKey}) => categoryKey), [
            'open',
            'closed',
        ])
        assert.equal(layout.root.children[1]?.totalShare, 0.01)
        assert.equal(layout.root.children[1]?.childrenSuppressed, true)
        assert.equal(layout.root.children[1]?.children.length, 0)

        state.dispose()
        severity.dispose()
    })
})

describe('block selection model', () => {
    test('re-resolves a stable-key path with fresh items and clears disappeared paths', () => {
        const items = new Emitter<readonly Item[]>(records)
        const state = staticCriterion({
            key: 'state', label: 'State', categories: stateCategories,
        })
        const splits = createSplitSelection([state])
        const selection = createBlockSelection(items, splits.activeSplits$)
        const openPath: BlockPath = [{criterionKey: 'state', categoryKey: 'open'}]

        selection.select(openPath)
        assert.deepEqual(selection.selectedItems$.get().map(({id}) => id), [1, 2])

        items.set([
            records[0]!,
            {id: 4, state: 'open', severity: 'high', tags: []},
        ])
        assert.deepEqual(selection.selectedItems$.get().map(({id}) => id), [1, 4])
        assert.deepEqual(selection.selectedPath$.get(), openPath)

        items.set([{id: 5, state: 'closed', severity: 'low', tags: []}])
        assert.equal(selection.selectedPath$.get(), null)
        assert.deepEqual(selection.selectedItems$.get(), [])

        selection.dispose()
        splits.dispose()
        state.dispose()
        items.dispose()
    })

    test('propagates source loading state and releases subscriptions', () => {
        const items = new Emitter<readonly Item[]>(records)
        const state = staticCriterion({
            key: 'state', label: 'State', categories: stateCategories,
        })
        const splits = createSplitSelection([state])
        const selection = createBlockSelection(items, splits.activeSplits$)
        const before = items.subscriberCount

        items.setWithState(records, FetchState.Loading)
        assert.equal(selection.layout$.getFetchState(), FetchState.Loading)
        selection.dispose()
        assert.ok(items.subscriberCount < before)

        splits.dispose()
        state.dispose()
        items.dispose()
    })
})

function sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0)
}
