import {expect, test} from '@playwright/test'
import {AxeBuilder} from '@axe-core/playwright'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const lightThemePath = fileURLToPath(new URL('../../themes/light.css', import.meta.url))

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.frayTestReady === true)
    await page.addStyleTag({content: await readFile(lightThemePath, 'utf8')})
})

test('stable controls expose names and no serious automated accessibility violations',
    async ({page}) => {
        await expect(page.getByRole('heading', {name: 'Accessible controls'})).toBeVisible()
        await expect(page.getByRole('toolbar', {name: 'Editor actions'})).toBeVisible()
        await expect(page.getByRole('button', {name: 'Save'})).toBeEnabled()
        await expect(page.getByRole('textbox', {name: 'Name'})).toBeVisible()
        await expect(page.getByRole('combobox', {name: 'Role'})).toBeVisible()
        await expect(page.getByRole('radiogroup', {name: 'View'})).toBeVisible()
        await expect(page.getByRole('checkbox', {name: /Include archived/})).toBeVisible()
        await expect(page.getByRole('tablist', {name: 'Profile sections'})).toBeVisible()

        const {violations} = await new AxeBuilder({page})
            .include('#accessibility-root')
            .include('#sidebar-root')
            .analyze()
        expect(violations.filter(({impact}) => impact === 'serious' || impact === 'critical'))
            .toEqual([])
    })

test('Sidebar keeps its labelled header and toolbar outside the scrolling content',
    async ({page}) => {
        const sidebar = page.getByRole('complementary', {name: 'Scrollable requests'})
        const content = sidebar.locator(':scope > [data-part="content"]')
        await expect(sidebar).toBeVisible()
        await expect(sidebar.getByRole('toolbar', {name: 'Request actions'})).toBeVisible()

        const before = await sidebar.evaluate((element) => {
            const contentElement = element.querySelector<HTMLElement>('[data-part="content"]')
            const header = element.querySelector<HTMLElement>('[data-part="header"]')
            if (contentElement == null || header == null) throw new Error('Missing Sidebar parts')
            return {
                rootOverflow: getComputedStyle(element).overflow,
                contentOverflowY: getComputedStyle(contentElement).overflowY,
                contentClientHeight: contentElement.clientHeight,
                contentScrollHeight: contentElement.scrollHeight,
                headerTop: header.getBoundingClientRect().top,
            }
        })
        expect(before.rootOverflow).toBe('hidden')
        expect(before.contentOverflowY).toBe('auto')
        expect(before.contentScrollHeight).toBeGreaterThan(before.contentClientHeight)

        await content.focus()
        await expect(content).toBeFocused()
        await content.evaluate((element) => element.scrollTo({top: element.scrollHeight}))
        await expect(content).toHaveJSProperty('scrollTop',
            before.contentScrollHeight - before.contentClientHeight)
        const headerTop = await sidebar.locator(':scope > [data-part="header"]')
            .evaluate((element) => element.getBoundingClientRect().top)
        expect(headerTop).toBe(before.headerTop)
    })

test('record-view primitives retain semantics, keyboard behavior, and dialog focus',
    async ({page}) => {
        const root = page.locator('#record-primitives-root')
        await expect(root.getByRole('heading', {name: 'Record-view primitives'}))
            .toBeVisible()
        await expect(root.locator('dl[aria-label="Record summary"] dt'))
            .toHaveText(['Severity', 'Owner'])
        await expect(root.locator('dl[aria-label="Record summary"] dd'))
            .toHaveText(['High', 'Example team'])
        await expect(root.getByRole('region', {name: 'Project navigation'})).toBeVisible()
        await expect(root.getByRole('region', {name: 'Refresh status'})).toBeVisible()

        const progress = root.getByRole('progressbar', {name: 'Projects processed'})
        await expect(progress).not.toHaveAttribute('value')
        await page.evaluate(() => globalThis.frayTest.setProgress(2))
        await expect(progress).toHaveAttribute('value', '2')
        await expect(progress).toHaveAttribute('aria-valuetext', '50%')
        await expect(root.getByRole('button', {name: 'Refreshing…'})).toBeDisabled()

        const tree = root.getByRole('tree', {name: 'Security projects'})
        const workspace = tree.getByRole('treeitem', {name: 'Workspace'})
        await workspace.focus()
        await workspace.press('ArrowRight')
        await expect(workspace).toHaveAttribute('aria-expanded', 'true')
        await workspace.press('ArrowRight')
        const service = tree.getByRole('treeitem', {name: 'Service Alpha'})
        await expect(service).toBeFocused()
        await service.press('Enter')
        await expect(service).toHaveAttribute('aria-selected', 'true')

        const opener = root.getByRole('button', {name: 'Open reset dialog'})
        await opener.focus()
        await opener.press('Enter')
        const dialog = page.getByRole('dialog', {name: 'Reset scenario?'})
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('button', {name: 'Confirm reset'})).toBeFocused()
        await dialog.press('Escape')
        await expect(dialog).toBeHidden()
        await expect(opener).toBeFocused()

        const {violations} = await new AxeBuilder({page})
            .include('#record-primitives-root')
            .analyze()
        expect(violations.filter(({impact}) => impact === 'serious' || impact === 'critical'))
            .toEqual([])
    })

