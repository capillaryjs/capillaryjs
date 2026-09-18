import {expect, test} from '@playwright/test'
import {AxeBuilder} from '@axe-core/playwright'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const baseThemePath = fileURLToPath(new URL('../../themes/base.css', import.meta.url))
const themePaths = ['capillary', 'shiny', 'soft', 'white', 'minimal'].map((name) => ({
    name,
    path: fileURLToPath(new URL(`../../themes/${name}/theme.css`, import.meta.url)),
}))

test.beforeEach(async ({page}) => {
    await page.goto('/?status=true')
    await page.waitForFunction(() => globalThis.capillaryUiTestReady === true)
    await page.addStyleTag({content: await readFile(baseThemePath, 'utf8')})
    await page.addStyleTag({content: await readFile(themePaths[0]!.path, 'utf8')})
})

test('busy controls animate their painted surface without disabling inputs', async ({page}) => {
    const root = page.locator('#status-root')
    const button = root.getByRole('button', {name: 'Busy action'})
    const normalButton = root.getByRole('button', {name: 'Normal action'})
    const textbox = root.getByRole('textbox', {name: 'Busy text'})
    const select = root.getByRole('combobox', {name: 'Busy select'})
    const checkbox = root.getByRole('checkbox', {name: /Busy check/})
    const progressBars = root.locator('.busy-controls cap-progressbar')

    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(button).toBeDisabled()
    const buttonChrome = await Promise.all(['color', 'borderTopColor', 'borderRadius', 'boxShadow']
        .map((property) => Promise.all([
            button.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property),
            normalButton.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property),
        ])))
    for (const [busyValue, normalValue] of buttonChrome) {
        expect(busyValue, 'busy button keeps normal button chrome').toBe(normalValue)
    }
    for (const control of [textbox, select, checkbox]) {
        await expect(control).toHaveAttribute('aria-busy', 'true')
        await expect(control).toBeEnabled()
    }

    const animatedSurfaces = [
        {selector: '.busy-controls cap-button:first-of-type > button'},
        {selector: '.busy-controls cap-textbox > input'},
        {selector: '.busy-controls cap-dropdown > cap-selectshell > select'},
        {selector: '.busy-controls cap-checkbox cap-checkshell'},
        {selector: '.busy-controls cap-progressbar:nth-of-type(1) > cap-content', pseudo: '::after'},
    ]
    for (const {selector, pseudo} of animatedSurfaces) {
        const presentation = await root.locator(selector).evaluate((element, pseudoElement) => {
            const style = getComputedStyle(element, pseudoElement)
            return {animationName: style.animationName, backgroundImage: style.backgroundImage}
        }, pseudo)
        expect(presentation.animationName, selector).toContain('cap-working-progress')
        expect(presentation.backgroundImage, selector).not.toBe('none')
    }
    await expect(progressBars.nth(0).locator('progress')).toHaveAttribute('aria-busy', 'true')
    await expect(progressBars.nth(1).locator('progress')).not.toHaveAttribute('aria-busy')
    expect(await progressBars.nth(1).locator('cap-content').evaluate((element) => ({
        animation: getComputedStyle(element, '::after').animationName,
        background: getComputedStyle(element, '::after').backgroundImage,
    }))).toEqual({animation: 'none', background: 'none'})
})

