import {expect, test} from '@playwright/test'

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.frayTestReady === true)
    await page.evaluate(() => document.body.replaceChildren())
})

test('natural and flexible allocation works on both axes with cross-axis stretch', async ({page}) => {
    await page.addStyleTag({content: `
        .horizontal { width: 600px; height: 240px; }
        .horizontal > .natural { width: 160px; }
        .vertical { width: 500px; height: 400px; }
        .vertical > .top { height: 50px; }
        .vertical > .bottom { height: 30px; }
    `})
    await page.evaluate((markup) => { document.body.innerHTML = markup }, `
        <div class="horizontal fray-layout-horizontal">
            <div class="natural fray-size-natural"></div>
            <div class="flexible fray-size-flexible"></div>
        </div>
        <div class="vertical fray-layout-vertical">
            <div class="top fray-size-natural"></div>
            <div class="middle fray-size-flexible"></div>
            <div class="bottom fray-size-natural"></div>
        </div>
    `)

    const sizes = await page.evaluate(() => Object.fromEntries(
        ['.horizontal > .natural', '.horizontal > .flexible', '.vertical > .middle']
            .map((selector) => {
                const rect = document.querySelector(selector)!.getBoundingClientRect()
                return [selector, {width: rect.width, height: rect.height}]
            }),
    ))
    expect(sizes['.horizontal > .natural']).toEqual({width: 160, height: 240})
    expect(sizes['.horizontal > .flexible']).toEqual({width: 440, height: 240})
    expect(sizes['.vertical > .middle']).toEqual({width: 500, height: 320})
})

test('equivalent flexible siblings share space and later app CSS can change the ratio', async ({page}) => {
    await page.addStyleTag({content: `
        .row { width: 600px; height: 100px; }
        .ratio > :first-child { flex-grow: 2; }
    `})
    await page.evaluate((markup) => { document.body.innerHTML = markup }, `
        <div class="row equal fray-layout-horizontal">
            <div class="fray-size-flexible"></div><div class="fray-size-flexible"></div>
        </div>
        <div class="row ratio fray-layout-horizontal">
            <div class="fray-size-flexible"></div><div class="fray-size-flexible"></div>
        </div>
    `)

    const widths = await page.evaluate(() => [...document.querySelectorAll('.row')].map((row) =>
        [...row.children].map((child) => child.getBoundingClientRect().width)))
    expect(widths[0]).toEqual([300, 300])
    expect(widths[1]).toEqual([400, 200])
})

test('nested layouts stay bounded and only the explicit inner owner has scroll range', async ({page}) => {
    await page.setViewportSize({width: 800, height: 600})
    await page.addStyleTag({content: `
        :root { --island-margin: 0px; --island-padding: 0px; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .toolbar { height: 50px; }
        .sidebar { width: 180px; }
        .oversized { height: 1200px; min-width: 1000px; }
    `})
    await page.evaluate((markup) => { document.body.innerHTML = markup }, `
        <main class="fray-fill-horizontal fray-fill-vertical fray-layout-vertical">
            <div class="toolbar fray-size-natural"></div>
            <div class="body fray-size-flexible fray-layout-horizontal">
                <aside class="island sidebar fray-size-natural"></aside>
                <section class="island workspace fray-size-flexible fray-layout-vertical">
                    <div class="content fray-size-flexible fray-scroll" tabindex="0"
                         role="region" aria-label="Scrollable content">
                        <div class="oversized"></div>
                    </div>
                </section>
            </div>
        </main>
    `)

    const metrics = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>('main')!
        const sidebar = document.querySelector<HTMLElement>('.sidebar')!
        const island = document.querySelector<HTMLElement>('.workspace')!
        const content = document.querySelector<HTMLElement>('.content')!
        return {
            root: [root.clientWidth, root.clientHeight, root.scrollWidth, root.scrollHeight],
            sidebar: [sidebar.clientWidth, sidebar.clientHeight, sidebar.scrollWidth, sidebar.scrollHeight],
            island: [island.clientWidth, island.clientHeight, island.scrollWidth, island.scrollHeight],
            content: [content.clientWidth, content.clientHeight, content.scrollWidth, content.scrollHeight],
            contentOverflow: getComputedStyle(content).overflow,
        }
    })
    expect(metrics.root).toEqual([800, 600, 800, 600])
    expect(metrics.sidebar[0]).toBe(180)
    expect(metrics.sidebar[2]).toBe(metrics.sidebar[0])
    expect(metrics.sidebar[3]).toBe(metrics.sidebar[1])
    expect(metrics.island[2]!).toBe(metrics.island[0]!)
    expect(metrics.island[3]!).toBe(metrics.island[1]!)
    expect(metrics.content[2]!).toBeGreaterThan(metrics.content[0]!)
    expect(metrics.content[3]!).toBeGreaterThan(metrics.content[1]!)
    expect(metrics.contentOverflow).toBe('auto')
})

test('flexible allocation alone does not opt into scrolling', async ({page}) => {
    await page.addStyleTag({content:
        '.shell { width: 300px; height: 100px; }.large { height: 300px; }'})
    await page.evaluate((markup) => { document.body.innerHTML = markup }, `
        <div class="shell fray-layout-vertical">
            <div class="region fray-size-flexible"><div class="large"></div></div>
        </div>
    `)
    const result = await page.locator('.region').evaluate((region) => ({
        overflow: getComputedStyle(region).overflow,
        clientHeight: region.clientHeight,
        scrollHeight: region.scrollHeight,
    }))
    expect(result.overflow).toBe('visible')
    expect(result.scrollHeight).toBeGreaterThan(result.clientHeight)
})
