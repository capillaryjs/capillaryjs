import {expect, test} from '@playwright/test'

test.use({baseURL: 'http://127.0.0.1:4175'})

test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 2000, height: 1100})
    await page.goto('/#/line-inputs')
    await page.locator('#gallery-line-inputs').waitFor()
})

for (const variant of ['App shell', 'Website']) {
    test(`${variant}: one island, one toolbar, three navigable rows and centered sidebar`, async ({page}) => {
        await page.getByRole('radio', {name: variant, exact: true}).click()
        await expect(page.locator('.gallery-main cap-panel')).toHaveCount(1)
        await expect(page.locator('.gallery-main cap-toolbar')).toHaveCount(1)
        for (const [id, count] of [['checkboxes', 3], ['basic-inputs', 6], ['date-time', 3]] as const) {
            const section = page.locator(`#gallery-${id}`)
            await expect(section).toHaveCount(1)
            await expect(section.locator(':scope > cap-content > cap-layout.gallery-group-row > cap-groupbox'))
                .toHaveCount(count)
            if (id === 'basic-inputs') {
                await expect(section.getByRole('combobox', {name: 'Display mode', exact: true}))
                    .toBeVisible()
                await expect(section.getByRole('combobox', {name: 'Choose a report presentation', exact: true}))
                    .toBeVisible()
                await expect(section.getByRole('radiogroup', {name: 'Density', exact: true}))
                    .toBeVisible()
                await expect(section.getByRole('radiogroup', {name: 'Choose the report presentation', exact: true}))
                    .toBeVisible()
            }
        }
        const margins = await page.locator('.gallery-control-demo').evaluate((e) => {
            const parent = e.getBoundingClientRect()
            const group = e.querySelector('cap-groupbox')!.getBoundingClientRect()
            return [group.left - parent.left, parent.right - group.right]
        })
        expect(margins[0]).toBeCloseTo(12, 1)
        expect(margins[1]).toBeCloseTo(12, 1)
        await page.setViewportSize({width: 900, height: 700})
        await page.getByRole('button', {name: 'Date and time', exact: true}).click()
        await expect(page.locator('#gallery-date-time').getByText('DatePicker', {exact: true}))
            .toBeInViewport()
    })
}

test('section rules and natural columns retain usable control floors', async ({page}) => {
    await page.setViewportSize({width: 2000, height: 1100})
    const section = page.locator('#gallery-basic-inputs')
    const groups = section.locator(':scope > cap-content > cap-layout.gallery-group-row > cap-groupbox')
    const group = groups.first()
    const field = group.getByRole('textbox', {name: 'Long value', exact: true})
    expect((await field.boundingBox())!.width).toBeCloseTo(180, 1)
    expect((await section.getByRole('combobox', {name: 'Choice', exact: true}).boundingBox())!.width)
        .toBeCloseTo(180, 1)

    const chrome = await section.evaluate((element) => {
        const header = element.querySelector<HTMLElement>(':scope > cap-header')!
        const columns = element.querySelectorAll<HTMLElement>(
            ':scope > cap-content > cap-layout > cap-groupbox',
        )
        const firstHeader = columns[0]?.querySelector<HTMLElement>(':scope > cap-header')!
        const secondColumn = columns[1]!
        const sectionStyle = getComputedStyle(element)
        const firstStyle = getComputedStyle(columns[0]!)
        const secondStyle = getComputedStyle(secondColumn)
        return {
            sectionBorderTop: sectionStyle.borderTopWidth,
            sectionFont: Number.parseFloat(getComputedStyle(header).fontSize),
            columnFont: Number.parseFloat(getComputedStyle(firstHeader).fontSize),
            columnWeight: Number.parseFloat(getComputedStyle(firstHeader).fontWeight),
            columnHeaderMarginEnd: Number.parseFloat(getComputedStyle(firstHeader).marginBlockEnd),
            firstTop: firstStyle.borderTopWidth,
            firstBottom: firstStyle.borderBottomWidth,
            secondInlineStart: secondStyle.borderLeftWidth,
        }
    })
    expect(chrome.sectionBorderTop).toBe('0px')
    expect(chrome.sectionFont).toBeGreaterThan(chrome.columnFont)
    expect(chrome.columnWeight).toBeGreaterThanOrEqual(600)
    expect(chrome.columnHeaderMarginEnd).toBeGreaterThan(0)
    expect(chrome.firstTop).toBe('0px')
    expect(chrome.firstBottom).toBe('0px')
    expect(chrome.secondInlineStart).toBe('1px')

    const checkboxGroups = page.locator(
        '#gallery-checkboxes > cap-content > cap-layout.gallery-group-row > cap-groupbox',
    )
    const checkboxWidths = await checkboxGroups
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().width))
    expect(Math.max(...checkboxWidths)).toBeLessThan(180)
    await page.locator('#gallery-checkboxes').evaluate((e) => {
        e.style.setProperty('--groupbox-preferred-width', '18rem')
    })
    expect((await checkboxGroups.first().boundingBox())!.width)
        .toBeCloseTo(checkboxWidths[0]!, 1)

    await section.evaluate((e) => { e.style.width = '400px' })
    const wrappedTops = await groups.evaluateAll((es) =>
        es.map((e) => e.getBoundingClientRect().top))
    expect(new Set(wrappedTops).size).toBeGreaterThan(1)
    for (const width of await section.locator('input:not([type="radio"]), select')
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().width))) {
        expect(width).toBeGreaterThanOrEqual(96)
    }
    await section.evaluate((e) => {
        e.style.width = 'auto'
        e.style.setProperty('--input-min-width', 'var(--input-width)')
    })
    await page.setViewportSize({width: 768, height: 700})
    expect((await field.boundingBox())!.width).toBeCloseTo(180, 1)
    await page.setViewportSize({width: 400, height: 700})
    const scrollOwner = page.locator('#gallery-line-inputs > .panel-content')
    expect(await scrollOwner.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true)
    expect(await scrollOwner.evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto')
})

