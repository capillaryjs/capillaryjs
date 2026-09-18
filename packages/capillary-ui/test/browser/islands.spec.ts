import {expect, test} from '@playwright/test'
import type {Page} from '@playwright/test'
import {fileURLToPath} from 'node:url'
import {probeBorderPixels, probeChrome, probeShadowPixels, surfaceChromePixels} from './paint.js'

test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 900, height: 700})
})

async function open(page: Page, query = '') {
    await page.goto(`/islands.html${query}`)
    await page.waitForFunction(() => globalThis.capillaryUiIslandTest != null)
}

async function bounds(page: Page, selector: string) {
    return page.locator(selector).evaluate((element) => {
        const {left, right, top, bottom, width, height} = element.getBoundingClientRect()
        return {left, right, top, bottom, width, height}
    })
}

for (const sizing of ['viewport', 'embedded']) {
    test(`${sizing}: only direct app island headers omit surface padding`, async ({page}) => {
        await open(page, `?app-header&${sizing}`)
        await page.addStyleTag({content: `${probeChrome}
            #canvas {
                --island-padding: 12px 20px;
                --ui-padding: 7px;
                --navigation-bar-padding: 3px 5px;
            }
            #plain-header { padding: 3px; }
        `})

        for (const mode of [true, false, undefined]) {
            await page.evaluate(mode => capillaryUiIslandTest.setMode(mode), mode)
            for (const selector of ['#shell-header', '#shell-heading']) {
                await expect(page.locator(selector)).toHaveCSS('padding', '0px')
                expect(await surfaceChromePixels(page, selector)).toEqual({
                    shadow: probeShadowPixels, border: probeBorderPixels,
                })
            }
            for (const selector of ['#nested-header', '#nested-heading', '#shell-footer']) {
                await expect(page.locator(selector)).toHaveCSS('padding', '12px 20px')
            }
            // Resetting the inherited island token would incorrectly change
            // descendant surfaces; the shell exception changes padding only.
            expect(await page.locator('#shell-toolbar').evaluate(e =>
                getComputedStyle(e).getPropertyValue('--island-padding').trim())).toBe('12px 20px')
            await expect(page.locator('#shell-toolbar')).toHaveCSS('padding', '7px')
            await expect(page.locator('#shell-header nav > ul')).toHaveCSS('padding', '3px 5px')
            await expect(page.locator('#plain-header')).toHaveCSS('padding', '3px')
            expect(await page.locator('#plain-heading').evaluate(e => {
                const s = getComputedStyle(e)
                return parseFloat(s.paddingTop) / parseFloat(s.fontSize)
            })).toBeCloseTo(0.25)

            const header = await bounds(page, '#shell-header')
            const heading = await bounds(page, '#shell-heading')
            const toolbar = await bounds(page, '#shell-toolbar')
            expect(header.left).toBe(16)
            expect(header.right).toBe(884)
            expect(header.top).toBe(16)
            expect(heading.top - header.bottom).toBe(mode === true ? 16 : 32)
            expect(toolbar.left - header.left).toBe(2) // border, no extra island padding
            expect(header.right - toolbar.right).toBe(2)
        }
    })
}