test('stable controls remain operable through the real browser keyboard model', async ({page}) => {
    const save = page.getByRole('button', {name: 'Save'})
    await save.focus()
    await expect(save).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', {name: 'Name'})).toBeFocused()

    await page.keyboard.press('Tab')
    const role = page.getByRole('combobox', {name: 'Role'})
    await expect(role).toBeFocused()
    await role.press('r')

    await page.keyboard.press('Tab')
    await expect(role).toHaveValue('reviewer')
    const list = page.getByRole('radio', {name: 'List'})
    await expect(list).toBeFocused()
    await list.press('ArrowRight')
    const grid = page.getByRole('radio', {name: 'Grid'})
    await expect(grid).toBeFocused()
    await expect(grid).toHaveAttribute('aria-checked', 'true')

    await page.keyboard.press('Tab')
    const archived = page.getByRole('checkbox', {name: /Include archived/})
    await expect(archived).toBeFocused()
    await archived.press('Space')
    await expect(archived).toHaveAttribute('aria-checked', 'true')

    await page.keyboard.press('Tab')
    const summary = page.getByRole('tab', {name: 'Summary'})
    await expect(summary).toBeFocused()
    await summary.press('ArrowRight')
    const details = page.getByRole('tab', {name: 'Details'})
    await expect(details).toBeFocused()
    await expect(details).toHaveAttribute('aria-selected', 'true')
})

test('supports reduced motion and 200% configured text sizing', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'})
    const duration = await page.locator('#event-action').evaluate((element) => {
        element.setAttribute('style', 'animation: fray-test 5s linear infinite')
        return getComputedStyle(element).animationDuration
    })
    expect(Number.parseFloat(duration)).toBeLessThan(0.001)

    await page.evaluate(() => {
        document.documentElement.style.setProperty('--base-font-size', '28px')
        document.documentElement.style.setProperty('--ui-font-size', '28px')
    })
    const typography = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement)
        return {
            base: style.getPropertyValue('--base-font-size').trim(),
            ui: style.getPropertyValue('--ui-font-size').trim(),
        }
    })
    expect(typography).toEqual({base: '28px', ui: '28px'})
    await expect(page.getByRole('button', {name: 'Save'})).toHaveCSS('font-size', '28px')
    const metrics = await page.locator('#accessibility-root button, '
        + '#accessibility-root input, #accessibility-root select').evaluateAll((elements) =>
        elements.map((element) => {
            const htmlElement = element as HTMLElement
            const style = getComputedStyle(htmlElement)
            return {
                element: `${htmlElement.tagName.toLowerCase()}.${htmlElement.className}`,
                baseFontSize: style.getPropertyValue('--base-font-size').trim(),
                uiFontSize: style.getPropertyValue('--ui-font-size').trim(),
                fontSize: Number.parseFloat(style.fontSize),
                clientHeight: htmlElement.clientHeight,
                scrollHeight: htmlElement.scrollHeight,
                overflowY: style.overflowY,
                clipped: htmlElement.scrollHeight > htmlElement.clientHeight + 1,
            }
        }))
    expect(metrics.length).toBeGreaterThan(0)
    expect(metrics.filter(({fontSize}) => fontSize < 28)).toEqual([])
    expect(metrics.filter(({clipped}) => clipped)).toEqual([])
})

