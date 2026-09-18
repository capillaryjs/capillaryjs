import {expect, test} from '@playwright/test'
import {fileURLToPath} from 'node:url'

const packageRoot = new URL('../../', import.meta.url)
const bodies = 'cap-textbox > input, cap-dropdown > cap-selectshell, '
    + 'cap-toggle > cap-options > button, cap-button > button'

for (const theme of ['base', 'capillary', 'shiny', 'soft', 'white', 'minimal']) {
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
            // Capillary intentionally uses a roomier six-pixel vertical inset.
            // Native input controls retain their platform minimum line box, so
            // the themed controls naturally occupy either of the two adjacent
            // heights while remaining centered on the same text line.
            const heights = theme === 'capillary' ? [26, 28] : [24]
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
                    const inputLines: {actual: number, expected: number}[] = []
                    const fonts = [...controls, ...labels, ...nativeSelects].map((e) => {
                        const s = getComputedStyle(e)
                        let lineHeight = s.lineHeight
                        if (e instanceof HTMLInputElement) {
                            // Gecko clamps a single-line input to the platform font's
                            // native minimum (16px for Linux Helvetica fallback). Check
                            // that minimum independently; the authored line is inherited.
                            const probe = document.createElement('input')
                            probe.style.cssText = 'position:absolute;visibility:hidden;appearance:none'
                            probe.style.font = s.font
                            probe.style.lineHeight = '0px'
                            document.body.append(probe)
                            const minimum = parseFloat(getComputedStyle(probe).lineHeight)
                            probe.remove()
                            lineHeight = getComputedStyle(e.parentElement!).lineHeight
                            inputLines.push({actual: parseFloat(s.lineHeight),
                                expected: Math.max(minimum, parseFloat(lineHeight))})
                        }
                        return {element: e.tagName, family: s.fontFamily, size: s.fontSize, lineHeight}
                    })
                    return {
                        heights: controls.map((e) => e.getBoundingClientRect().height),
                        centers: [...controls, ...labels, ...root.querySelectorAll('cap-checkshell')]
                            .map(center),
                        fonts,
                        inputLines,
                        padding: [...root.querySelectorAll('cap-textbox input'), ...nativeSelects]
                            .map((e) => {
                                const s = getComputedStyle(e)
                                return [s.paddingTop, s.paddingBottom]
                            }),
                    }
                }, bodies)
                for (const actual of metrics.heights) {
                    expect(heights.some((expected) => Math.abs(actual - expected) < 0.5), id)
                        .toBeTruthy()
                }
                expect(Math.max(...metrics.centers) - Math.min(...metrics.centers), id)
                    .toBeLessThanOrEqual(1)
                expect(new Set(metrics.fonts.map(({family, size, lineHeight}) =>
                    JSON.stringify([family, size, lineHeight]))).size,
                `${id}: ${JSON.stringify(metrics.fonts)}`).toBe(1)
                for (const {actual, expected} of metrics.inputLines) expect(actual, id).toBeCloseTo(expected, 1)
                for (const [top, bottom] of metrics.padding) expect(top, id).toBe(bottom)
            }
            for (const selector of ['#toolbar cap-textbox input', '#toolbar cap-selectshell']) {
                expect((await page.locator(selector).boundingBox())!.width).toBeCloseTo(180, 2)
            }
            const compact = await page.locator('#compact > *').evaluateAll((elements) =>
                elements.map((e) => e.getBoundingClientRect().height))
            const compactHeight = theme === 'capillary' ? 16 : 14.4
            for (const height of compact) expect(height).toBeCloseTo(compactHeight, 0)
            const squares = await page.locator('cap-checkshell').evaluateAll((elements) =>
                elements.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]))
            const squareSize = theme === 'capillary' ? 16 : 12
            for (const square of squares) expect(square).toEqual([squareSize, squareSize])
            const variants = await page.locator('#variants input, #variants select, #variants cap-datepicker > button')
                .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().height))
            const variantHeights = theme === 'capillary' ? [28, 30, 32.6] : [24]
            for (const actual of variants) {
                expect(variantHeights.some((expected) => Math.abs(actual - expected) < 0.5)).toBeTruthy()
            }
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

        test('quad checkbox maps prefer, require, and deny to semantic status colors', async ({page}) => {
            const quad = page.locator('#compact > cap-quadcheckbox')
            const input = quad.locator('input')
            const shell = quad.locator('cap-checkshell')
            const statusColor = (status: 'neutral' | 'positive' | 'negative') => page.evaluate((name) => {
                const probe = document.createElement('span')
                probe.style.background = `var(--palette-status-${name})`
                document.body.append(probe)
                try {
                    return getComputedStyle(probe).backgroundColor
                } finally {
                    probe.remove()
                }
            }, status)

            await input.focus()
            await input.press('ArrowRight') // neutral → prefer
            await expect(shell).toHaveCSS('background-color', await statusColor('neutral'))
            await input.press('ArrowRight') // prefer → require
            await expect(shell).toHaveCSS('background-color', await statusColor('positive'))
            await input.press('ArrowRight') // require → deny
            await expect(shell).toHaveCSS('background-color', await statusColor('negative'))
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
            // Theme chrome must not change the structural, font-scaled minimum.
            for (const height of heights) expect(height).toBe(48)
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