test('nested GroupBox rules transpose and span the parent Layout cross-axis', async ({page}) => {
    const chrome = await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.style.cssText = 'position: fixed; left: -10000px; top: 0; width: 40rem'

        const group = (variant: 'section' | 'column', size: string) => {
            const element = document.createElement('cap-groupbox')
            element.className = `cap-groupbox-${variant}`
            const header = document.createElement('cap-header')
            header.textContent = variant
            const content = document.createElement('cap-content')
            const body = document.createElement('div')
            body.style.cssText = `width: ${size}; height: ${size}`
            content.append(body)
            element.append(header, content)
            return element
        }
        const layout = (axis: 'horizontal' | 'vertical', variants: ('section' | 'column')[]) => {
            const element = document.createElement('cap-layout')
            element.className = `cap-layout-${axis}`
            variants.forEach((variant, index) => element.append(group(variant, index === 0 ? '2rem' : '8rem')))
            fixture.append(element)
            return element
        }

        const horizontalSections = layout('horizontal', ['section', 'section'])
        const horizontalColumns = layout('horizontal', ['column', 'column'])
        const verticalColumns = layout('vertical', ['column', 'column'])
        document.body.append(fixture)

        const dimensions = (element: Element) => {
            const groups = [...element.querySelectorAll<HTMLElement>(':scope > cap-groupbox')]
            return groups.map((item) => item.getBoundingClientRect())
        }
        const horizontalSectionItems = dimensions(horizontalSections)
        const horizontalColumnItems = dimensions(horizontalColumns)
        const verticalColumnItems = dimensions(verticalColumns)
        const horizontalSectionRule = getComputedStyle(
            horizontalSections.querySelector<HTMLElement>(':scope > cap-groupbox')!,
            '::before',
        )
        const secondHorizontalColumn = horizontalColumns.querySelectorAll<HTMLElement>(
            ':scope > cap-groupbox',
        )[1]!
        const secondVerticalColumn = verticalColumns.querySelectorAll<HTMLElement>(
            ':scope > cap-groupbox',
        )[1]!
        const result = {
            horizontalSectionHeights: horizontalSectionItems.map((item) => item.height),
            horizontalColumnHeights: horizontalColumnItems.map((item) => item.height),
            verticalColumnWidths: verticalColumnItems.map((item) => item.width),
            horizontalSectionRuleEnd: horizontalSectionRule.borderRightWidth,
            horizontalSectionRuleTop: horizontalSectionRule.borderTopWidth,
            horizontalColumnDivider: getComputedStyle(secondHorizontalColumn).borderLeftWidth,
            verticalColumnDivider: getComputedStyle(secondVerticalColumn).borderTopWidth,
        }
        fixture.remove()
        return result
    })

    expect(chrome.horizontalSectionHeights[0]).toBeCloseTo(chrome.horizontalSectionHeights[1]!, 1)
    expect(chrome.horizontalColumnHeights[0]).toBeCloseTo(chrome.horizontalColumnHeights[1]!, 1)
    expect(chrome.verticalColumnWidths[0]).toBeCloseTo(chrome.verticalColumnWidths[1]!, 1)
    expect(chrome.horizontalSectionRuleEnd).toBe('1px')
    expect(chrome.horizontalSectionRuleTop).toBe('0px')
    expect(chrome.horizontalColumnDivider).toBe('1px')
    expect(chrome.verticalColumnDivider).toBe('1px')
})

test('nearest context controls group headers and content is not height capped', async ({page}) => {
    const sidebar = page.locator('.gallery-control-demo')
    await sidebar.evaluate((e) => e.parentElement!.setAttribute('data-cap-context', 'form'))
    const header = sidebar.locator('cap-groupbox > cap-header')
    expect(await header.evaluate((e) => getComputedStyle(e).position)).toBe('static')
    expect(await header.evaluate((e) => getComputedStyle(e).writingMode)).toBe('vertical-rl')
    const content = page.locator('#gallery-checkboxes cap-groupbox').first().locator('cap-content')
    await content.evaluate((e) => { e.style.minHeight = '320px' })
    expect((await page.locator('#gallery-checkboxes cap-groupbox').first().boundingBox())!.height)
        .toBeGreaterThan(320)
})

