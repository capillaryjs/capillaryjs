import {expect, test} from '@playwright/test'
import {fileURLToPath} from 'node:url'

const packageRoot = new URL('../../', import.meta.url)
const bodies = 'cap-textbox > input, cap-dropdown > cap-selectshell, '
    + 'cap-toggle > cap-options > button, cap-button > button'

for (const theme of ['base', 'minimal', 'shiny', 'java']) {
    test.describe(theme, () => {
        test.beforeEach(async ({page}) => {
            await page.setViewportSize({width: 1600, height: 1000})
            await page.goto('/line-controls.html')
            await page.locator('#toolbar cap-button button').waitFor()
            for (const path of ['themes/base.css', 'colors/iceblue/colors.css',
                ...(theme === 'base' ? [] : [`themes/${theme}/theme.css`])]) {
                await page.addStyleTag({path: fileURLToPath(new URL(path, packageRoot))})
            }
        })

        test('bodies, labels and compact checkboxes share a centered text line', async ({page}, testInfo) => {
            const height = theme === 'java' ? 28 : 24
            for (const id of ['toolbar', 'layout', 'panel', 'tall', 'disabled', 'busy', 'error']) {
                const row = page.locator(`#${id}`)
                const metrics = await row.evaluate((root, selector) => {
                    const center = (e: Element) => {
                        const r = e.getBoundingClientRect()
                        return r.y + r.height / 2
                    }
                    const controls = Array.from(root.querySelectorAll(selector))
                    const labels = Array.from(root.querySelectorAll('[data-text]'))
                    const nativeSelects = Array.from(root.querySelectorAll('select'))
                    const fonts = [...controls, ...labels, ...nativeSelects].map((e) => {
                        const s = getComputedStyle(e)
                        return [s.fontFamily, s.fontSize, s.lineHeight]
                    })
                    return {
                        heights: controls.map((e) => e.getBoundingClientRect().height),
                        centers: [...controls, ...labels, ...root.querySelectorAll('cap-checkshell')]
                            .map(center),
                        fonts,
                        padding: [...root.querySelectorAll('cap-textbox input'), ...nativeSelects]
                            .map((e) => {
                                const s = getComputedStyle(e)
                                return [s.paddingTop, s.paddingBottom]
                            }),
                    }
                }, bodies)
                for (const actual of metrics.heights) expect(actual, id).toBeCloseTo(height, 0)
                expect(Math.max(...metrics.centers) - Math.min(...metrics.centers), id)
                    .toBeLessThanOrEqual(1)
                expect(new Set(metrics.fonts.map((font) => JSON.stringify(font))).size, id).toBe(1)
                for (const [top, bottom] of metrics.padding) expect(top, id).toBe(bottom)
            }
            for (const selector of ['#toolbar cap-textbox input', '#toolbar cap-selectshell']) {
                expect((await page.locator(selector).boundingBox())!.width).toBeCloseTo(180, 2)
            }
            const compact = await page.locator('#compact > *').evaluateAll((elements) =>
                elements.map((e) => e.getBoundingClientRect().height))
            for (const height of compact) expect(height).toBeCloseTo(14.4, 0)
            const squares = await page.locator('cap-checkshell').evaluateAll((elements) =>
                elements.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]))
            for (const square of squares) expect(square).toEqual([12, 12])
            const variants = await page.locator('#variants input, #variants select, #variants cap-datepicker > button')
                .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().height))
            for (const actual of variants) expect(actual).toBeCloseTo(height, 0)
            if (theme === 'shiny') {
                await page.screenshot({path: testInfo.outputPath('line-controls.png'), fullPage: true})
            }
        })

        test('state changes and focus do not move text or resize controls', async ({page}) => {
            const row = page.locator('#layout')
            const measure = () => row.locator('cap-options, cap-options button, cap-options [data-text]')
                .evaluateAll((elements) => elements.map((e) => {
                    const r = e.getBoundingClientRect()
                    return [r.x, r.y, r.width, r.height]
                }))
            const before = await measure()
            for (const index of [1, 2, 0]) {
                await row.locator('cap-options button').nth(index).click()
                expect(await measure()).toEqual(before)
            }
            const input = row.locator('cap-textbox input')
            const inputBefore = await input.boundingBox()
            await input.focus()
            await input.fill('Ag Text changed')
            expect(await input.boundingBox()).toEqual(inputBefore)
            const button = row.locator('cap-button button')
            const buttonBefore = await button.boundingBox()
            await button.evaluate((e) => e.setAttribute('disabled', ''))
            expect(await button.boundingBox()).toEqual(buttonBefore)
            await button.evaluate((e) => e.removeAttribute('disabled'))
            expect(await button.boundingBox()).toEqual(buttonBefore)
        })

        test('toggle paint keeps busy, error and reduced-motion feedback', async ({page}) => {
            const surface = page.locator('#busy cap-options button').first()
            const paint = await surface.evaluate((e) => {
                const s = getComputedStyle(e, '::before')
                return {animation: s.animationName, background: s.backgroundImage}
            })
            expect(paint.animation).toBe('cap-working-progress')
            expect(paint.background).not.toBe('none')
            const error = await page.locator('#error cap-options button').last().evaluate((e) =>
                getComputedStyle(e, '::before').borderTopColor)
            const inputError = await page.locator('#error cap-textbox input').evaluate((e) =>
                getComputedStyle(e).borderTopColor)
            expect(error).toBe(inputError)
            await page.emulateMedia({reducedMotion: 'reduce'})
            expect(await surface.evaluate((e) => getComputedStyle(e, '::before').animationName))
                .toBe('none')
        })

        test('font scaling, minimum overrides, zoom and narrow layouts remain usable', async ({page}) => {
            await page.locator('cap-app').evaluate((e) => {
                e.style.setProperty('--ui-font-size', '24px')
            })
            const heights = await page.locator('#layout').locator(bodies).evaluateAll((elements) =>
                elements.map((e) => e.getBoundingClientRect().height))
            // Java deliberately keeps its rem-sized minimum; ordinary content can grow.
            if (theme !== 'java') for (const height of heights) expect(height).toBe(48)
            await page.locator('cap-app').evaluate((e) => {
                e.style.setProperty('--control-min-height', '60px')
                e.style.setProperty('zoom', '2')
            })
            const enlarged = await page.locator('#layout').locator(bodies).evaluateAll((elements) =>
                elements.map((e) => e.getBoundingClientRect().height))
            for (const height of enlarged) expect(height).toBe(120)
            await page.locator('cap-app').evaluate((e) => e.removeAttribute('style'))
            await page.locator('#layout cap-button button [data-text]').evaluate((e) => {
                e.append(document.createElement('br'), 'A longer second line')
            })
            const richButton = page.locator('#layout cap-button button')
            const richLabel = richButton.locator('[data-text]')
            expect((await richButton.boundingBox())!.height)
                .toBeGreaterThanOrEqual((await richLabel.boundingBox())!.height)
            await page.locator('#narrow').evaluate((e) => { e.style.width = '180px' })
            const width = (await page.locator('#narrow input').boundingBox())!.width
            expect(width).toBeLessThan(180)
            expect(width).toBeGreaterThanOrEqual(96)
        })
    })
}