test('keeps keyboard focus visible in forced-colors mode', async ({page, browserName}) => {
    test.skip(browserName !== 'chromium', 'Playwright forced-colors emulation is Chromium-only')
    await page.emulateMedia({forcedColors: 'active'})
    const button = page.getByRole('button', {name: 'Save'})
    await button.focus()
    await expect(button).toBeFocused()
    const outline = await button.evaluate((element) => {
        const style = getComputedStyle(element)
        return {style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth)}
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThanOrEqual(2)
})

test('consumer theme variables override a later-loaded theme stylesheet', async ({page}) => {
    await page.addStyleTag({content: `
        .consumer-override { --button-background: rgb(1 2 3); }
    `})
    await page.locator('#accessibility-root button').first()
        .evaluate((element) => element.classList.add('consumer-override'))
    await page.addStyleTag({content: await readFile(lightThemePath, 'utf8')})
    await expect(page.locator('#accessibility-root button').first())
        .toHaveCSS('background-color', 'rgb(1, 2, 3)')
})

test('keeps 1,000-row experimental table operations inside the alpha budget',
    async ({page, browserName}) => {
        const metrics = await page.evaluate(() => globalThis.frayTest.measureDataTable(1_000))
        console.log(`[${browserName}] DataTable 1000x${metrics.columnCount}: `
            + `initial=${metrics.initialRenderMs.toFixed(1)}ms, `
            + `rerender=${metrics.rerenderMs.toFixed(1)}ms, `
            + `sort=${metrics.sortMs.toFixed(1)}ms, `
            + `filter=${metrics.filterMs.toFixed(1)}ms, `
            + `selection=${metrics.selectionMs.toFixed(1)}ms`)

        expect(metrics.renderedRows).toBe(500)
        expect(metrics.selectedRows).toBe(1)
        expect(metrics.initialRenderMs).toBeLessThan(2_000)
        expect(metrics.rerenderMs).toBeLessThan(1_000)
        expect(metrics.sortMs).toBeLessThan(1_000)
        expect(metrics.filterMs).toBeLessThan(1_000)
        expect(metrics.selectionMs).toBeLessThan(1_000)
    })

test('preserves browser-managed input state and replaces event handlers', async ({page}) => {
    const input = page.getByLabel('Message')
    await input.focus()
    await input.press('End')
    await input.pressSequentially('!')

    await expect(input).toHaveValue('hello!')
    await expect(input).toBeFocused()
    expect(await input.evaluate((element) => ({
        start: (element as HTMLInputElement).selectionStart,
        end: (element as HTMLInputElement).selectionEnd,
        preserved: globalThis.frayTest.inputNodePreserved,
    }))).toEqual({start: 6, end: 6, preserved: true})

    await page.evaluate(() => {
        for (let revision = 1; revision <= 5; revision += 1) {
            globalThis.frayTest.setRevision(revision)
        }
    })
    await page.locator('#event-action').click()
    expect(await page.evaluate(() => globalThis.frayTest.clicks)).toBe(1)
})

test('patches properties and keyed children without replacing nodes', async ({page}) => {
    await page.evaluate(() => {
        globalThis.frayTest.setBoolean(false)
        globalThis.frayTest.reorder(['c', 'a', 'b'])
    })

    const checkbox = page.locator('#boolean-input')
    await expect(checkbox).not.toBeChecked()
    await expect(checkbox).toBeEnabled()
    await expect(checkbox).not.toHaveAttribute('required', '')
    await expect(page.locator('#keyed-list li')).toHaveText(['c', 'a', 'b'])
    expect(await page.evaluate(() => globalThis.frayTest.keyedNodesPreserved())).toBe(true)
})

test('destroys removed children once and supports all documented vnode forms', async ({page}) => {
    expect(await page.evaluate(() => ({
        counts: globalThis.frayTest.lifecycleCounts,
        subscribers: globalThis.frayTest.childSubscribers,
    }))).toEqual({counts: {initialize: 1, destroy: 0}, subscribers: 1})

    await page.evaluate(() => globalThis.frayTest.hideChild())
    await expect(page.locator('#child-probe')).toHaveCount(0)
    expect(await page.evaluate(() => ({
        counts: globalThis.frayTest.lifecycleCounts,
        subscribers: globalThis.frayTest.childSubscribers,
    }))).toEqual({counts: {initialize: 1, destroy: 1}, subscribers: 0})

    await page.evaluate(() => globalThis.frayTest.destroyParentTwice())
    expect(await page.evaluate(() => globalThis.frayTest.lifecycleCounts.destroy)).toBe(1)
    await expect(page.locator('#forms-root')).toContainText('prefix7samesame')
    await expect(page.locator('#h-form')).toHaveText('same')
    await expect(page.locator('#jsx-form')).toHaveText('same')
})
