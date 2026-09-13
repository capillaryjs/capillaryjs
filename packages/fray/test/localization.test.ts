import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {
    Checkbox,
    ColorPicker,
    DataTable,
    DatePicker,
    Dialog,
    Dropdown,
    Toolbar,
    createFrayRuntime,
    h,
} from '../src/index.js'
import type {FrayMessageOverrides} from '../src/index.js'
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

describe('Fray runtime localization', () => {
    test('uses complete English defaults when localization is omitted', () => {
        const localization = createFrayRuntime().localization

        assert.equal(localization.locale, undefined)
        assert.equal(localization.message('dialogCloseLabel'), 'Close')
        assert.equal(localization.message('dropdownPlaceholder'), 'Select…')
        assert.equal(localization.message('tableSortColumnLabel')('Name'), 'Sort Name')
        assert.equal(localization.message('checkboxStateLabel')('Basic', 'prefer'),
            'Basic: prefer')
    })

    test('canonicalizes locale, applies per-key fallback, and copies caller input', () => {
        const supplied: {dialogCloseLabel: string} = {dialogCloseLabel: 'Luk'}
        const runtime = createFrayRuntime({
            localization: {locale: 'da-dk', messages: supplied},
        })
        supplied.dialogCloseLabel = 'changed after initialization'

        assert.equal(runtime.localization.locale, 'da-DK')
        assert.equal(runtime.localization.message('dialogCloseLabel'), 'Luk')
        assert.equal(runtime.localization.message('dropdownPlaceholder'), 'Select…')
        assert.equal(Object.isFrozen(runtime.localization), true)
    })

    test('keeps localization isolated per runtime', () => {
        const danish = createFrayRuntime({
            localization: {locale: 'da', messages: {toolbarLabel: 'Handlinger'}},
        })
        const french = createFrayRuntime({
            localization: {locale: 'fr', messages: {toolbarLabel: 'Actions FR'}},
        })

        assert.equal(danish.localization.message('toolbarLabel'), 'Handlinger')
        assert.equal(french.localization.message('toolbarLabel'), 'Actions FR')
    })

    test('rejects malformed localization at initialization', () => {
        assert.throws(
            () => createFrayRuntime({localization: {locale: ''}}),
            /non-empty BCP 47/,
        )
        assert.throws(
            () => createFrayRuntime({localization: {locale: 'not_a_locale'}}),
            /Invalid Fray localization locale/,
        )
        assert.throws(
            () => createFrayRuntime({
                localization: {
                    locale: 'da',
                    messages: {dialogCloseLabel: 42} as unknown as FrayMessageOverrides,
                },
            }),
            /dialogCloseLabel.*wrong type/,
        )
    })

    test('resolves component defaults from the mounting runtime and preserves prop precedence', () => {
        const runtime = createFrayRuntime({
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
        assert.equal(requiredQuery('fray-dialog button').textContent, 'Luk')
        assert.equal(requiredQuery('fray-dropdown option').textContent, 'Select…')
    })

    test('uses locale-aware calendar names and localized calendar controls', () => {
        const runtime = createFrayRuntime({
            localization: {
                locale: 'da-DK',
                messages: {
                    calendarGridLabel: 'Vælg en dato',
                    calendarNextMonthLabel: 'Næste måned',
                    calendarPreviousMonthLabel: 'Forrige måned',
                    datePickerDialogLabel: 'Vælg en dato',
                    datePickerOpenCalendarLabel: 'Åbn kalender',
                },
            },
        })
        runtime.mount(new DatePicker({defaultValue: '2026-09-15'}), document.body)

        const trigger = requiredQuery<HTMLButtonElement>('fray-datepicker > button')
        assert.equal(trigger.getAttribute('aria-label'), 'Åbn kalender')
        trigger.click()

        assert.equal(requiredQuery('dialog').getAttribute('aria-label'), 'Vælg en dato')
        assert.equal(requiredQuery('[role="grid"]').getAttribute('aria-label'), 'Vælg en dato')
        assert.equal(requiredQuery('.fray-calendar-header button').getAttribute('aria-label'),
            'Forrige måned')
        assert.equal(document.querySelectorAll('.fray-calendar-header button')[1]
            ?.getAttribute('aria-label'), 'Næste måned')

        const expectedMonth = new Intl.DateTimeFormat('da-DK', {
            calendar: 'gregory',
            month: 'long',
            year: 'numeric',
        }).format(new Date(2026, 8, 15, 12, 0, 0))
        assert.equal(requiredQuery('[role="heading"]').textContent, expectedMonth)

        const expectedSunday = new Intl.DateTimeFormat('da-DK', {
            calendar: 'gregory',
            weekday: 'long',
        }).format(new Date(2026, 0, 4, 12, 0, 0))
        assert.equal(requiredQuery('thead th span').getAttribute('aria-label'), expectedSunday)
    })

    test('localizes parameterized accessibility messages without coercing rich labels', () => {
        const runtime = createFrayRuntime({
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

        assert.equal(requiredQuery('fray-checkbox input').getAttribute('aria-label'),
            'Prioritet, tilstand neutral DA')
        const green = [...document.querySelectorAll('fray-colorpicker option')]
            .find((option) => option.getAttribute('value') === 'green')
        assert.equal(green?.textContent, 'Grøn')
        assert.equal(requiredQuery('button.sort').getAttribute('aria-label'), 'Sorter Personnavn')
        assert.equal(requiredQuery('button.filter').getAttribute('aria-label'), 'Filtrer Personnavn')
        assert.doesNotMatch(document.body.innerHTML, /\[object Object\]/)
    })
})
