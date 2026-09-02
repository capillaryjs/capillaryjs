import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter, FetchState} from '@sylwellsoftware/glue'
import {FilterMode, h} from '../src/index.js'
import type {FilterModeValue} from '../src/index.js'
import {
    DataTable,
    Dialog,
    FilterPanel,
    ListView,
    TreeItem,
    TreeView,
    createSelectionHandler,
    serializeTableQuery,
} from '../src/experimental.js'
import type {FilterValue} from '../src/experimental.js'
import {requiredAt, requiredQuery} from './testUtils.js'

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
        KeyboardEvent: window.KeyboardEvent,
    })
})

afterEach(() => {
    document.body.replaceChildren()
    document.head.replaceChildren()
})

after(() => window.close())

describe('selection handlers', () => {
    test('use an explicit provider and replace row listeners on every update', () => {
        const items = [{id: 'a'}, {id: 'b'}]
        const selected = new Emitter<Array<{id: string}>>([])
        const handler = createSelectionHandler({
            getItems: () => items,
            selectedItemsEmitter: selected,
        })
        const rows = items.map(() => document.createElement('div'))
        let notifications = 0
        selected.subscribeFutureValues(() => notifications += 1)

        handler.rowsUpdated(rows)
        handler.rowsUpdated(rows)
        requiredAt(rows, 1).dispatchEvent(new MouseEvent('click', {bubbles: true}))

        assert.deepEqual(selected.get(), [items[1]])
        assert.equal(notifications, 1)
        assert.equal(requiredAt(rows, 1).getAttribute('aria-selected'), 'true')

        handler.destroy()
        requiredAt(rows, 0).dispatchEvent(new MouseEvent('click', {bubbles: true}))
        assert.deepEqual(selected.get(), [items[1]])
    })

    test('supports command toggles, shift ranges, arrows, and space', () => {
        const items = [{id: 1}, {id: 2}, {id: 3}]
        const handler = createSelectionHandler({
            multiSelect: true,
            getItems: () => items,
        })
        const rows = items.map(() => document.createElement('div'))
        document.body.append(...rows)
        handler.rowsUpdated(rows)
        try {
            requiredAt(rows, 0).dispatchEvent(new MouseEvent('click', {bubbles: true}))
            requiredAt(rows, 2).dispatchEvent(
                new MouseEvent('click', {bubbles: true, shiftKey: true}),
            )
            assert.deepEqual(handler.getSelectedItems(), items)

            requiredAt(rows, 1).dispatchEvent(
                new MouseEvent('click', {bubbles: true, ctrlKey: true}),
            )
            assert.deepEqual(handler.getSelectedItems(), [items[0], items[2]])

            requiredAt(rows, 0).dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown'}))
            assert.equal(document.activeElement, requiredAt(rows, 1))
            requiredAt(rows, 1).dispatchEvent(new KeyboardEvent('keydown', {key: ' '}))
            assert.deepEqual(
                new Set(handler.getSelectedItems().map(({id}) => id)),
                new Set(items.map(({id}) => id)),
            )
        } finally {
            handler.destroy()
        }
    })

    test('supports pointer drag ranges without a trailing click collapsing selection', () => {
        const items = [{id: 1}, {id: 2}, {id: 3}, {id: 4}]
        const handler = createSelectionHandler({
            multiSelect: true,
            getItems: () => items,
        })
        const rows = items.map(() => document.createElement('div'))
        document.body.append(...rows)
        handler.rowsUpdated(rows)
        try {
            requiredAt(rows, 1).dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true,
                button: 0,
                buttons: 1,
            }))
            requiredAt(rows, 3).dispatchEvent(new MouseEvent('mouseenter', {
                bubbles: false,
                buttons: 1,
            }))
            document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, button: 0}))
            requiredAt(rows, 3).dispatchEvent(new MouseEvent('click', {bubbles: true}))

            assert.deepEqual(handler.getSelectedItems(), items.slice(1))

            requiredAt(rows, 0).dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                metaKey: true,
            }))
            assert.deepEqual(
                new Set(handler.getSelectedItems().map(({id}) => id)),
                new Set(items.map(({id}) => id)),
            )
        } finally {
            handler.destroy()
        }
    })
})

