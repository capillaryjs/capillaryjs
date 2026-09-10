import {expect, test} from '@playwright/test'
import {AxeBuilder} from '@axe-core/playwright'

test('DateTimePicker exposes a labeled date and time group', async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.frayTestReady === true)

    const root = page.locator('#datetime-root')
    const group = root.getByRole('group', {name: 'Schedule'})
    await expect(group).toBeVisible()

    const dateInput = group.getByRole('textbox', {name: 'Date'})
    const timeSelect = group.getByRole('combobox', {name: 'Time'})
    await expect(dateInput).toBeVisible()
    await expect(timeSelect).toBeVisible()

    const {violations} = await new AxeBuilder({page}).include('#datetime-root').analyze()
    expect(violations.filter(({impact}) => impact === 'serious' || impact === 'critical'))
        .toEqual([])
})

test('DateTimePicker opens the calendar and selects a date', async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.frayTestReady === true)

    const root = page.locator('#datetime-root')
    const dateInput = root.getByRole('textbox', {name: 'Date'})
    await dateInput.click()

    const dialog = root.locator('dialog[role="dialog"]')
    await expect(dialog).toBeVisible()

    const day = dialog.locator('table[role="grid"] tbody button[data-focused="true"]')
    await expect(day).toBeVisible()
    await day.click()

    await expect(dialog).not.toBeVisible()
    await expect(dateInput).toHaveValue(/.+/)
})