for (const dir of ['ltr', 'rtl']) {
    test(`${dir}: nested scrollports paint borders and all four shadow edges`, async ({page}) => {
        await open(page, `?dir=${dir}&nested&scroll`)
        await page.addStyleTag({content: probeChrome})
        for (const selector of ['#sidebar', '#overview', '#results', '#details']) {
            const pixels = await surfaceChromePixels(page, selector)
            expect(pixels.shadow, `${selector} shadow`).toEqual(probeShadowPixels)
            expect(pixels.border, `${selector} border`).toEqual(probeBorderPixels)
        }
        const original = await bounds(page, '#overview')
        // Change 039 regression: shadows are clipped but border positions and
        // computed box-shadow remain correct. Prove pixel checks detect it.
        const broken = await page.addStyleTag({content: '#column { margin: 0; padding: 0; }'})
        expect(await bounds(page, '#overview')).toEqual(original)
        expect((await surfaceChromePixels(page, '#overview')).shadow).not.toEqual(probeShadowPixels)
        await broken.evaluate(e => e.parentNode!.removeChild(e))
        // Missing border chrome must also be caught, not just overflow clipping.
        await page.locator('#overview').evaluate(e => e.style.setProperty('border-color', 'transparent', 'important'))
        expect((await surfaceChromePixels(page, '#overview')).border).not.toEqual(probeBorderPixels)
        await page.locator('#overview').evaluate(e => e.style.setProperty('box-shadow', 'none', 'important'))
        expect((await surfaceChromePixels(page, '#overview')).shadow).not.toEqual(probeShadowPixels)
    })

    test(`${dir}: scrolling a panel collection preserves first and last chrome`, async ({page}) => {
        await open(page, `?dir=${dir}&scroll`)
        await page.addStyleTag({content: `${probeChrome}
            #column > .island { height: 420px; max-height: none; flex: none; }
        `})
        expect(await page.locator('#column').evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true)
        const first = await surfaceChromePixels(page, '#overview')
        expect(first).toEqual({shadow: probeShadowPixels, border: probeBorderPixels})
        await page.locator('#column').evaluate(e => { e.scrollTop = e.scrollHeight })
        const last = await surfaceChromePixels(page, '#results')
        expect(last).toEqual({shadow: probeShadowPixels, border: probeBorderPixels})
        expect(await page.locator('#canvas').evaluate(e => [e.scrollWidth, e.scrollHeight])).toEqual([900, 700])
    })

    test(`${dir}: nested and routed layouts share gutters and one perimeter inset`, async ({page}) => {
        await open(page, `?dir=${dir}&nested`)
        const header = await bounds(page, '#heading')
        const footer = await bounds(page, '#footer')
        const side = await bounds(page, '#sidebar')
        const overview = await bounds(page, '#overview')
        const results = await bounds(page, '#results')
        const details = await bounds(page, '#details')
        expect(header.left).toBe(16)
        expect(header.right).toBe(884)
        expect(header.top).toBe(16)
        expect(footer.bottom).toBe(684)
        for (const surface of [side, overview, details]) expect(surface.top - header.bottom).toBe(16)
        for (const surface of [side, results, details]) expect(footer.top - surface.bottom).toBe(16)
        const columns = [side, overview, details].sort((a, b) => a.left - b.left)
        expect(columns[1]!.left - columns[0]!.right).toBe(16)
        expect(columns[2]!.left - columns[1]!.right).toBe(16)
        expect(results.top - overview.bottom).toBe(16)
        expect(await page.locator('#row').evaluate(e => getComputedStyle(e).padding)).toBe('0px')
        expect(await page.locator('#inner').evaluate(e => getComputedStyle(e).gap)).toBe('0px')
        expect(await page.locator('#canvas').evaluate(e => [e.clientWidth, e.scrollWidth, e.clientHeight, e.scrollHeight]))
            .toEqual([900, 900, 700, 700])

        await page.evaluate(() => capillaryUiIslandTest.showDetails(false))
        expect((await bounds(page, '#results')).width - results.width).toBe(116)
        await page.evaluate(() => capillaryUiIslandTest.showDetails(true))
        expect(await bounds(page, '#results')).toEqual(results)

        await page.evaluate(() => capillaryUiIslandTest.selectRoute('other'))
        const first = await bounds(page, '#other-first')
        const second = await bounds(page, '#other-second')
        expect(first.left).toBe(16)
        expect(first.top - header.bottom).toBe(16)
        expect(second.top - first.bottom).toBe(16)
        await page.evaluate(() => capillaryUiIslandTest.selectRoute('main'))
        expect(await bounds(page, '#results')).toEqual(results)
    })
}

test('local gap overrides resolve on their layout; mode changes restore legacy margins', async ({page}) => {
    await open(page)
    await page.locator('#canvas').evaluate(e => e.style.setProperty('--island-inset', '24px'))
    expect((await bounds(page, '#heading')).left).toBe(24)
    expect((await bounds(page, '#sidebar')).top - (await bounds(page, '#heading')).bottom).toBe(16)
    await page.locator('#canvas').evaluate(e => e.style.removeProperty('--island-inset'))
    await page.locator('#column').evaluate(e => e.style.setProperty('--island-gap', '8px'))
    expect((await bounds(page, '#results')).top - (await bounds(page, '#overview')).bottom).toBe(8)
    expect(await page.locator('#row').evaluate(e => getComputedStyle(e).gap)).toBe('16px')
    await page.evaluate(() => capillaryUiIslandTest.setMode(false))
    expect(await page.locator('#heading').evaluate(e => getComputedStyle(e).margin)).toBe('16px')
    expect(await page.locator('#column').evaluate(e => getComputedStyle(e).gap)).toBe('0px')
    expect(await page.locator('#canvas').evaluate(e => getComputedStyle(e).padding)).toBe('0px')
    await page.evaluate(() => capillaryUiIslandTest.setMode(true))
    expect(await page.locator('#heading').evaluate(e => getComputedStyle(e).margin)).toBe('0px')
    expect(await page.locator('#canvas').evaluate(e => getComputedStyle(e).padding)).toBe('16px')
    await page.evaluate(() => capillaryUiIslandTest.setMode(undefined))
    expect(await page.locator('#heading').evaluate(e => getComputedStyle(e).margin)).toBe('16px')
    expect(await page.locator('#canvas').evaluate(e => getComputedStyle(e).padding)).toBe('0px')
})

