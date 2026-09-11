import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {after, afterEach, before, describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {Window} from 'happy-dom'

import {Emitter, FetchState} from '@sylwellsoftware/glue'
import {GroupPanel, OptionGroupHeaderEnd, h} from '@sylwellsoftware/fray'

import {
    BlockGraph,
    CategoryHidePanel,
    CollapsibleOptionGroup,
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

test('generated structural CSS uses fixed visualization hosts without theme selectors', async () => {
    const css = await readFile(fileURLToPath(
        new URL('../styles/structural.css', import.meta.url),
    ), 'utf8')
    assert.match(css, /fray-categoryhidepanel/)
    assert.match(css, /fray-splitselectionpanel/)
    assert.match(css, /fray-splitselectionpanel li\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*row nowrap[^}]*justify-content:\s*space-between[^}]*padding:\s*0 \.35rem[^}]*box-shadow:\s*var\(--box-shadow\)/)
    assert.match(css, /fray-splitselectionpanel fray-draghandle\s*\{[^}]*height:\s*\.9rem[^}]*min-height:\s*\.9rem/)
    assert.match(css, /fray-blockgraph/)
    assert.match(css, /fray-linegraph/)
    assert.match(css, /\[role="treeitem"\]/)
    assert.match(css, /fray-blocklabel/)
    assert.doesNotMatch(css, /data-fray-visualization|data-part/)
    assert.doesNotMatch(css, /datacomponentlike|datacomponentshell|coloredlike|coloredinner/)
    assert.doesNotMatch(css, /data-fray-component/)
    assert.doesNotMatch(css, /#(?:9d1f91|c43cb5|db3ddb|b70909|ee0505|ff4040)\b/i)
    assert.doesNotMatch(css, /^\s*--palette-[a-z0-9-]+\s*:/m)
})

