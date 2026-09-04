import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {after, afterEach, before, describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {Window} from 'happy-dom'

import {Emitter, FetchState} from '@sylwellsoftware/glue'

import {
    BlockGraph,
    CategoryHidePanel,
    LineGraph,
    SeriesBuilder,
    SplitSelectionPanel,
    createBlockSelection,
    createSplitSelection,
    staticCriterion,
} from '../src/index.js'

interface Item {
    id: number
    state: 'open' | 'closed'
    tags: readonly string[]
}

const colors = ['#123', '#456', '#789'] as const
let window: Window

before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {
        window,
        document: window.document,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        EventTarget: window.EventTarget,
        Event: window.Event,
        MouseEvent: window.MouseEvent,
        PointerEvent: window.PointerEvent,
        KeyboardEvent: window.KeyboardEvent,
        DocumentFragment: window.DocumentFragment,
    })
})

afterEach(() => {
    document.body.replaceChildren()
    document.head.replaceChildren()
})

after(() => window.close())

function stateCriterion() {
    return staticCriterion<Item>({
        key: 'state',
        label: 'State',
        categories: [
            {key: 'open', label: 'Open', colors, predicate: ({state}) => state === 'open'},
            {
                key: 'closed',
                label: 'Closed',
                colors,
                predicate: ({state}) => state === 'closed',
                hiddenByDefault: true,
            },
        ],
    })
}

const itemsValue: readonly Item[] = [
    {id: 1, state: 'open', tags: ['a']},
    {id: 2, state: 'open', tags: ['a']},
    {id: 3, state: 'closed', tags: []},
]

test('generated structural CSS keeps visualization diagnostics out of theme semantics', async () => {
    const css = await readFile(fileURLToPath(
        new URL('../styles/structural.css', import.meta.url),
    ), 'utf8')
    assert.match(css, /data-fray-visualization/)
    assert.match(css, /\[role="treeitem"\]/)
    assert.match(css, /\.coloredinner/)
    assert.doesNotMatch(css, /data-fray-component/)
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i)
    assert.doesNotMatch(css, /^\s*--palette-[a-z0-9-]+\s*:/m)
})

describe('visualization controls', () => {
    test('CategoryHidePanel uses Fray checkboxes and unfiltered live counts', () => {
        const items = new Emitter<readonly Item[]>(itemsValue)
        const criterion = stateCriterion()
        const panel = new CategoryHidePanel({items$: items, criteria: [criterion]})
        panel.mount(document.body)

        assert.equal(required('section[data-fray-visualization="category-hide-panel"]').className,
            'datacomponentlike')
        assert.equal(required('details').className, 'datacomponentshell')
        const checkboxes = [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')]
        assert.equal(checkboxes.length, 2)
        assert.match(checkboxes[0]?.getAttribute('aria-label') ?? '', /Open \(2\): visible/)
        assert.match(checkboxes[1]?.getAttribute('aria-label') ?? '', /Closed \(1\): hidden/)
        assert.equal(checkboxes[0]?.getAttribute('aria-checked'), 'true')
        assert.equal(checkboxes[1]?.getAttribute('aria-checked'), 'false')
        checkboxes[0]?.click()
        assert.deepEqual([...criterion.hidden$.get()].sort(), ['closed', 'open'])

        items.set([...itemsValue, {id: 4, state: 'open', tags: []}])
        assert.match(
            document.querySelector<HTMLElement>('[role="checkbox"]')?.getAttribute('aria-label')
                ?? '',
            /Open \(3\): hidden/,
        )

        panel.destroy()
        criterion.dispose()
        items.dispose()
    })

    test('SplitSelectionPanel applies presets and pointer/keyboard reorder with focus retention', async () => {
        const state = stateCriterion()
        const tags = staticCriterion<Item>({
            key: 'tags',
            label: 'Tags',
            categories: [{
                key: 'a', label: 'A', colors, predicate: ({tags: values}) => values.includes('a'),
            }],
        })
        const model = createSplitSelection([state, tags], {
            active: ['state'],
            presets: [{key: 'all', label: 'All splits', active: ['tags', 'state'], inactive: []}],
        })
        const panel = new SplitSelectionPanel({model})
        panel.mount(document.body)

        assert.equal(required('section[data-fray-visualization="split-selection-panel"]').className,
            'datacomponentlike')
        assert.ok(required('[data-split-key="state"]').classList.contains('datacomponentshell'))
        const tagsHandle = required<HTMLElement>('[aria-label="Reorder Tags"]')
        tagsHandle.focus()
        tagsHandle.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            altKey: true,
            bubbles: true,
        }))
        await Promise.resolve()
        assert.deepEqual(model.order$.get().map(({key}) => key), ['tags', 'state'])
        assert.equal(document.activeElement?.getAttribute('aria-label'), 'Reorder Tags')

        const stateHandle = required<HTMLElement>('[aria-label="Reorder State"]')
        const tagsRow = required<HTMLElement>('[data-split-key="tags"]')
        const elementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => tagsRow,
        })
        stateHandle.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 1,
            clientY: 1,
        }))
        document.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
        await Promise.resolve()
        assert.deepEqual(model.order$.get().map(({key}) => key), ['state', 'tags'])
        assert.equal(document.activeElement?.getAttribute('aria-label'), 'Reorder State')
        if (elementFromPoint == null) {
            delete (document as unknown as {elementFromPoint?: unknown}).elementFromPoint
        } else {
            Object.defineProperty(document, 'elementFromPoint', elementFromPoint)
        }

        required<HTMLButtonElement>('button[aria-pressed="false"]').click()
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['tags', 'state'])
        assert.equal(model.activePreset$.get(), 'all')

        panel.destroy()
        model.dispose()
        state.dispose()
        tags.dispose()
    })
})

