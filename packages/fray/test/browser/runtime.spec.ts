import {expect, test} from '@playwright/test'
import {AxeBuilder} from '@axe-core/playwright'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const minimalThemePath = fileURLToPath(new URL('../../themes/minimal/theme.css', import.meta.url))
const modernThemePaths = ['minimal', 'java', 'shiny'].map((name) => ({
    name,
    path: fileURLToPath(new URL(`../../themes/${name}/theme.css`, import.meta.url)),
}))
const colorPaths = [
    'iceblue', 'ocean', 'green', 'gray', 'orange', 'purple', 'red', 'yellow',
].map((name) => ({
    name,
    path: fileURLToPath(new URL(`../../colors/${name}/colors.css`, import.meta.url)),
}))

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.frayTestReady === true)
    await page.addStyleTag({content: await readFile(minimalThemePath, 'utf8')})
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
            const header = element.querySelector<HTMLElement>(':scope > header')
            if (contentElement == null || header == null) throw new Error('Missing Sidebar parts')
            return {
                rootOverflow: getComputedStyle(element).overflow,
                contentOverflowY: getComputedStyle(contentElement).overflowY,
                contentClientHeight: contentElement.clientHeight,
                contentScrollHeight: contentElement.scrollHeight,
                headerOffsetTop: header.getBoundingClientRect().top
                    - element.getBoundingClientRect().top,
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
        const headerOffsetTop = await sidebar.evaluate((element) => {
            const header = element.querySelector<HTMLElement>(':scope > header')
            if (header == null) throw new Error('Missing Sidebar header')
            return header.getBoundingClientRect().top - element.getBoundingClientRect().top
        })
        expect(headerOffsetTop).toBe(before.headerOffsetTop)
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
    const archivedShell = archived.locator('+ .checkboxshell')
    await expect(archivedShell).toBeVisible()
    const shellMetrics = await archivedShell.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
            background: style.backgroundColor,
        }
    })
    expect(shellMetrics.width).toBeGreaterThan(0)
    expect(shellMetrics.height).toBeGreaterThan(0)
    expect(shellMetrics.background).not.toBe('rgba(0, 0, 0, 0)')
    await expect(archived).toBeFocused()
    await archived.press('Space')
    await expect(archived).toBeChecked()
    await expect(archivedShell).toHaveText('✓')

    await page.keyboard.press('Tab')
    const summary = page.getByRole('tab', {name: 'Summary'})
    await expect(summary).toBeFocused()
    await summary.press('ArrowRight')
    const details = page.getByRole('tab', {name: 'Details'})
    await expect(details).toBeFocused()
    await expect(details).toHaveAttribute('aria-selected', 'true')
})

test('History routing restores tabs, preserves focus, and cleans up', async ({page}) => {
    await page.goto('/browser-second?routing=true')
    await page.waitForFunction(() => globalThis.frayTestReady === true)
    const first = page.getByRole('tab', {name: 'First route'})
    const second = page.getByRole('tab', {name: 'Second route'})
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/\/browser-second\?routing=true$/)

    await second.focus()
    await second.press('ArrowLeft')
    await expect(first).toBeFocused()
    await expect(first).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/\/browser-first\?routing=true$/)

    await page.goBack()
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/\/browser-second\?routing=true$/)
    expect(await page.evaluate(() => globalThis.frayTest.destroyRouting())).toBe(0)
})

test('supports reduced motion and 200% configured text sizing', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'})
    const duration = await page.locator('#event-action').evaluate((element) => {
        element.setAttribute('style', 'animation: fray-test 5s linear infinite')
        return getComputedStyle(element).animationDuration
    })
    expect(Number.parseFloat(duration)).toBeLessThan(0.001)

    await page.goto('/?fontScale=200')
    await page.waitForFunction(() => globalThis.frayTestReady === true)
    await page.addStyleTag({content: await readFile(minimalThemePath, 'utf8')})
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
    await page.addStyleTag({content: await readFile(minimalThemePath, 'utf8')})
    await expect(page.locator('#accessibility-root button').first())
        .toHaveCSS('background-color', 'rgb(1, 2, 3)')
})

test('scopes every shipped theme and palette combination to opted-in content', async ({page}) => {
    for (const {path} of [...modernThemePaths, ...colorPaths]) {
        await page.addStyleTag({content: await readFile(path, 'utf8')})
    }
    await page.locator('body').evaluate((body) => {
        body.insertAdjacentHTML('beforeend', `
            <div id="theme-trait" class="coloredlike">Trait</div>
            <div data-theme-exclude>
                <div id="excluded-theme-trait" class="coloredlike">Excluded</div>
            </div>
            <div id="theme-island" data-theme="shiny" data-color="red">
                <div id="island-theme-trait" class="coloredlike">Island</div>
            </div>
        `)
    })

    const paletteAnchors = new Set<string>()
    const themeRadii = new Set<string>()
    for (const {name: theme} of modernThemePaths) {
        for (const {name: color} of colorPaths) {
            const values = await page.evaluate(({theme, color}) => {
                document.documentElement.dataset.theme = theme
                document.documentElement.dataset.color = color
                const root = getComputedStyle(document.documentElement)
                const trait = getComputedStyle(document.querySelector('#theme-trait')!)
                return {
                    primary: root.getPropertyValue('--palette-primary-500').trim(),
                    secondary: root.getPropertyValue('--palette-secondary-500').trim(),
                    neutral950: root.getPropertyValue('--palette-neutral-950').trim(),
                    radius: root.getPropertyValue('--radius-md').trim(),
                    traitBackground: trait.background,
                    traitColor: trait.color,
                }
            }, {theme, color})
            expect(values.primary, `${theme}/${color} primary`).not.toBe('')
            expect(values.secondary, `${theme}/${color} secondary`).not.toBe('')
            expect(values.neutral950, `${theme}/${color} neutral`).not.toBe('')
            expect(values.radius, `${theme}/${color} theme`).not.toBe('')
            expect(values.traitBackground, `${theme}/${color} coloredlike`).not.toBe('')
            expect(values.traitColor, `${theme}/${color} coloredlike contrast`).not.toBe('')
            paletteAnchors.add(values.primary)
            themeRadii.add(values.radius)
        }
    }
    expect(paletteAnchors.size).toBe(colorPaths.length)
    expect(themeRadii.size).toBe(modernThemePaths.length)

    const boundaries = await page.evaluate(() => {
        document.documentElement.dataset.theme = 'minimal'
        document.documentElement.dataset.color = 'iceblue'
        const root = getComputedStyle(document.documentElement)
        const excluded = getComputedStyle(document.querySelector('#excluded-theme-trait')!)
        const island = getComputedStyle(document.querySelector('#theme-island')!)
        const islandTrait = getComputedStyle(document.querySelector('#island-theme-trait')!)
        return {
            rootPrimary: root.getPropertyValue('--palette-primary-500').trim(),
            islandPrimary: island.getPropertyValue('--palette-primary-500').trim(),
            islandRadius: island.getPropertyValue('--radius-md').trim(),
            excludedBackgroundImage: excluded.backgroundImage,
            excludedBackgroundColor: excluded.backgroundColor,
            islandTraitBackground: islandTrait.background,
        }
    })
    expect(boundaries.islandPrimary).not.toBe(boundaries.rootPrimary)
    expect(boundaries.islandRadius).toBe('0.1875rem')
    expect(boundaries.excludedBackgroundImage).toBe('none')
    expect(boundaries.excludedBackgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(boundaries.islandTraitBackground).not.toBe('')
})

test('keeps 1,000-row stable table operations inside the documented budget',
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