test('data components replace initial data but retain rows during background loading', async ({page}) => {
    const root = page.locator('#status-root')
    const initial = root.locator('.initial-data')
    await expect(initial.locator('cap-datatable tbody > tr[aria-hidden="true"]'))
        .toHaveCount(2)
    await expect(initial.locator('cap-listview > ul[aria-hidden="true"] > li')).toHaveCount(2)
    await expect(initial.locator('cap-treeview > ul[aria-hidden="true"] > li')).toHaveCount(2)
    await expect(initial.locator('cap-placeholder')).toHaveCount(6)

    const retained = root.locator('.retained-data')
    await expect(retained.locator('cap-datatable > table')).toHaveAttribute('aria-busy', 'true')
    await expect(retained.locator('cap-listview'))
        .toHaveAttribute('aria-busy', 'true')
    await expect(retained.locator('cap-treeview'))
        .toHaveAttribute('aria-busy', 'true')

    const retainedCollections = [
        retained.locator('cap-datatable'),
        retained.locator('cap-listview'),
        retained.locator('cap-treeview'),
    ]
    for (const collection of retainedCollections) {
        await expect(collection).toHaveAttribute('data-cap-retained-loading', '')
        const presentation = await collection.evaluate((element) => {
            const style = getComputedStyle(element, '::after')
            return {animationName: style.animationName, backgroundImage: style.backgroundImage}
        })
        expect(presentation.animationName).toContain('cap-working-progress')
        expect(presentation.backgroundImage).not.toBe('none')
    }

    await expect(retained.locator('[data-cap-selectable-row]')).toHaveCount(4)
    await expect(retained.getByRole('treeitem')).toHaveCount(2)
    await expect(retained.locator('cap-placeholder')).toHaveCount(0)

    const failed = root.locator('.error-data')
    await expect(failed.getByRole('alert')).toHaveCount(3)
    await expect(failed.getByRole('alert')).toContainText([
        'Status data unavailable',
        'Status data unavailable',
        'Status data unavailable',
    ])
    await expect(failed.locator('[data-cap-selectable-row]')).toHaveCount(4)
    await expect(failed.getByRole('treeitem')).toHaveCount(2)
})

test('errors mark controls and expose overlay details on icon hover or focus', async ({page}) => {
    const root = page.locator('#status-root')
    const invalidControls = [
        root.getByRole('button', {name: 'Failed action'}),
        root.getByRole('textbox', {name: 'Invalid text'}),
        root.getByRole('combobox', {name: 'Invalid select'}),
        root.getByRole('checkbox', {name: /Invalid check/}),
        root.getByRole('radio', {name: 'Invalid radio'}),
    ]
    for (const control of invalidControls) {
        await expect(control).toHaveAttribute('aria-invalid', 'true')
        const describedBy = await control.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        await expect(root.locator(`#${describedBy}`)).toHaveAttribute('role', 'alert')
    }

    const overlayAlerts = root.locator('.error-controls cap-error')
    const overlayMessages = overlayAlerts.locator('cap-errortext')
    await expect(overlayMessages).toHaveCount(5)
    for (const message of await overlayMessages.all()) await expect(message).toBeHidden()
    const firstAlert = overlayAlerts.first()
    const firstMessage = firstAlert.locator('cap-errortext')
    const positioning = await firstAlert.evaluate((alert) => ({
        alert: getComputedStyle(alert).position,
        icon: getComputedStyle(alert.querySelector('cap-erroricon')!).position,
        message: getComputedStyle(alert.querySelector('cap-errortext')!).position,
    }))
    expect(positioning).toEqual({alert: 'absolute', icon: 'absolute', message: 'absolute'})
    await firstAlert.locator('cap-erroricon').hover()
    await expect(firstMessage).toBeVisible()

    const errorIcon = root.locator('.error-controls cap-erroricon').first()
    const [errorBadge, paintedControls, errorHalos] = await Promise.all([
        errorIcon.evaluate((element) => ({
            background: getComputedStyle(element).backgroundColor,
            border: getComputedStyle(element).borderColor,
            boxShadow: getComputedStyle(element).boxShadow,
        })),
        root.evaluate(() => {
        const selectors = [
            '.error-controls cap-button > button',
            '.error-controls cap-textbox > input',
            '.error-controls cap-dropdown > cap-selectshell > select',
            '.error-controls cap-checkbox cap-checkshell',
        ]
        return selectors.map((selector) => {
            const element = document.querySelector(selector)
            if (element == null) throw new Error(`Missing error surface: ${selector}`)
            return {
                border: getComputedStyle(element).borderColor,
                boxShadow: getComputedStyle(element).boxShadow,
            }
        })
        }),
        root.evaluate(() => [
            '.error-controls cap-button > button',
            '.error-controls cap-textbox > input',
            '.error-controls cap-dropdown > cap-selectshell',
        ].map((selector) => {
            const element = document.querySelector(selector)
            if (element == null) throw new Error(`Missing error halo: ${selector}`)
            return getComputedStyle(element).boxShadow
        })),
    ])
    expect(errorBadge.background).not.toBe('')
    expect(errorBadge.border).not.toBe(errorBadge.background)
    expect(errorBadge.boxShadow).not.toBe('none')
    expect(new Set(paintedControls.map(({border}) => border)).size).toBe(1)
    expect(errorHalos.every((boxShadow) => boxShadow !== 'none')).toBe(true)

    const labelHalos = await root.evaluate(() => [
        '.error-controls cap-checkbox > label',
        '.error-controls cap-radiobutton > label',
    ].map((selector) => {
        const element = document.querySelector(selector)
        if (element == null) throw new Error(`Missing error label halo: ${selector}`)
        return getComputedStyle(element).boxShadow
    }))
    expect(labelHalos.every((boxShadow) => boxShadow !== 'none')).toBe(true)

    await page.mouse.move(0, 0)
    await expect(firstMessage).toBeHidden()
    const compactAlert = root.locator('.compact-error cap-error')
    const compactText = compactAlert.locator('cap-errortext')
    await expect(compactText).toBeHidden()
    await compactAlert.focus()
    await expect(compactText).toBeVisible()
    await expect(compactText).toHaveText('Compact error details')
    // Visibility becomes true at the start of the fade. Measure contrast only
    // once the message is fully opaque, not against a transient blended color.
    await expect(compactText).toHaveCSS('opacity', '1')

    const {violations} = await new AxeBuilder({page}).include('#status-root').analyze()
    expect(violations.filter(({impact}) => impact === 'serious' || impact === 'critical'))
        .toEqual([])
})

