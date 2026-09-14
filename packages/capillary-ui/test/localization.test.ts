import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'
import {Emitter, FetchState} from '@capillaryjs/capillary'

import {
    Checkbox,
    ColorPicker,
    DataTable,
    Dialog,
    Dropdown,
    TreeView,
    Toolbar,
    createCapillaryUiRuntime,
    h,
} from '../src/index.js'
import type {CapillaryUiMessageOverrides} from '../src/index.js'
import {requiredQuery} from './testUtils.js'

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
        DocumentFragment: window.DocumentFragment,
    })
})

afterEach(() => {
    document.body.replaceChildren()
    document.head.replaceChildren()
})

after(() => window.close())

describe('Capillary UI runtime localization', () => {
    test('uses complete English defaults when localization is omitted', () => {
        const localization = createCapillaryUiRuntime().localization

        assert.equal(localization.locale, undefined)
        assert.equal(localization.message('dialogCloseLabel'), 'Close')
        assert.equal(localization.message('dropdownPlaceholder'), 'Select…')
        assert.equal(localization.message('tableSortColumnLabel')('Name'), 'Sort Name')
        assert.equal(localization.message('checkboxStateLabel')('Basic', 'prefer'),
            'Basic: prefer')
    })

    test('canonicalizes locale, applies per-key fallback, and copies caller input', () => {
        const supplied: {dialogCloseLabel: string} = {dialogCloseLabel: 'Luk'}
        const runtime = createCapillaryUiRuntime({
            localization: {locale: 'da-dk', messages: supplied},
        })
        supplied.dialogCloseLabel = 'changed after initialization'

        assert.equal(runtime.localization.locale, 'da-DK')
        assert.equal(runtime.localization.message('dialogCloseLabel'), 'Luk')
        assert.equal(runtime.localization.message('dropdownPlaceholder'), 'Select…')
        assert.equal(Object.isFrozen(runtime.localization), true)
    })

    test('keeps localization isolated per runtime', () => {
        const danish = createCapillaryUiRuntime({
            localization: {locale: 'da', messages: {toolbarLabel: 'Handlinger'}},
        })
        const french = createCapillaryUiRuntime({
            localization: {locale: 'fr', messages: {toolbarLabel: 'Actions FR'}},
        })

        assert.equal(danish.localization.message('toolbarLabel'), 'Handlinger')
        assert.equal(french.localization.message('toolbarLabel'), 'Actions FR')
    })

    test('rejects malformed localization at initialization', () => {
        assert.throws(
            () => createCapillaryUiRuntime({localization: {locale: ''}}),
            /non-empty BCP 47/,
        )
        assert.throws(
            () => createCapillaryUiRuntime({localization: {locale: 'not_a_locale'}}),
            /Invalid Capillary UI localization locale/,
        )
        assert.throws(
            () => createCapillaryUiRuntime({
                localization: {
                    locale: 'da',
                    messages: {dialogCloseLabel: 42} as unknown as CapillaryUiMessageOverrides,
                },
            }),
            /dialogCloseLabel.*wrong type/,
        )
    })

    test('resolves component defaults from the mounting runtime and preserves prop precedence', () => {
        const runtime = createCapillaryUiRuntime({
            localization: {
                locale: 'da',
                messages: {
                    dialogCloseLabel: 'Luk',
                    toolbarLabel: 'Handlinger',
                },
            },
        })

        runtime.mount(new Toolbar(), document.body)
        runtime.mount(new Toolbar({label: 'Explicit'}), document.body)
        runtime.mount(new Dialog({title: 'Titel'}), document.body)
        runtime.mount(new Dropdown(), document.body)

        const toolbars = document.querySelectorAll('[role="toolbar"]')
        assert.equal(toolbars[0]?.getAttribute('aria-label'), 'Handlinger')
        assert.equal(toolbars[1]?.getAttribute('aria-label'), 'Explicit')
        assert.equal(requiredQuery('cap-dialog button').textContent, 'Luk')
        assert.equal(requiredQuery('cap-dropdown option').textContent, 'Select…')
    })

    test('uses a localized loading message rather than an empty tree state', () => {
        const nodes = new Emitter<readonly {id: string; label: string}[] | undefined>(undefined, {
            fetchState: FetchState.Initial,
        })
        const runtime = createCapillaryUiRuntime({
            localization: {
                locale: 'da',
                messages: {
                    treeViewEmpty: 'Ingen træelementer',
                    treeViewLoading: 'Indlæser træelementer…',
                },
            },
        })
        runtime.mount(new TreeView({label: 'Projekter', nodes}), document.body)

        assert.equal(requiredQuery('[role="status"]').textContent, 'Indlæser træelementer…')
        assert.equal(document.querySelector('[role="tree"]'), null)

        nodes.setWithState([], FetchState.Ready)
        assert.equal(requiredQuery('[role="status"]').textContent, 'Ingen træelementer')
    })

    test('falls back to English for initial loading while retaining a refreshing tree', () => {
        const nodes = new Emitter<readonly {id: string; label: string}[] | undefined>(undefined, {
            fetchState: FetchState.Initial,
        })
        const runtime = createCapillaryUiRuntime()
        runtime.mount(new TreeView({label: 'Projects', nodes}), document.body)

        assert.equal(requiredQuery('[role="status"]').textContent, 'Loading tree items…')
        assert.equal(document.querySelector('[role="tree"]'), null)

        const populated = [{id: 'alpha', label: 'Alpha'}]
        nodes.setWithState(populated, FetchState.Ready)
        const tree = requiredQuery('[role="tree"]')
        assert.equal(tree.getAttribute('aria-busy'), null)

        nodes.setWithState(populated, FetchState.Loading)
        assert.equal(requiredQuery('[role="tree"]').textContent, '•Alpha')
        assert.equal(requiredQuery('cap-treeview').getAttribute('aria-busy'), 'true')
        assert.equal(document.querySelector('[role="status"]'), null)
    })

    test('localizes parameterized accessibility messages without coercing rich labels', () => {
        const runtime = createCapillaryUiRuntime({
            localization: {
                locale: 'da',
                messages: {
                    checkboxStateLabel: (label, state) => `${label}, tilstand ${state}`,
                    colorOptionGreenLabel: 'Grøn',
                    filterModeNeutralLabel: 'neutral DA',
                    tableFilterColumnLabel: (label) => `Filtrer ${label}`,
                    tableSortColumnLabel: (label) => `Sorter ${label}`,
                },
            },
        })

        runtime.mount(new Checkbox({
            label: h('strong', null, 'Visuel prioritet'),
            ariaLabel: 'Prioritet',
        }), document.body)
        runtime.mount(new ColorPicker({defaultValue: 'green'}), document.body)
        runtime.mount(new DataTable({
            rowKey: 'id',
            columns: [{
                field: 'name',
                label: h('strong', null, 'Visuelt navn'),
                ariaLabel: 'Personnavn',
                sortable: true,
                filterOptions: ['Ada'],
            }],
            data: [{id: 1, name: 'Ada'}],
        }), document.body)

        assert.equal(requiredQuery('cap-checkbox input').getAttribute('aria-label'),
            'Prioritet, tilstand neutral DA')
        const green = [...document.querySelectorAll('.cap-colors-picker option')]
            .find((option) => option.getAttribute('value') === 'green')
        assert.equal(green?.textContent, 'Grøn')
        assert.equal(requiredQuery('button.sort').getAttribute('aria-label'), 'Sorter Personnavn')
        assert.equal(requiredQuery('button.filter').getAttribute('aria-label'), 'Filtrer Personnavn')
        assert.doesNotMatch(document.body.innerHTML, /\[object Object\]/)
    })
})
