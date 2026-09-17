import {expect, test} from '@playwright/test'
import {AxeBuilder} from '@axe-core/playwright'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const baseThemePath = fileURLToPath(new URL('../../themes/base.css', import.meta.url))
const themePaths = ['minimal', 'java', 'shiny', 'original', 'scifi', 'soft', 'dark', 'glossy', 'white'].map((name) => ({
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
    const textbox = root.getByRole('textbox', {name: 'Busy text'})
    const select = root.getByRole('combobox', {name: 'Busy select'})
    const checkbox = root.getByRole('checkbox', {name: /Busy check/})

    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(button).toBeDisabled()
    for (const control of [textbox, select, checkbox]) {
        await expect(control).toHaveAttribute('aria-busy', 'true')
        await expect(control).toBeEnabled()
    }

    const animatedSurfaces = [
        {selector: '.busy-controls cap-button > button'},
        {selector: '.busy-controls cap-textbox > input'},
        {selector: '.busy-controls cap-dropdown > cap-selectshell > select'},
        {selector: '.busy-controls cap-checkbox cap-checkshell'},
        {selector: '.busy-controls cap-progressbar > cap-content', pseudo: '::after'},
    ]
    for (const {selector, pseudo} of animatedSurfaces) {
        const presentation = await root.locator(selector).evaluate((element, pseudoElement) => {
            const style = getComputedStyle(element, pseudoElement)
            return {animationName: style.animationName, backgroundImage: style.backgroundImage}
        }, pseudo)
        expect(presentation.animationName, selector).toContain('cap-working-progress')
        expect(presentation.backgroundImage, selector).not.toBe('none')
    }
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
    ]
    for (const control of invalidControls) {
        await expect(control).toHaveAttribute('aria-invalid', 'true')
        const describedBy = await control.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        await expect(root.locator(`#${describedBy}`)).toHaveAttribute('role', 'alert')
    }

    const overlayAlerts = root.locator('.error-controls cap-error')
    const overlayMessages = overlayAlerts.locator('cap-errortext')
    await expect(overlayMessages).toHaveCount(4)
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

    const errorColor = await root.locator('.error-controls cap-erroricon').first()
        .evaluate((element) => getComputedStyle(element).borderColor)
    const paintedEdges = await root.evaluate(() => {
        const selectors = [
            '.error-controls cap-button > button',
            '.error-controls cap-textbox > input',
            '.error-controls cap-dropdown > cap-selectshell > select',
            '.error-controls cap-checkbox cap-checkshell',
        ]
        return selectors.map((selector) => {
            const element = document.querySelector(selector)
            if (element == null) throw new Error(`Missing error surface: ${selector}`)
            return getComputedStyle(element).borderColor
        })
    })
    expect(errorColor).not.toBe('')
    expect(new Set(paintedEdges)).toEqual(new Set([errorColor]))

    const compactAlert = root.locator('.compact-error cap-error')
    const compactText = compactAlert.locator('cap-errortext')
    await expect(compactText).toBeHidden()
    await compactAlert.focus()
    await expect(compactText).toBeVisible()
    await expect(compactText).toHaveText('Compact error details')

    const {violations} = await new AxeBuilder({page}).include('#status-root').analyze()
    expect(violations.filter(({impact}) => impact === 'serious' || impact === 'critical'))
        .toEqual([])
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
                error: getComputedStyle(icon).borderColor,
            }
        })
        expect(presentation.animation, name).toContain('cap-working-progress')
        expect(presentation.background, name).not.toBe('none')
        expect(presentation.border, name).toBe(presentation.error)
        await theme.evaluate((element) => element.parentNode?.removeChild(element))
    }
})