test('required controls use base negative markers in their intended positions', async ({page}) => {
    const presentation = await page.evaluate(() => {
        const required = <T extends Element>(selector: string): T => {
            const element = document.querySelector<T>(selector)
            if (element == null) throw new Error(`Missing required-control fixture: ${selector}`)
            return element
        }
        const pseudo = (element: Element) => {
            const style = getComputedStyle(element, '::after')
            return {
                content: style.content,
                color: style.color,
                backgroundColor: style.backgroundColor,
                width: style.width,
                height: style.height,
                fontSize: style.fontSize,
                top: Number.parseFloat(style.top),
                right: Number.parseFloat(style.right),
            }
        }
        const text = required<HTMLInputElement>('#accessibility-root cap-textbox > input')
        text.value = ''
        text.required = true

        const select = required<HTMLSelectElement>(
            '#accessibility-root cap-dropdown > cap-selectshell > select')
        const placeholder = document.createElement('option')
        placeholder.value = ''
        placeholder.selected = true
        select.prepend(placeholder)
        select.required = true
        select.value = ''

        const checkbox = required<HTMLInputElement>('#accessibility-root cap-checkbox > label > input')
        checkbox.required = true
        checkbox.checked = false

        const radio = required<HTMLInputElement>('#status-root cap-radiobutton > label > input')
        radio.removeAttribute('aria-invalid')
        radio.name = 'required-radio-probe'
        radio.required = true
        radio.checked = false

        const negativeProbe = document.createElement('span')
        negativeProbe.style.color = 'var(--negative-color)'
        document.body.append(negativeProbe)
        const negativeColor = getComputedStyle(negativeProbe).color
        negativeProbe.remove()

        const textHost = required('cap-textbox')
        const selectHost = required('cap-dropdown')
        const checkboxLabel = required('cap-checkbox > label')
        const radioLabel = required('cap-radiobutton > label')
        const textInput = text.getBoundingClientRect()
        const textHostBounds = textHost.getBoundingClientRect()
        const selectShellBounds = required('cap-dropdown > cap-selectshell').getBoundingClientRect()
        const selectHostBounds = selectHost.getBoundingClientRect()

        return {
            validities: [text, select, checkbox, radio].map((input) => input.matches(':invalid')),
            negativeColor,
            text: pseudo(textHost),
            select: pseudo(selectHost),
            checkbox: {...pseudo(checkboxLabel), paddingRight: getComputedStyle(checkboxLabel).paddingRight},
            radio: {...pseudo(radioLabel), paddingRight: getComputedStyle(radioLabel).paddingRight},
            textInputTop: textInput.top - textHostBounds.top,
            selectInputTop: selectShellBounds.top - selectHostBounds.top,
            selectTriggerWidth: Number.parseFloat(
                getComputedStyle(required('cap-dropdown > cap-selectshell'), '::before').width),
        }
    })

    expect(presentation.validities).toEqual([true, true, true, true])
    for (const marker of [presentation.text, presentation.select,
        presentation.checkbox, presentation.radio]) {
        expect(marker.content).toBe('"✲"')
        expect(marker.color).toBe(presentation.negativeColor)
        expect(marker.backgroundColor).toBe('rgba(0, 0, 0, 0)')
        expect([marker.width, marker.height, marker.fontSize]).toEqual([
            presentation.text.width,
            presentation.text.height,
            presentation.text.fontSize,
        ])
    }
    expect(presentation.text.top).toBeGreaterThanOrEqual(presentation.textInputTop)
    expect(presentation.text.right).toBeGreaterThan(0)
    expect(presentation.select.top).toBeGreaterThanOrEqual(presentation.selectInputTop)
    expect(presentation.select.right).toBeGreaterThan(presentation.selectTriggerWidth)
    for (const marker of [presentation.checkbox, presentation.radio]) {
        expect(marker.top).toBeLessThan(0)
        expect(marker.right).toBe(0)
        expect(Number.parseFloat(marker.paddingRight)).toBeGreaterThan(0)
    }
})