test('native traits support opt-out, new scopes, and grid without repeated insets', async ({page}) => {
    await open(page)
    await page.evaluate(() => {
        document.body.innerHTML = `
            <main class="cap-island-layout cap-layout-vertical">
                <section id="nested" class="cap-island-layout" style="display:grid;grid-template-columns:1fr 1fr">
                    <article id="a" class="island">A</article><article id="b" class="island">B</article>
                </section>
                <section class="cap-island-layout-off cap-layout-vertical">
                    <article id="legacy" class="island">Legacy</article>
                    <div><section id="restart" class="cap-island-layout cap-layout-horizontal">
                        <article id="c" class="island">C</article><article id="d" class="island">D</article>
                    </section></div>
                </section>
            </main>`
    })
    expect(await page.locator('#nested').evaluate(e => getComputedStyle(e).padding)).toBe('0px')
    expect((await bounds(page, '#b')).left - (await bounds(page, '#a')).right).toBe(16)
    expect(await page.locator('#legacy').evaluate(e => getComputedStyle(e).margin)).toBe('16px')
    expect(await page.locator('#restart').evaluate(e => getComputedStyle(e).padding)).toBe('16px')
    expect(await page.locator('#c').evaluate(e => getComputedStyle(e).margin)).toBe('0px')
    expect((await bounds(page, '#d')).left - (await bounds(page, '#c')).right).toBe(16)
})

test('wrapping and hidden items retain one gap without sibling-order rules', async ({page}) => {
    await open(page)
    await page.evaluate(() => {
        document.body.innerHTML = `
            <main class="cap-island-layout cap-layout-horizontal" style="width:252px;flex-wrap:wrap">
                <section id="a" class="island" style="width:100px;height:40px;flex:none"></section>
                <section id="b" class="island" style="width:100px;height:40px;flex:none"></section>
                <section id="c" class="island" style="width:100px;height:40px;flex:none"></section>
            </main>`
    })
    const a = await bounds(page, '#a')
    expect((await bounds(page, '#b')).left - a.right).toBe(16)
    expect((await bounds(page, '#c')).top - a.bottom).toBe(16)
    expect((await bounds(page, '#c')).left).toBe(a.left)
    await page.locator('#b').evaluate(e => { e.setAttribute('hidden', '') })
    expect((await bounds(page, '#c')).top).toBe(a.top)
    expect((await bounds(page, '#c')).left - a.right).toBe(16)
})

test('White theme makes the composition flush and a larger body keeps scrolling inside its Panel', async ({page}) => {
    await open(page)
    await page.addStyleTag({path: fileURLToPath(new URL('../../themes/white/theme.css', import.meta.url))})
    expect(await page.locator('#row').evaluate(e => getComputedStyle(e).gap)).toBe('0px')
    expect(await page.locator('#canvas').evaluate(e => getComputedStyle(e).padding)).toBe('0px')
    expect((await bounds(page, '#heading')).left).toBe(0)
    await page.locator('#inner').evaluate(e => { e.style.height = '1200px'; e.style.flex = 'none' })
    expect(await page.locator('#results > .panel-content').evaluate(e => e.scrollHeight > e.clientHeight))
        .toBe(true)
    expect(await page.locator('#canvas').evaluate(e => e.scrollHeight)).toBe(700)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(700)
})

