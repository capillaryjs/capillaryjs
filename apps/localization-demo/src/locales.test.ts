import assert from 'node:assert/strict'
import {test} from 'node:test'

import {
    chooseDemoLocale,
    demoLocaleIds,
    getDemoLocale,
    languageOptions,
} from './locales.js'

test('demo exposes stable autonymous language choices', () => {
    assert.deepEqual(languageOptions(), [
        ['en-GB', 'English'],
        ['da-DK', 'Dansk'],
        ['de-DE', 'Deutsch'],
    ])
    for (const locale of demoLocaleIds) {
        assert.equal(getDemoLocale(locale).locale, locale)
    }
})

test('initial locale policy recognizes Danish and German language tags', () => {
    assert.equal(chooseDemoLocale('da'), 'da-DK')
    assert.equal(chooseDemoLocale('da-GL'), 'da-DK')
    assert.equal(chooseDemoLocale('de-AT'), 'de-DE')
    assert.equal(chooseDemoLocale('fr-FR'), 'en-GB')
    assert.equal(chooseDemoLocale(undefined), 'en-GB')
})

test('demo catalogs illustrate fixed and parameterized Capillary UI messages', () => {
    const danish = getDemoLocale('da-DK').capillaryUiMessages
    const german = getDemoLocale('de-DE').capillaryUiMessages
    assert.equal(danish.dialogCloseLabel, 'Luk')
    assert.equal(danish.tableSortColumnLabel?.('Navn'), 'Sortér Navn')
    assert.equal(danish.treeViewLoading, 'Indlæser træelementer…')
    assert.equal(german.dropdownPlaceholder, 'Auswählen…')
    assert.equal(german.tableFilterColumnLabel?.('Status'), 'Status filtern')
})
