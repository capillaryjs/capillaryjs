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
            await expect(page.locator(`#gallery-${id} > cap-groupbox`)).toHaveCount(count)
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

test('groups exceed the soft cap, shrink fields before wrapping, and retain usable floors', async ({page}) => {
    await page.setViewportSize({width: 1600, height: 1100})
    const row = page.locator('#gallery-basic-inputs')
    const group = row.locator('cap-groupbox').first()
    const field = group.getByRole('textbox', {name: 'Long value', exact: true})
    expect((await group.boundingBox())!.width).toBeGreaterThan(240)
    expect((await field.boundingBox())!.width).toBeCloseTo(180, 1)
    expect((await row.getByRole('combobox').boundingBox())!.width).toBeCloseTo(180, 1)
    const checkboxWidths = await page.locator('#gallery-checkboxes > cap-groupbox')
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().width))
    for (const width of checkboxWidths) expect(width).toBeCloseTo(240, 1)
    await page.locator('#gallery-checkboxes').evaluate((e) => {
        e.style.setProperty('--groupbox-preferred-width', '18rem')
    })
    expect((await page.locator('#gallery-checkboxes > cap-groupbox').first().boundingBox())!.width)
        .toBeCloseTo(288, 1)

    await row.evaluate((e) => { e.style.width = '1000px' })
    const tops = await row.locator(':scope > cap-groupbox').evaluateAll((es) =>
        es.map((e) => e.getBoundingClientRect().top))
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1)
    expect((await field.boundingBox())!.width).toBeLessThan(180)
    expect((await field.boundingBox())!.width).toBeGreaterThanOrEqual(96)

    await row.evaluate((e) => { e.style.width = '400px' })
    const wrappedTops = await row.locator(':scope > cap-groupbox').evaluateAll((es) =>
        es.map((e) => e.getBoundingClientRect().top))
    expect(new Set(wrappedTops).size).toBeGreaterThan(1)
    for (const width of await row.locator('input:not([type="radio"]), select')
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().width))) {
        expect(width).toBeGreaterThanOrEqual(96)
    }
    await row.evaluate((e) => {
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