describe('BlockGraph', () => {
    test('renders and updates an externally observable keyboard selection', () => {
        const items = new Emitter<readonly Item[]>(itemsValue)
        const state = stateCriterion()
        state.setAllVisible(true)
        const splits = createSplitSelection([state])
        const selection = createBlockSelection(items, splits.activeSplits$)
        const graph = new BlockGraph({model: selection, label: 'Finding blocks'})
        graph.mount(document.body)

        assert.equal(required('section[data-fray-visualization="block-graph"]').className,
            'datacomponentlike')
        assert.ok(required('[data-part="scroller"]').classList.contains('datacomponentshell'))
        const blocks = [...document.querySelectorAll<HTMLElement>('[role="treeitem"]')]
        assert.equal(blocks.length, 2)
        assert.ok(blocks.every((block) => block.classList.contains('coloredlike')))
        assert.ok(required('[role="treeitem"] > .coloredinner').classList.contains('coloredinner'))
        assert.match(blocks[0]?.getAttribute('aria-label') ?? '', /Open, 2 items/)
        blocks[0]?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))
        assert.deepEqual(selection.selectedItems$.get().map(({id}) => id), [1, 2])
        assert.equal(blocks[0]?.getAttribute('aria-selected'), 'true')

        blocks[0]?.focus()
        blocks[0]?.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}))
        assert.match(document.activeElement?.getAttribute('aria-label') ?? '', /Closed, 1 item/)
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
        }))
        assert.equal(selection.selectedPath$.get(), null)

        graph.destroy()
        selection.dispose()
        splits.dispose()
        state.dispose()
        items.dispose()
    })

    test('shows loading and explicit invalid-partition states', () => {
        const items = new Emitter<readonly Item[]>(itemsValue)
        const overlapping = staticCriterion<Item>({
            key: 'tags',
            label: 'Tags',
            categories: [
                {key: 'a', label: 'A', colors, predicate: ({tags}) => tags.includes('a')},
                {key: 'also-a', label: 'Also A', colors, predicate: ({tags}) => tags.includes('a')},
                {key: 'none', label: 'None', colors, predicate: ({tags}) => tags.length === 0},
            ],
        })
        const splits = createSplitSelection([overlapping])
        const selection = createBlockSelection(items, splits.activeSplits$)
        const graph = new BlockGraph({model: selection})
        graph.mount(document.body)

        assert.match(required('[role="alert"]').textContent ?? '', /Invalid block partition/)
        items.setWithState(itemsValue, FetchState.Loading)
        assert.match(required('[role="status"]').textContent ?? '', /Loading block graph/)

        graph.destroy()
        selection.dispose()
        splits.dispose()
        overlapping.dispose()
        items.dispose()
    })
})

describe('LineGraph', () => {
    test('renders SVG series, generated legend, and pointer/keyboard cursor readout', () => {
        const shapes = new Emitter(new SeriesBuilder([
            {key: 'open', label: 'Open', color: '#c33'},
            {key: 'closed', label: 'Closed', color: '#36c'},
        ]).addOne('2026-01-01', 'open')
            .addOne('2026-01-03', 'open')
            .addOne('2026-01-02', 'closed')
            .buildCumulative())
        const stacked = new Emitter(false)
        const smooth = new Emitter(false)
        const range = new Emitter({minX: '2026-01-01', maxX: '2026-01-05'})
        const graph = new LineGraph({
            shapes$: shapes,
            stacked$: stacked,
            smooth$: smooth,
            range$: range,
        })
        graph.mount(document.body)

        assert.equal(required('section[data-fray-visualization="line-graph"]').className,
            'datacomponentlike')
        assert.ok(required('[data-part="chart"]').classList.contains('datacomponentshell'))
        assert.ok(required('[data-part="swatch"]').classList.contains('coloredlike'))
        assert.equal(document.querySelectorAll('[data-part="series-line"]').length, 2)
        assert.equal(document.querySelectorAll('[data-part="series-area"]').length, 0)
        assert.match(required('[data-part="readout"]').textContent ?? '', /2026-01-05/)

        const chart = required<HTMLElement>('[data-part="chart"]')
        Object.defineProperty(chart, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({left: 0, width: 960}),
        })
        chart.dispatchEvent(new MouseEvent('pointermove', {bubbles: true, clientX: 72}))
        assert.match(required('[data-part="readout"]').textContent ?? '', /2026-01-01/)

        chart.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', bubbles: true}))
        chart.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}))
        assert.match(required('[data-part="readout"]').textContent ?? '', /2026-01-04/)

        stacked.set(true)
        smooth.set(true)
        assert.equal(document.querySelectorAll('[data-part="series-area"]').length, 2)
        assert.match(required<SVGPathElement>('[data-part="series-line"]').getAttribute('d') ?? '', / C /)

        graph.destroy()
        shapes.dispose()
        stacked.dispose()
        smooth.dispose()
        range.dispose()
    })
})

function required<TElement extends Element = HTMLElement>(selector: string): TElement {
    const element = document.querySelector<TElement>(selector)
    if (element == null) throw new Error(`Missing element: ${selector}`)
    return element
}