test('status presentation respects reduced motion', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'})
    await page.reload()
    await page.waitForFunction(() => globalThis.capillaryUiTestReady === true)
    await page.addStyleTag({content: await readFile(baseThemePath, 'utf8')})
    await page.addStyleTag({content: await readFile(themePaths[0]!.path, 'utf8')})
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
        .toBe(true)
    const busyInput = page.locator('#status-root .busy-controls cap-textbox > input')
    const placeholder = page.locator('#status-root .initial-data cap-placeholder').first()
    await expect(busyInput).toHaveCSS('animation-name', 'none')
    expect(await placeholder.evaluate((element) =>
        getComputedStyle(element, '::after').animationName)).toBe('none')
})

test('status presentation retains visible edges in forced colors', async ({page, browserName}) => {
    test.skip(browserName !== 'chromium', 'Playwright forced-colors emulation is Chromium-only')
    await page.emulateMedia({forcedColors: 'active'})
    const invalidInput = page.getByRole('textbox', {name: 'Invalid text'})
    const outline = await invalidInput.evaluate((element) => {
        const style = getComputedStyle(element)
        return {style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth)}
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThanOrEqual(2)
})

test('busy and error presentation remains active across shipped themes', async ({page}) => {
    for (const {name, path} of themePaths) {
        const theme = await page.addStyleTag({content: await readFile(path, 'utf8')})
        const presentation = await page.evaluate(() => {
            const busy = document.querySelector('.busy-controls cap-textbox > input')
            const invalid = document.querySelector('.error-controls cap-textbox > input')
            const icon = document.querySelector('.error-controls cap-erroricon')
            if (busy == null || invalid == null || icon == null) {
                throw new Error('Missing themed status controls')
            }
            return {
                animation: getComputedStyle(busy).animationName,
                background: getComputedStyle(busy).backgroundImage,
                border: getComputedStyle(invalid).borderColor,
                error: getComputedStyle(icon).backgroundColor,
                halo: getComputedStyle(invalid).boxShadow,
            }
        })
        expect(presentation.animation, name).toContain('cap-working-progress')
        expect(presentation.background, name).not.toBe('none')
        expect(presentation.border, name).not.toBe(presentation.error)
        expect(presentation.halo, name).not.toBe('none')
        await theme.evaluate((element) => element.parentNode?.removeChild(element))
    }
})
