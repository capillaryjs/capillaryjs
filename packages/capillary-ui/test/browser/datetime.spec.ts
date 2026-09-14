import {expect, test} from '@playwright/test'
import {AxeBuilder} from '@axe-core/playwright'

test('DateTimePicker exposes a labeled native datetime-local input', async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.capillaryUiTestReady === true)

    const input = page.locator('#datetime-root').getByLabel('Schedule')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('type', 'datetime-local')
    await expect(input).toHaveAttribute('min', '2026-01-01T00:00')
    await expect(input).toHaveAttribute('max', '2026-12-31T23:59')

    const {violations} = await new AxeBuilder({page}).include('#datetime-root').analyze()
    expect(violations.filter(({impact}) => impact === 'serious' || impact === 'critical'))
        .toEqual([])
})

test('DateTimePicker emits local date-time values', async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.capillaryUiTestReady === true)

    const input = page.locator('#datetime-root').getByLabel('Schedule')
    await input.fill('2026-09-15T14:30')
    await expect(input).toHaveValue('2026-09-15T14:30')
    await expect
        .poll(() => page.evaluate(() => globalThis.capillaryUiTest.datetime))
        .toBe('2026-09-15T14:30')
})
