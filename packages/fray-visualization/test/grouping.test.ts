import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {Emitter, FetchState} from '@sylwellsoftware/glue'

import {
    GroupingCriterion,
    categoryCounts,
    createSplitSelection,
    derivedCriterion,
    filterByHidden,
    staticCriterion,
} from '../src/index.js'
import type {Category} from '../src/index.js'

interface RecordItem {
    id: number
    state: 'open' | 'closed'
    tags: readonly string[]
}

const colors = ['var(--low)', 'var(--middle)', 'var(--high)'] as const

function stateCategories(openLabel = 'Open'): readonly Category<RecordItem>[] {
    return [
        {
            key: 'open',
            label: openLabel,
            predicate: ({state}) => state === 'open',
            colors,
        },
        {
            key: 'closed',
            label: 'Closed',
            predicate: ({state}) => state === 'closed',
            colors,
            hiddenByDefault: true,
        },
    ]
}

describe('grouping criteria', () => {
    test('unifies static categories with sticky stable-key visibility state', () => {
        const source = new Emitter(stateCategories())
        const criterion = new GroupingCriterion({
            key: 'state',
            label: 'State',
            categories$: source,
        })

        assert.deepEqual([...criterion.hidden$.get()], ['closed'])
        criterion.visibility('closed').set('visible')
        assert.deepEqual([...criterion.hidden$.get()], [])

        source.set(stateCategories('Currently open'))
        assert.deepEqual([...criterion.hidden$.get()], [])
        assert.equal(criterion.categories$.get()[0]?.label, 'Currently open')

        source.set([stateCategories()[0]!])
        source.set(stateCategories())
        assert.deepEqual([...criterion.hidden$.get()], [])

        const beforeDispose = source.subscriberCount
        assert.ok(beforeDispose > 0)
        criterion.dispose()
        assert.equal(source.subscriberCount, 0)
        source.dispose()
    })

    test('derives dynamic categories, counts, fallback, ordering, and fetch state', () => {
        const source = new Emitter<readonly RecordItem[]>([
            {id: 1, state: 'open', tags: ['beta', 'alpha']},
            {id: 2, state: 'open', tags: ['beta']},
            {id: 3, state: 'closed', tags: []},
        ])
        const criterion = derivedCriterion({
            key: 'tag',
            label: 'Tag',
            source$: source,
            extractKeys: ({tags}) => tags,
            describe: (key) => ({
                label: key.toUpperCase(),
                colors,
                hiddenByDefault: key === 'alpha',
            }),
            unmatched: {key: 'none', label: 'No tags', colors},
        })

        assert.deepEqual(criterion.categories$.get().map(({key}) => key), [
            'beta',
            'alpha',
            'none',
        ])
        assert.deepEqual([...criterion.hidden$.get()], ['alpha'])

        source.setWithState(source.get(), FetchState.Loading)
        assert.equal(criterion.categories$.getFetchState(), FetchState.Loading)
        source.setWithState([
            {id: 4, state: 'open', tags: ['gamma']},
        ], FetchState.Ready)
        assert.deepEqual(criterion.categories$.get().map(({key}) => key), ['gamma'])

        criterion.dispose()
        assert.equal(source.subscriberCount, 0)
        source.dispose()
    })

    test('filters with blacklist semantics even when categories overlap', () => {
        const items = new Emitter<readonly RecordItem[]>([
            {id: 1, state: 'open', tags: ['alpha']},
            {id: 2, state: 'closed', tags: ['alpha', 'beta']},
            {id: 3, state: 'closed', tags: []},
        ])
        const tags = derivedCriterion({
            key: 'tag',
            label: 'Tag',
            source$: items,
            extractKeys: ({tags: values}) => values,
            describe: (key) => ({label: key, colors}),
        })
        const state = staticCriterion({
            key: 'state',
            label: 'State',
            categories: stateCategories(),
        })
        const filtered = filterByHidden(items, [tags, state])

        assert.deepEqual(filtered.get().map(({id}) => id), [1])
        state.visibility('closed').set('visible')
        tags.visibility('alpha').set('hidden')
        assert.deepEqual(filtered.get().map(({id}) => id), [3])

        filtered.dispose()
        tags.dispose()
        state.dispose()
        items.dispose()
    })

    test('provides live unfiltered counts independent of visibility', () => {
        const items = new Emitter<readonly RecordItem[]>([
            {id: 1, state: 'open', tags: []},
            {id: 2, state: 'closed', tags: []},
        ])
        const criterion = staticCriterion({
            key: 'state',
            label: 'State',
            categories: stateCategories(),
        })
        const counts = categoryCounts(items, criterion)

        assert.deepEqual([...counts.get()], [['open', 1], ['closed', 1]])
        criterion.setAllVisible(false)
        assert.deepEqual([...counts.get()], [['open', 1], ['closed', 1]])

        counts.dispose()
        criterion.dispose()
        items.dispose()
    })

    test('rejects duplicate stable keys', () => {
        assert.throws(() => staticCriterion({
            key: 'bad',
            label: 'Bad',
            categories: [stateCategories()[0]!, stateCategories()[0]!],
        }), /duplicate key/)
    })
})

describe('split selection model', () => {
    test('coordinates ordered active splits, presets, and reusable state adapters', () => {
        const state = staticCriterion({
            key: 'state', label: 'State', categories: stateCategories(),
        })
        const tag = staticCriterion<RecordItem>({
            key: 'tag',
            label: 'Tag',
            categories: [{
                key: 'alpha', label: 'Alpha', colors, predicate: ({tags}) => tags.includes('alpha'),
            }],
        })
        const model = createSplitSelection([state, tag], {
            active: ['state'],
            presets: [{
                key: 'tags-first',
                label: 'Tags first',
                active: ['tag', 'state'],
                inactive: [],
            }],
        })

        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['state'])
        model.activeState('tag').set('visible')
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['state', 'tag'])
        model.move('tag', 0)
        assert.deepEqual(model.order$.get().map(({key}) => key), ['tag', 'state'])
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['tag', 'state'])

        model.activeState('state').set('hidden')
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['tag'])
        model.applyPreset('tags-first')
        assert.equal(model.activePreset$.get(), 'tags-first')
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['tag', 'state'])

        assert.throws(() => model.setSplits(['tag'], []), /cover every criterion/)
        model.dispose()
        state.dispose()
        tag.dispose()
    })
})