describe('visualization controls', () => {
    test('CollapsibleOptionGroup preserves the parent-specific header region', () => {
        new CollapsibleOptionGroup({
            label: 'Severity',
            children: [
                h(OptionGroupHeaderEnd, null, h('small', null, '4 visible')),
                h('p', null, 'Options'),
            ],
        }).mount(document.body)

        assert.match(
            required('fray-collapsibleoptiongroup legend').textContent ?? '',
            /Severity4 visible/,
        )
        assert.equal(
            required('fray-collapsibleoptiongroup fieldset > div > p').textContent,
            'Options',
        )
        assert.throws(
            () => new CollapsibleOptionGroup({
                label: 'Legacy',
                headerEnd: '4 visible',
            } as never).mount(document.body),
            /OptionGroupHeaderEnd/,
        )
    })

    test('CategoryHidePanel uses Fray checkboxes and unfiltered live counts', () => {
        assert.match(CategoryHidePanel.css, /flex: 0 0 auto/)
        assert.match(GroupPanel.css, /display:\s*flex[^}]*flex-flow:\s*row nowrap/)
        assert.match(GroupPanel.css, /> fray-header\s*\{[^}]*writing-mode:\s*vertical-rl[^}]*transform:\s*rotate\(180deg\)/)
        assert.match(CategoryHidePanel.css, /fray-collapsible-option-group > fieldset > legend small/)
        assert.match(CategoryHidePanel.css, /fray-categoryoption > fray-checkbox > label/)
        assert.doesNotMatch(CategoryHidePanel.css, /fray-check-box/)
        const items = new Emitter<readonly Item[]>(itemsValue)
        const criterion = stateCriterion()
        const panel = new CategoryHidePanel({items$: items, criteria: [criterion]})
        panel.mount(document.body)

        assert.equal(required('fray-categoryhidepanel').getAttribute('data-fray-component'),
            'category-hide-panel')
        const categoryPanel = required('fray-categoryhidepanel')
        assert.equal(categoryPanel.getAttribute('role'), 'group')
        assert.ok(categoryPanel.querySelector(':scope > fray-header'))
        assert.ok(categoryPanel.querySelector(
            ':scope > fray-content > fray-categoryhidecontent',
        ))
        assert.ok(required('fray-collapsibleoptiongroup'))
        assert.ok(required('fray-categories'))
        const categoryOptions = [...document.querySelectorAll<HTMLElement>('fray-categoryoption')]
        assert.equal(categoryOptions.length, 2)
        assert.equal(categoryOptions[0]?.style.getPropertyValue('--c1'), colors[0])
        assert.equal(categoryOptions[0]?.style.getPropertyValue('--c2'), colors[1])
        assert.equal(categoryOptions[0]?.style.getPropertyValue('--c3'), colors[2])
        assert.equal(document.querySelectorAll('fray-categoryswatch').length, 2)
        assert.equal(document.querySelector('[role="toolbar"]'), null)
        const checkboxes = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
        assert.equal(checkboxes.length, 2)
        assert.match(checkboxes[0]?.getAttribute('aria-label') ?? '', /Open \(2\): visible/)
        assert.match(checkboxes[1]?.getAttribute('aria-label') ?? '', /Closed \(1\): hidden/)
        assert.equal(checkboxes[0]?.checked, true)
        assert.equal(checkboxes[1]?.checked, false)
        checkboxes[0]?.click()
        assert.deepEqual([...criterion.hidden$.get()].sort(), ['closed', 'open'])

        items.set([...itemsValue, {id: 4, state: 'open', tags: []}])
        assert.match(
            document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.getAttribute('aria-label')
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

        assert.equal(required('fray-splitselectionpanel').getAttribute('data-fray-component'),
            'split-selection-panel')
        const splitPanel = required('fray-splitselectionpanel')
        assert.equal(splitPanel.getAttribute('role'), null)
        assert.ok(splitPanel.querySelector(':scope > fray-grouppanel > fray-header'))
        assert.ok(splitPanel.querySelector(':scope > fray-grouppanel > fray-content > ol'))
        assert.equal(required('[data-split-key="state"]').className, '')
        assert.equal(document.querySelector('[data-part="position"]'), null)
        assert.equal(required('fray-draghandle').localName, 'fray-draghandle')
        assert.equal(document.querySelector('fray-draghandle button'), null)
        assert.equal(required('[data-split-key="state"]')
            .lastElementChild?.localName, 'fray-draghandle')
        const tagsHandle = required<HTMLElement>('[aria-label="Reorder Tags"]')
        assert.equal(tagsHandle.textContent, '')
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
            clientX: 8,
            clientY: 1,
        }))
        document.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
        await Promise.resolve()
        assert.deepEqual(model.order$.get().map(({key}) => key), ['state', 'tags'])
        assert.equal(document.activeElement?.getAttribute('aria-label'), 'Reorder State')
        required<HTMLButtonElement>('button[aria-pressed="false"]').click()
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['tags', 'state'])
        assert.equal(model.activePreset$.get(), 'all')

        const tagsInput = required<HTMLInputElement>('[data-split-key="tags"] input[type="checkbox"]')
        const stateRow = required<HTMLElement>('[data-split-key="state"]')
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => stateRow,
        })
        tagsInput.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}))
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 8,
            clientY: 0,
        }))
        document.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}))
        await Promise.resolve()
        assert.deepEqual(model.order$.get().map(({key}) => key), ['state', 'tags'])
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['state', 'tags'])

        await new Promise((resolve) => setTimeout(resolve, 0))
        required<HTMLInputElement>('[data-split-key="tags"] input[type="checkbox"]').click()
        assert.deepEqual(model.activeSplits$.get().map(({key}) => key), ['state'])
        if (elementFromPoint == null) {
            delete (document as unknown as {elementFromPoint?: unknown}).elementFromPoint
        } else {
            Object.defineProperty(document, 'elementFromPoint', elementFromPoint)
        }

        panel.destroy()
        model.dispose()
        state.dispose()
        tags.dispose()
    })
})