test('labelled island Panels make one data surface flush without a duplicate table caption', async ({page}) => {
    await page.goto('/#/data-components')
    await expect(page.locator('#gallery-table > cap-toolbar[role="toolbar"]')).toHaveCount(1)
    const metrics = await page.evaluate(() => {
        const panelMetrics = (id: string) => {
            const panel = document.getElementById(id)!
            const body = panel.querySelector<HTMLElement>(':scope > cap-layout.panel-content')!
            const surface = body.firstElementChild as HTMLElement | null
            return {
                padding: getComputedStyle(body).padding,
                surface: surface?.getAttribute('data-cap-surface') ?? null,
            }
        }
        return {
            table: panelMetrics('gallery-table'),
            blockGraph: panelMetrics('gallery-blockgraph'),
            collections: panelMetrics('gallery-collections'),
        }
    })

    expect(metrics.table.padding).toBe('0px')
    expect(metrics.table.surface).toBe('data')
    expect(metrics.blockGraph.padding).toBe('0px')
    expect(metrics.blockGraph.surface).toBe('data')
    expect(Number.parseFloat(metrics.collections.padding)).toBeGreaterThan(0)
    await expect(page.locator('#gallery-table caption')).toHaveCount(0)
    await expect(page.locator('#gallery-table')).toHaveAttribute('aria-labelledby')
})

test('all four data controls replace cached values with accessible refresh skeletons', async ({page}, testInfo) => {
    await page.goto('/#/data-components')
    const main = page.locator('.gallery-main')
    await expect(main.getByRole('treeitem').first()).toBeVisible()
    for (const state of ['Loading', 'Ready', 'Initial', 'Ready', 'Loading']) {
        await page.locator('.gallery-controls').getByRole('radio', {name: state, exact: true}).click()
        for (const selector of ['#gallery-table cap-datatable', '#gallery-collections cap-listview',
            '#gallery-collections cap-treeview', '#gallery-blockgraph cap-blockgraph']) {
            const control = page.locator(selector)
            if (state === 'Ready') {
                await expect(control.locator('cap-placeholder')).toHaveCount(0)
                continue
            }
            await expect(control.locator('cap-placeholder').first()).toBeVisible()
            await expect(control.locator('[data-cap-selectable-row], [role="treeitem"], [role="option"]'))
                .toHaveCount(0)
            await expect(control).not.toContainText(/Runtime|Visualization|Platform|3 items/)
            await expect(control.locator('[role="status"]')).toContainText(/Loading/)
            const animated = await control.locator('cap-placeholder').first().evaluate((e) =>
                getComputedStyle(e, '::after').animationName)
            expect(animated).toBe('cap-working-progress')
        }
    }
    await page.screenshot({path: testInfo.outputPath('loading-gallery.png'), fullPage: true})
    await page.emulateMedia({reducedMotion: 'reduce'})
    expect(await main.locator('cap-placeholder').first().evaluate((e) =>
        getComputedStyle(e, '::after').animationName)).toBe('none')
    await page.locator('.gallery-controls').getByRole('radio', {name: 'Error', exact: true}).click()
    await expect(main.getByRole('alert')).toHaveCount(4)
    await page.getByRole('button', {name: 'Retry', exact: true}).click()
    await expect(main.getByRole('alert')).toHaveCount(0)
    await expect(main.locator('cap-placeholder')).toHaveCount(0)
})

test('data gallery supports command toggles and anchor-directed Shift multi-row selection', async ({page}) => {
    await page.goto('/#/data-components')

    const tableRows = page.locator('#gallery-table tbody [data-cap-selectable-row]')
    await expect(tableRows).toHaveCount(11)
    await tableRows.nth(0).click()
    await expect(page.locator('#gallery-table tbody [aria-selected="true"]')).toHaveCount(1)
    await tableRows.nth(2).click({modifiers: ['Meta']})
    await expect(page.locator('#gallery-table tbody [aria-selected="true"]')).toHaveCount(2)
    await tableRows.nth(5).click({modifiers: ['Shift']})
    await expect(page.locator('#gallery-table tbody [aria-selected="true"]')).toHaveCount(5)
    await tableRows.nth(2).click({modifiers: ['Meta']})
    await tableRows.nth(5).click({modifiers: ['Shift']})
    await expect(page.locator('#gallery-table tbody [aria-selected="true"]')).toHaveCount(1)

    const listbox = page.locator('#gallery-collections [role="listbox"]')
    await expect(listbox).toHaveAttribute('aria-multiselectable', 'true')
    const listRows = listbox.locator('[data-cap-selectable-row]')
    await expect(listRows).toHaveCount(11)
    await listRows.nth(0).click()
    await listRows.nth(2).click({modifiers: ['Meta']})
    await listRows.nth(5).click({modifiers: ['Shift']})
    await expect(listbox.locator('[aria-selected="true"]')).toHaveCount(5)
    await listRows.nth(2).click({modifiers: ['Meta']})
    await listRows.nth(5).click({modifiers: ['Shift']})
    await expect(listbox.locator('[aria-selected="true"]')).toHaveCount(1)
})