describe('experimental data components', () => {
    test('TreeView supports controlled expansion, selection, navigation, and cleanup', () => {
        const nodes = new Emitter([
            {
                id: 'workspace',
                label: 'Workspace',
                children: [{id: 'service-a', label: 'Service Alpha'}],
            },
            {id: 'tools', label: 'Tools'},
        ])
        const selected = new Emitter<string | number | null>(null)
        const expanded = new Emitter<Array<string | number>>([])
        const tree = TreeView.new({
            label: 'Projects',
            nodes,
            selectedKeyEmitter: selected,
            expandedKeysEmitter: expanded,
        }).attachTo(document.body)

        assert.equal(requiredQuery('fray-tree-view').dataset.frayComponent, 'tree-view')
        assert.equal(document.querySelectorAll('[role="treeitem"]').length, 2)
        let first = requiredQuery<HTMLElement>('[role="treeitem"]')
        first.focus()
        first.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))
        assert.deepEqual(expanded.get(), ['workspace'])
        assert.equal(document.querySelectorAll('[role="treeitem"]').length, 3)

        first = requiredQuery<HTMLElement>('[role="treeitem"]')
        first.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))
        const child = requiredAt(document.querySelectorAll<HTMLElement>('[role="treeitem"]'), 1)
        assert.equal(document.activeElement, child)
        child.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}))
        assert.equal(selected.get(), 'service-a')
        assert.equal(child.getAttribute('aria-selected'), 'true')

        child.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}))
        assert.equal(document.activeElement, first)
        first.dispatchEvent(new KeyboardEvent('keydown', {key: 't', bubbles: true}))
        assert.equal(document.activeElement?.textContent, '•Tools')

        nodes.set([{id: 'replacement', label: 'Replacement'}])
        assert.equal(selected.get(), 'service-a')
        assert.deepEqual(expanded.get(), ['workspace'])
        tree.destroy()
        assert.equal(nodes.subscriberCount, 0)
        assert.equal(selected.subscriberCount, 0)
        assert.equal(expanded.subscriberCount, 0)
    })

    test('TreeView accepts declarative TreeItem nodes', () => {
        TreeView.new({
            label: 'Declarative tree',
            children: [h(TreeItem, {id: 'one', label: 'One'},
                h(TreeItem, {id: 'child', label: 'Child'}))],
        }).attachTo(document.body)
        const root = requiredQuery<HTMLElement>('[role="treeitem"]')
        root.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))
        assert.equal(document.querySelectorAll('[role="treeitem"]').length, 2)
    })

    test('Dialog synchronizes native modality, cancel, and focus restoration', () => {
        const opener = document.createElement('button')
        opener.textContent = 'Open dialog'
        document.body.append(opener)
        opener.focus()
        const open = new Emitter(false)
        let closes = 0
        const dialog = Dialog.new({
            title: 'Reset scenario?',
            description: 'This restores deterministic fixture data.',
            valueEmitter: open,
            onClose: () => closes += 1,
            children: h('button', {autoFocus: true}, 'Confirm reset'),
        }).attachTo(document.body)

        open.set(true)
        const element = requiredQuery<HTMLDialogElement>('dialog')
        assert.equal(element.open, true)
        assert.equal(element.getAttribute('aria-modal'), 'true')
        assert.equal(document.activeElement?.textContent, 'Confirm reset')

        element.dispatchEvent(new Event('cancel', {cancelable: true}))
        assert.equal(open.get(), false)
        assert.equal(element.open, false)
        assert.equal(document.activeElement, opener)
        assert.equal(closes, 1)
        dialog.destroy()
        assert.equal(open.subscriberCount, 0)
    })

    test('ListView shares its selected emitter and preserves key selection on refresh', () => {
        const items = new Emitter([{id: 'a', label: 'Alpha'}, {id: 'b', label: 'Beta'}])
        const selected = new Emitter<Array<{id: string; label: string}>>([])
        const list = ListView.new({
            items,
            selectedItemsEmitter: selected,
            label: 'Projects',
        }).attachTo(document.body)

        const rows = document.querySelectorAll('[role="option"]')
        assert.equal(requiredQuery('fray-list-view').dataset.frayComponent, 'list-view')
        requiredAt(rows, 1).dispatchEvent(new MouseEvent('click', {bubbles: true}))
        assert.equal(list.getSelectedItemsEmitter(), selected)
        assert.equal(requiredAt(selected.get(), 0).id, 'b')

        const refreshed = [{id: 'a', label: 'New Alpha'}, {id: 'b', label: 'New Beta'}]
        items.set(refreshed)
        assert.equal(requiredAt(selected.get(), 0), requiredAt(refreshed, 1))
        assert.equal(requiredAt(document.querySelectorAll('[role="option"]'), 1)
            .getAttribute('aria-selected'), 'true')

        list.destroy()
        assert.equal(items.subscriberCount, 0)
        assert.equal(selected.subscriberCount, 0)
    })

    test('keeps loading, empty, and error messages outside listbox semantics', () => {
        const items = new Emitter<readonly {id: string}[], Error>([], {
            fetchState: FetchState.Initial,
        })
        const list = ListView.new({items, label: 'Projects'}).attachTo(document.body)

        assert.equal(document.querySelector('[role="listbox"]'), null)
        assert.match(requiredQuery('[role="status"]').textContent ?? '', /Loading items/)

        items.setWithState([], FetchState.Ready)
        assert.equal(document.querySelector('[role="listbox"]'), null)
        assert.equal(requiredQuery('[role="status"]').textContent, 'No items')

        items.setWithState([], FetchState.Error, new Error('Projects unavailable'))
        assert.equal(document.querySelector('[role="listbox"]'), null)
        assert.match(requiredQuery('[role="alert"]').textContent ?? '', /Projects unavailable/)

        items.setWithState([{id: 'retained'}], FetchState.Error, new Error('Refresh failed'))
        assert.equal(requiredQuery('[role="listbox"]').getAttribute('aria-label'), 'Projects')
        assert.equal(document.querySelectorAll('[role="option"]').length, 1)
        assert.match(requiredQuery('[role="alert"]').textContent ?? '', /Refresh failed/)

        list.destroy()
        assert.equal(items.subscriberCount, 0)
    })

    test('DataTable local mode sorts, filters, selects only body rows, and stays semantic', () => {
        const rows = [
            {id: 1, name: 'Beta', department: 'Ops'},
            {id: 2, name: 'Alpha', department: 'R&D'},
            {id: 3, name: 'Gamma', department: 'Ops'},
        ]
        const table = DataTable.new({
            mode: 'local',
            caption: 'People',
            data: rows,
            columns: [
                {field: 'name', label: 'Name', sortable: true},
                {field: 'department', label: 'Department', filterOptions: ['Ops', 'R&D']},
            ],
        }).attachTo(document.body)

        assert.equal(requiredQuery('caption').textContent, 'People')
        assert.equal(requiredQuery('fray-data-table').dataset.frayComponent, 'data-table')
        assert.equal(requiredQuery('thead').dataset.frayComponent, 'table-header')
        assert.equal(
            requiredQuery('th').dataset.frayComponent,
            'table-header-cell',
        )
        requiredQuery('[data-part="sort"]')
            .dispatchEvent(new MouseEvent('click', {bubbles: true}))
        assert.deepEqual(
            [...document.querySelectorAll<HTMLTableRowElement>('tbody tr')]
                .map((row) => requiredAt(row.cells, 0).textContent),
            ['Alpha', 'Beta', 'Gamma'],
        )

        table.filtersEmitter.set({
            department: [['Ops', FilterMode.Require]],
        })
        assert.deepEqual(
            [...document.querySelectorAll<HTMLTableRowElement>('tbody tr')]
                .map((row) => requiredAt(row.cells, 0).textContent),
            ['Beta', 'Gamma'],
        )
        requiredQuery('tbody tr')
            .dispatchEvent(new MouseEvent('click', {bubbles: true}))
        assert.deepEqual(table.getSelectedRows(), [rows[0]])
        assert.equal(requiredQuery('thead tr').hasAttribute('aria-selected'), false)
        table.destroy()
    })

    test('preserves an open filter and its state through table/data rerenders', () => {
        const data = new Emitter([
            {id: 1, name: 'Ada', department: 'R&D'},
            {id: 2, name: 'Grace', department: 'Ops'},
        ])
        const table = DataTable.new({
            mode: 'local',
            data,
            columns: [
                {field: 'name', label: 'Name'},
                {field: 'department', label: 'Department', filterOptions: ['Ops', 'R&D']},
            ],
        }).attachTo(document.body)

        requiredQuery<HTMLButtonElement>('button[aria-label="Filter Department"]').click()
        requiredQuery<HTMLElement>('[role="checkbox"]').click()
        assert.deepEqual(table.filtersEmitter.get(), {
            department: [['Ops', FilterMode.Prefer]],
        })
        assert.match(
            requiredQuery<HTMLElement>('[role="checkbox"]').getAttribute('aria-label') ?? '',
            /prefer/,
        )

        data.set([
            {id: 1, name: 'New Ada', department: 'R&D'},
            {id: 2, name: 'New Grace', department: 'Ops'},
            {id: 3, name: 'Linus', department: 'Ops'},
        ])

        assert.deepEqual(table.filtersEmitter.get(), {
            department: [['Ops', FilterMode.Prefer]],
        })
        assert.equal(document.querySelector('[role="group"]') != null, true)
        assert.deepEqual(
            [...document.querySelectorAll<HTMLTableRowElement>('tbody tr')]
                .map((row) => requiredAt(row.cells, 0).textContent),
            ['New Grace', 'Linus'],
        )
        table.destroy()
    })

    test('renders loading, partial, empty, error, and retry states separately', () => {
        type Person = {id: number; name: string}
        const source = new Emitter<readonly Person[] | undefined, Error>(undefined, {
            fetchState: FetchState.Initial,
        })
        let retries = 0
        const query = Object.assign(source, {retry: () => retries += 1})
        const table = DataTable.new({
            mode: 'remote',
            query,
            columns: [{field: 'name', label: 'Name'}],
            emptyMessage: 'No people',
            placeholderCount: 2,
        }).attachTo(document.body)

        assert.match(requiredQuery('[role="status"]').textContent ?? '', /Loading rows/)
        assert.equal(document.querySelectorAll('fray-placeholder').length, 2)
        assert.equal(requiredQuery('fray-placeholder').dataset.frayComponent, 'placeholder')

        source.setWithState([{id: 1, name: 'Partial Ada'}], FetchState.Loading)
        assert.match(requiredQuery('[role="status"]').textContent ?? '', /Loading rows/)
        assert.equal(document.querySelectorAll('fray-placeholder').length, 0)
        assert.equal(requiredQuery('tbody').textContent, 'Partial Ada')

        source.setWithState([], FetchState.Ready)
        assert.equal(document.querySelector('[role="status"]'), null)
        assert.equal(requiredQuery('tbody').textContent, 'No people')

        source.setWithState(
            [{id: 1, name: 'Stale Ada'}],
            FetchState.Error,
            new Error('Service unavailable'),
        )
        assert.match(requiredQuery('[role="alert"]').textContent ?? '', /Service unavailable/)
        assert.equal(requiredQuery('tbody').textContent, 'Stale Ada')
        requiredQuery<HTMLButtonElement>('button').click()
        assert.equal(retries, 1)

        source.setWithState([], FetchState.Error, new Error('Still unavailable'))
        assert.match(requiredQuery('[role="alert"]').textContent ?? '', /Still unavailable/)
        assert.equal(requiredQuery('tbody').textContent, '')
        assert.doesNotMatch(document.body.textContent ?? '', /No people/)

        table.destroy()
        assert.equal(source.subscriberCount, 0)
    })

    test('FilterPanel consumes injected options without fetching application data', () => {
        let nextFilters: Map<FilterValue, FilterModeValue> | undefined
        FilterPanel.new({
            label: 'Departments',
            options: ['Ops', 'R&D'],
            filters: new Map(),
            onChange: (filters) => nextFilters = filters,
        }).attachTo(document.body)

        assert.equal(requiredQuery('fray-filter-panel').dataset.frayComponent, 'filter-panel')
        assert.equal(document.querySelectorAll('[role="checkbox"]').length, 2)
        requiredQuery('[role="checkbox"]')
            .dispatchEvent(new MouseEvent('click', {bubbles: true}))
        assert.equal(nextFilters?.get('Ops'), FilterMode.Prefer)
    })

    test('remote table serializer keeps table encoding outside Glue', () => {
        const url = serializeTableQuery(new URL('https://example.test/rows'), {
            sort: {field: 'name', direction: 'desc'},
            filters: {department: [['Ops', FilterMode.Require]]},
        })
        assert.equal(url.searchParams.get('sort'), 'name:desc')
        assert.deepEqual(url.searchParams.getAll('filter'), [
            'department:_:"Ops"',
        ])
    })
})