describe('BlockGraph', () => {
    test('bakes each category c1/c2/c3 triplet into blocks while themes own chrome visibility', () => {
        assert.doesNotMatch(BlockGraph.css, /background: var\(--c2, var\(--colored-base\)\)/)
        assert.match(BlockGraph.css, /box-shadow: var\(--block-graph-block-shadow, none\)/)
        assert.doesNotMatch(BlockGraph.css, /\[role="treeitem"\]::before/)
        assert.match(BlockGraph.css, /padding: var\(--viz-block-graph-child-inset, 1\.6em\)/)
        assert.match(BlockGraph.css, /\[role="treeitem"\] > fray-blocklabel\s*\{[^}]*position: absolute/)
        assert.doesNotMatch(BlockGraph.css, /fray-blocklabel\s*\{[^}]*min-height:\s*2\.5rem/)
        assert.match(BlockGraph.css, /grid-template-areas:\s*"label count"/)
        assert.match(BlockGraph.css, /fray-blocklabel > fray-blockname\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/)
        assert.match(BlockGraph.css, /\[role="treeitem"\]:hover:not\(:has\(\[role="treeitem"\]:hover\)\)/)
        assert.doesNotMatch(BlockGraph.css, /& \[role="treeitem"\]:hover\s*\{/)
    })

    test('renders and updates an externally observable keyboard selection', () => {
        const items = new Emitter<readonly Item[]>(itemsValue)
        const state = stateCriterion()
        state.setAllVisible(true)
        const splits = createSplitSelection([state])
        const selection = createBlockSelection(items, splits.activeSplits$)
        const graph = new BlockGraph({model: selection, label: 'Finding blocks'})
        graph.mount(document.body)

        assert.equal(required('fray-blockgraph').getAttribute('data-fray-component'), 'block-graph')
        assert.ok(required('fray-scroller'))
        const blocks = [...document.querySelectorAll<HTMLElement>('[role="treeitem"]')]
        assert.equal(blocks.length, 2)
        assert.ok(blocks.every((block) => block.classList.contains('colored')))
        assert.equal(blocks[0]?.style.getPropertyValue('--colored-dark'), colors[0])
        assert.equal(blocks[0]?.style.getPropertyValue('--colored-base'), colors[1])
        assert.equal(blocks[0]?.style.getPropertyValue('--colored-light'), colors[2])
        assert.equal(blocks[0]?.style.getPropertyValue('--c1'), colors[0])
        assert.equal(blocks[0]?.style.getPropertyValue('--c2'), colors[1])
        assert.equal(blocks[0]?.style.getPropertyValue('--c3'), colors[2])
        assert.equal(blocks[0]?.style.backgroundColor, '')
        assert.equal(blocks[0]?.style.borderColor, colors[0])
        const blockName = required('[role="treeitem"] > fray-blocklabel > fray-blockname')
        assert.equal(blockName.textContent, 'State:Open')
        assert.equal(blockName.querySelector('small')?.textContent, 'State:')
        assert.equal(blockName.querySelector('strong')?.textContent, 'Open')
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
    test('accepts static graph input values', () => {
        const shapes = new SeriesBuilder([{key: 'open', label: 'Open', color: '#c33'}])
            .addOne('2026-01-01', 'open')
            .buildCumulative()
        const graph = new LineGraph({
            shapes$: shapes,
            stacked$: false,
            smooth$: false,
            range$: {minX: '2026-01-01', maxX: '2026-01-05'},
        })
        graph.mount(document.body)

        assert.equal(document.querySelectorAll('.seriesline').length, 1)
        graph.destroy()
    })

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

        assert.equal(required('fray-linegraph').getAttribute('data-fray-component'), 'line-graph')
        assert.ok(required('fray-chart'))
        assert.ok(required('fray-swatch'))
        assert.equal(document.querySelectorAll('.seriesline').length, 2)
        assert.equal(document.querySelectorAll('.seriesarea').length, 0)
        assert.match(required('fray-readout').textContent ?? '', /2026-01-05/)

        const chart = required<HTMLElement>('fray-chart')
        Object.defineProperty(chart, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({left: 0, width: 960}),
        })
        chart.dispatchEvent(new MouseEvent('pointermove', {bubbles: true, clientX: 72}))
        assert.match(required('fray-readout').textContent ?? '', /2026-01-01/)

        chart.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', bubbles: true}))
        chart.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}))
        assert.match(required('fray-readout').textContent ?? '', /2026-01-04/)

        stacked.set(true)
        smooth.set(true)
        assert.equal(document.querySelectorAll('.seriesarea').length, 2)
        assert.match(required<SVGPathElement>('.seriesline').getAttribute('d') ?? '', / C /)

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
