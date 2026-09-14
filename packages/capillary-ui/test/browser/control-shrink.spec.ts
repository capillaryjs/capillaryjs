import {expect, test} from '@playwright/test'

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.capillaryUiTestReady === true)
    await page.evaluate(() => document.body.replaceChildren())
})

// A line control inside a GroupBox nested in a horizontal Layout must shrink
// below its 15rem default when the container is too narrow, down to its
// min-width floor. Below the label + field + chrome minimum the region scrolls.
test('line control shrinks below 15rem inside a narrow groupbox', async ({page}) => {
    await page.evaluate(() => { document.body.innerHTML = `
        <div class="probe-row cap-layout-horizontal" style="width:200px;overflow:auto">
            <cap-groupbox>
                <cap-header>Name</cap-header>
                <cap-content>
                    <cap-layout class="cap-layout-vertical">
                        <cap-textbox>
                            <label>Name</label>
                            <input/>
                        </cap-textbox>
                    </cap-layout>
                </cap-content>
            </cap-groupbox>
        </div>` })

    const m = await page.evaluate(() => {
        const input = document.querySelector<HTMLElement>('cap-textbox input')!
        const groupbox = document.querySelector<HTMLElement>('cap-groupbox')!
        return {
            input: input.getBoundingClientRect().width,
            groupbox: groupbox.getBoundingClientRect().width,
        }
    })

    // 200px accommodates the native font, label, field floor and vertical header.
    expect(m.groupbox).toBeLessThanOrEqual(200)
    expect(m.input).toBeLessThan(240)
    expect(m.input).toBeGreaterThanOrEqual(96) // min-width floor (6rem)
    await page.locator('.probe-row').evaluate((e) => { (e as HTMLElement).style.width = '120px' })
    expect(await page.locator('input').evaluate((e) => e.getBoundingClientRect().width)).toBeGreaterThanOrEqual(96)
    expect(await page.locator('.probe-row').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true)
})