for (const axis of ['horizontal', 'vertical']) {
    for (const dir of ['ltr', 'rtl']) {
        test(`${axis}/${dir}: scrolling split panes paint chrome and preserve resize allocation`, async ({page}) => {
            await open(page, `?split&scroll&axis=${axis}&dir=${dir}`)
            await page.addStyleTag({content: probeChrome})
            const horizontal = axis === 'horizontal'
            const extent = (rect: Awaited<ReturnType<typeof bounds>>) => horizontal ? rect.width : rect.height
            const separator = page.getByRole('separator')
            for (const selector of ['#primary-surface', '#secondary-surface']) {
                expect(await surfaceChromePixels(page, selector))
                    .toEqual({shadow: probeShadowPixels, border: probeBorderPixels})
            }
            expect(extent(await bounds(page, '#primary-surface'))).toBe(160)
            await separator.focus()
            await separator.press(horizontal ? (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown')
            expect(extent(await bounds(page, '#primary-surface'))).toBe(176)
            await separator.press('End')
            expect(extent(await bounds(page, '#secondary-surface'))).toBe(80)
            await separator.press('Home')
            expect(extent(await bounds(page, '#primary-surface'))).toBe(80)
            const handle = await separator.boundingBox()
            const x = handle!.x + handle!.width / 2
            const y = handle!.y + handle!.height / 2
            await page.mouse.move(x, y)
            await page.mouse.down()
            await page.mouse.move(x + (horizontal ? (dir === 'rtl' ? -30 : 30) : 0), y + (horizontal ? 0 : 30))
            await page.mouse.up()
            expect(extent(await bounds(page, '#primary-surface'))).toBe(110)
            // Repeating islands on a pane must not alter its allocated size.
            await open(page, `?split&scroll&nested&axis=${axis}&dir=${dir}`)
            expect(extent(await bounds(page, '#primary-surface'))).toBe(160)
            // A pane may itself be the surface. Its border belongs inside the
            // allocation, and it must not receive a gutter extension.
            await open(page, `?split&scroll&pane-islands&axis=${axis}&dir=${dir}`)
            await page.addStyleTag({content: probeChrome})
            expect(extent(await bounds(page, 'cap-primary'))).toBe(160)
            expect(await surfaceChromePixels(page, 'cap-primary'))
                .toEqual({shadow: probeShadowPixels, border: probeBorderPixels})
        })

        test(`${axis}/${dir}: split separator owns one gutter and resizes at zero gap`, async ({page}) => {
            await open(page, `?split&axis=${axis}&dir=${dir}`)
            const horizontal = axis === 'horizontal'
            const sign = horizontal && dir === 'rtl' ? -1 : 1
            const extent = (rect: Awaited<ReturnType<typeof bounds>>) => horizontal ? rect.width : rect.height
            const separator = page.getByRole('separator')
            expect(extent(await bounds(page, 'cap-separator'))).toBe(16)
            const primary = await bounds(page, '#primary-surface')
            const secondary = await bounds(page, '#secondary-surface')
            expect(horizontal
                ? (sign > 0 ? secondary.left - primary.right : primary.left - secondary.right)
                : secondary.top - primary.bottom).toBe(16)
            await separator.focus()
            await separator.press(horizontal ? (sign > 0 ? 'ArrowRight' : 'ArrowLeft') : 'ArrowDown')
            expect(extent(await bounds(page, 'cap-primary'))).toBe(176)
            await page.evaluate(() => document.documentElement.style.setProperty('--island-gap', '12.5px'))
            expect(extent(await bounds(page, 'cap-separator'))).toBe(12.5)
            await separator.press('End')
            expect(extent(await bounds(page, 'cap-secondary'))).toBe(80)
            await separator.press('Home')
            expect(extent(await bounds(page, 'cap-primary'))).toBe(80)

            await page.evaluate(() => document.documentElement.style.setProperty('--island-gap', '0px'))
            const handle = await bounds(page, 'cap-separator')
            expect(extent(handle)).toBe(0)
            const x = horizontal ? handle.left : (handle.left + handle.right) / 2
            const y = horizontal ? (handle.top + handle.bottom) / 2 : handle.top
            await page.mouse.move(x, y)
            expect(await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.tagName, {x, y}))
                .toBe('CAP-SEPARATOR')
            await page.mouse.down()
            await page.mouse.move(x + (horizontal ? sign * 30 : 0), y + (horizontal ? 0 : 30))
            await page.mouse.up()
            expect(extent(await bounds(page, 'cap-primary'))).toBe(110)
            expect(await page.locator('.test-split').evaluate(e => [e.clientWidth === e.scrollWidth, e.clientHeight === e.scrollHeight]))
                .toEqual([true, true])
        })
    }
}
