import {expect, test} from '@playwright/test'
import {screenshotPixels} from '../../../../packages/capillary-ui/test/browser/paint.js'

test.use({baseURL: 'http://127.0.0.1:4175'})

test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 2000, height: 1100})
    await page.goto('/#/line-inputs')
    await page.locator('#gallery-line-inputs').waitFor()
})

test('loading emitter modes animate determinate and indeterminate progress examples', async ({page}) => {
    const partial = page.locator('#gallery-basic-inputs cap-progressbar progress').nth(1)
    const partialSurface = page.locator('#gallery-basic-inputs cap-progressbar').nth(1).locator('cap-content')
    const indeterminate = page.locator('#gallery-basic-inputs cap-progressbar progress').nth(3)
    const surface = page.locator('#gallery-basic-inputs cap-progressbar').nth(3).locator('cap-content')

    for (const mode of ['Loading (refresh)', 'Loading (replace)']) {
        await page.getByRole('radio', {name: mode, exact: true}).click()
        await expect(partial).toHaveAttribute('aria-busy', 'true')
        expect(await partialSurface.evaluate((element) => getComputedStyle(element, '::after').animationName))
            .toContain('cap-working-progress')
        await expect(indeterminate).toHaveAttribute('aria-busy', 'true')
        expect(await surface.evaluate((element) => getComputedStyle(element, '::after').animationName))
            .toContain('cap-working-progress')
    }
})

for (const theme of ['shiny', 'capillary', 'soft', 'minimal', 'white']) {
    test(`${theme}: sidebar and main panel chrome actually paints`, async ({page}, testInfo) => {
        await page.getByRole('combobox', {name: 'Theme', exact: true}).selectOption(theme)
        await page.waitForFunction(theme => {
            const link = document.querySelector<HTMLLinkElement>('link[data-cap-stylesheet="theme"]')
            return link?.dataset.capSelection === theme && link.sheet?.href === link.href
        }, theme)
        // Shell headers delegate spacing to their children in every theme,
        // even when the theme gives ordinary islands nonzero padding.
        await expect(page.locator('cap-app > header.island')).toHaveCSS('padding', '0px')
        const surfaces = page.locator('.gallery-sidebar, #gallery-line-inputs')
        const samples = await surfaces.evaluateAll((elements, theme) => elements.map(e => {
            const r = e.getBoundingClientRect()
            const s = getComputedStyle(e)
            const y = Math.min(r.top + r.height / 2, innerHeight - 30)
            return {
                id: e.id,
                style: e.getAttribute('style'),
                shadow: s.boxShadow,
                border: parseFloat(s.borderLeftWidth),
                points: (theme === 'white' ? [] : [
                    ...[1, 2, 3].map(d => ({x: r.left - d, y})),
                    ...[0, 1, 2].map(d => ({x: r.right + d, y})),
                    {x: r.left + 0.1, y}, {x: r.right - 0.1, y},
                ]),
            }
        }), theme)
        const points = samples.flatMap(s => s.points)
        const painted = await screenshotPixels(page, points)
        if (testInfo.project.name === 'chromium' && ['shiny', 'capillary'].includes(theme)) {
            await page.screenshot({path: testInfo.outputPath(`${theme}-island-chrome.png`)})
        }
        try {
            await surfaces.evaluateAll(elements => elements.forEach(e => {
                (e as HTMLElement).style.setProperty('box-shadow', 'none', 'important');
                (e as HTMLElement).style.setProperty('border-color', 'transparent', 'important')
            }))
            const bare = await screenshotPixels(page, points)
            for (const [i, sample] of samples.entries()) {
                const differences = sample.points.map((_, j) => Math.max(...painted[i * 8 + j]!
                    .map((channel, k) => Math.abs(channel - bare[i * 8 + j]![k]!))))
                if (['shiny', 'capillary', 'soft'].includes(theme)) {
                    expect(sample.shadow, sample.id).not.toBe('none')
                    expect(Math.max(...differences.slice(0, 3)), `${sample.id} left shadow pixels`).toBeGreaterThan(0)
                    if (theme !== 'soft') {
                        expect(Math.max(...differences.slice(3, 6)), `${sample.id} right shadow pixels`).toBeGreaterThan(0)
                    }
                }
                if (['capillary', 'minimal'].includes(theme)) {
                    expect(sample.border, sample.id).toBeGreaterThan(0)
                    expect(differences[6], `${sample.id} left border pixels`).toBeGreaterThan(0)
                    expect(differences[7], `${sample.id} right border pixels`).toBeGreaterThan(0)
                }
                if (theme === 'white') {
                    expect(sample.shadow).toBe('none')
                    expect(sample.border).toBe(0)
                }
            }
        } finally {
            await surfaces.evaluateAll((elements, samples) => elements.forEach((e, i) => {
                const style = samples[i]!.style
                if (style == null) e.removeAttribute('style')
                else e.setAttribute('style', style)
            }), samples)
        }
    })
}

for (const theme of ['shiny', 'capillary']) {
    test(`${theme}: line-input columns share one comfortable row rhythm`, async ({page}, testInfo) => {
        await page.getByRole('combobox', {name: 'Theme', exact: true}).selectOption(theme)
        const rowHeight = theme === 'capillary' ? 39 : 30
        const first = page.locator('#gallery-checkboxes cap-checkbox').first()
        await expect(first).toHaveCSS('min-height', `${rowHeight}px`)
        const rows = await page.locator('#gallery-line-inputs').evaluate(root => {
            const tags = ['cap-textbox', 'cap-dropdown', 'cap-toggle', 'cap-button',
                'cap-checkbox', 'cap-tricheckbox', 'cap-quadcheckbox', 'cap-radiobutton',
                'cap-datepicker', 'cap-timepicker', 'cap-datetimepicker', 'cap-progressbar']
            return [...root.querySelectorAll(tags.join(','))].map(e => {
                const s = getComputedStyle(e)
                return {tag: e.tagName, height: e.getBoundingClientRect().height,
                    padding: parseFloat(s.paddingBlockStart)}
            })
        })
        expect(rows.length).toBeGreaterThan(35)
        for (const row of rows) {
            expect(row.height, row.tag).toBeCloseTo(rowHeight, 1)
            expect(row.padding, row.tag).toBeCloseTo(3, 1)
        }
        const radioCenters = await page.locator('#gallery-basic-inputs cap-radiobutton')
            .evaluateAll(elements => elements.map(e => {
                const rect = e.getBoundingClientRect()
                return rect.top + rect.height / 2
            }))
        for (let i = 1; i < radioCenters.length; i++) {
            expect(radioCenters[i]! - radioCenters[i - 1]!).toBeCloseTo(rowHeight, 1)
        }
        if (testInfo.project.name === 'chromium') {
            await page.screenshot({path: testInfo.outputPath(`${theme}-row-spacing.png`)})
        }
    })
}

for (const variant of ['App shell', 'Website']) {
    test(`${variant}: shell and routed islands have one shared gutter`, async ({page}) => {
        await page.getByRole('radio', {name: variant, exact: true}).click()
        const spacing = await page.evaluate(() => {
            const root = document.querySelector('.gallery-root')!
            const header = document.querySelector('.gallery-masthead')!.getBoundingClientRect()
            const sidebar = document.querySelector('.gallery-sidebar')!.getBoundingClientRect()
            const body = document.querySelector('.gallery-page')!.getBoundingClientRect()
            const panel = document.querySelector('#gallery-line-inputs')!.getBoundingClientRect()
            const footer = document.querySelector('.gallery-footer')!.getBoundingClientRect()
            const canvas = root.getBoundingClientRect()
            const style = getComputedStyle(root)
            return {
                gap: parseFloat(style.gap),
                inset: parseFloat(style.paddingLeft),
                distances: [sidebar.top - header.bottom, panel.top - header.bottom,
                    panel.left - sidebar.right, footer.top - body.bottom],
                edges: [header.left - canvas.left, canvas.right - header.right,
                    sidebar.left - canvas.left, canvas.right - panel.right],
            }
        })
        expect(spacing.gap).toBeGreaterThan(0)
        for (const distance of spacing.distances) expect(distance).toBeCloseTo(spacing.gap, 1)
        for (const edge of spacing.edges) expect(edge).toBeCloseTo(spacing.inset, 1)
    })

    test(`${variant}: one island, one toolbar, three navigable rows and centered sidebar`, async ({page}) => {
        await page.getByRole('radio', {name: variant, exact: true}).click()
        await expect(page.locator('.gallery-main cap-panel')).toHaveCount(1)
        await expect(page.locator('.gallery-main cap-toolbar')).toHaveCount(1)
        await expect(page.getByRole('toolbar', {name: 'Line input toolbar', exact: true})
            .getByRole('radiogroup', {name: 'View', exact: true})).toBeVisible()
        const sidebar = page.locator('.gallery-sidebar')
        await expect(sidebar.locator('cap-optionsbox')).toHaveCount(2)
        await expect(sidebar.getByRole('group', {name: 'Presentation', exact: true})).toBeVisible()
        await expect(sidebar.getByRole('checkbox', {name: /^Active records/})).toBeVisible()
        await expect(sidebar.getByRole('checkbox', {name: /^Assigned to me/})).toBeVisible()
        await expect(sidebar.getByRole('checkbox', {name: /^Needs review/})).toBeVisible()
        const optionGeometry = await sidebar.locator('cap-optionsbox').evaluateAll(boxes =>
            boxes.map(box => {
                const optionGroup = box.querySelector<HTMLElement>('cap-optiongroup > fieldset')
                const radioGroup = box.querySelector<HTMLElement>('cap-radiogroup > fieldset')
                const checkboxes = [...box.querySelectorAll<HTMLElement>(
                    'cap-optiongroup > fieldset > cap-checkbox',
                )]
                const rects = checkboxes.map(checkbox => checkbox.getBoundingClientRect())
                return {
                    contentGap: getComputedStyle(box.querySelector('cap-content')!).gap,
                    optionDisplay: optionGroup == null ? null : getComputedStyle(optionGroup).display,
                    optionDirection: optionGroup == null ? null : getComputedStyle(optionGroup).flexDirection,
                    optionGap: optionGroup == null ? null : getComputedStyle(optionGroup).gap,
                    radioGap: radioGroup == null ? null : getComputedStyle(radioGroup).gap,
                    checkboxGaps: rects.slice(1).map((rect, index) => rect.top - rects[index]!.bottom),
                }
            }),
        )
        expect(optionGeometry.map(({checkboxGaps, ...geometry}) => geometry)).toEqual([
            {contentGap: '2px', optionDisplay: null, optionDirection: null, optionGap: null,
                radioGap: '2px'},
            {contentGap: '2px', optionDisplay: 'flex', optionDirection: 'column', optionGap: '2px',
                radioGap: null},
        ])
        await expect(sidebar.locator('cap-optionsbox').first().locator('cap-optiongroup')).toHaveCount(0)
        for (const gap of optionGeometry[1]!.checkboxGaps) expect(gap).toBeCloseTo(2, 2)
        for (const [id, count] of [['checkboxes', 5], ['basic-inputs', 6], ['date-time', 3]] as const) {
            const section = page.locator(`#gallery-${id}`)
            await expect(section).toHaveCount(1)
            await expect(section.locator(':scope > cap-content > cap-groupbox'))
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
        const margins = await page.locator('.gallery-filter-demo').evaluate((e) => {
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

test('Website variant grows the document and scrolls the page, not an inner region', async ({page}) => {
    // A short viewport guarantees the line-inputs content overflows the page.
    await page.setViewportSize({width: 1400, height: 600})
    await page.getByRole('radio', {name: 'Website', exact: true}).click()

    const metrics = await page.evaluate(() => {
        const visiblePage = [...document.querySelectorAll<HTMLElement>('.gallery-page')]
            .find((element) => element.offsetParent !== null)
        const main = visiblePage?.querySelector<HTMLElement>('.gallery-main')
        return {
            documentScrolls: document.documentElement.scrollHeight > window.innerHeight,
            mainInternalScroll: main == null ? null : main.scrollHeight > main.clientHeight + 1,
        }
    })
    expect(metrics.documentScrolls).toBe(true)
    expect(metrics.mainInternalScroll).toBe(false)
})

test('Read-only keeps value controls focusable and prevents value changes', async ({page}) => {
    await page.getByText('Read-only', {exact: true}).click()

    const textbox = page.locator('#gallery-basic-inputs cap-textbox input').nth(1)
    const dropdown = page.locator('#gallery-basic-inputs cap-dropdown select').nth(1)
    const checkbox = page.locator('#gallery-checkboxes cap-checkbox input').first()
    const radioGroup = page.locator('#gallery-basic-inputs cap-radiogroup fieldset')
    const toggle = page.locator('#gallery-basic-inputs cap-toggle cap-options').first()
    const temporalInputs = page.locator(
        '#gallery-date-time cap-datepicker input, #gallery-date-time cap-timepicker input, #gallery-date-time cap-datetimepicker input',
    )

    await expect(textbox).toHaveJSProperty('readOnly', true)
    await expect(dropdown).toHaveAttribute('aria-readonly', 'true')
    await expect(checkbox).toHaveAttribute('aria-readonly', 'true')
    await expect(radioGroup).toHaveAttribute('aria-readonly', 'true')
    await expect(toggle).toHaveAttribute('aria-readonly', 'true')
    await expect(temporalInputs).toHaveCount(6)
    for (const input of await temporalInputs.all()) await expect(input).toHaveJSProperty('readOnly', true)

    const textboxValue = await textbox.inputValue()
    await textbox.evaluate((input, value) => {
        input.value = `${value} changed`
        input.dispatchEvent(new Event('input', {bubbles: true}))
    }, textboxValue)
    await expect(textbox).toHaveValue(textboxValue)

    const dropdownValue = await dropdown.inputValue()
    await dropdown.focus()
    await expect(dropdown).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(dropdown).toHaveValue(dropdownValue)
    await dropdown.selectOption({index: 1})
    await expect(dropdown).toHaveValue(dropdownValue)

    const selectedToggle = toggle.getByRole('radio', {checked: true})
    const alternateToggle = toggle.getByRole('radio', {checked: false}).first()
    const toggleSeams = await toggle.getByRole('radio').evaluateAll(radios => radios.map(radio => {
        const chrome = getComputedStyle(radio, '::before')
        return {left: chrome.borderLeftWidth, right: chrome.borderRightWidth}
    }))
    expect(toggleSeams).toEqual([{left: '1px', right: '0px'}, {left: '0px', right: '1px'}])
    await alternateToggle.click()
    await expect(selectedToggle).toHaveAttribute('aria-checked', 'true')
})

test('empty required controls show required-value chrome', async ({page}) => {
    await page.getByText('Required', {exact: true}).click()

    const requiredChrome = await page.evaluate(() => {
        const textbox = document.querySelector<HTMLInputElement>(
            '#gallery-basic-inputs cap-textbox input',
        )!
        const dropdown = document.querySelector<HTMLSelectElement>(
            '#gallery-basic-inputs cap-dropdown select',
        )!
        const checkbox = document.querySelector<HTMLInputElement>(
            '#gallery-checkboxes cap-checkbox input',
        )!
        return {
            textbox: {
                missing: textbox.validity.valueMissing,
                outline: getComputedStyle(textbox).outlineStyle,
                indicator: getComputedStyle(textbox.closest('cap-textbox')!, '::after').content,
            },
            dropdown: {
                missing: dropdown.validity.valueMissing,
                outline: getComputedStyle(dropdown.parentElement!).outlineStyle,
                indicator: getComputedStyle(dropdown.closest('cap-dropdown')!, '::after').content,
            },
            checkbox: {
                missing: checkbox.validity.valueMissing,
                outline: getComputedStyle(checkbox.closest('label')!).outlineStyle,
                indicator: getComputedStyle(checkbox.closest('label')!, '::after').content,
            },
        }
    })

    expect(requiredChrome.textbox).toEqual({missing: true, outline: 'dashed', indicator: '"!"'})
    expect(requiredChrome.dropdown).toEqual({missing: true, outline: 'dashed', indicator: '"!"'})
    expect(requiredChrome.checkbox).toEqual({missing: true, outline: 'dashed', indicator: '"!"'})
})

test('section rules and natural columns retain usable control floors', async ({page}) => {
    await page.setViewportSize({width: 2000, height: 1100})
    const section = page.locator('#gallery-basic-inputs')
    const groups = section.locator(':scope > cap-content > cap-groupbox')
    const group = groups.first()
    const field = group.getByRole('textbox', {name: 'Long value', exact: true})
    expect((await field.boundingBox())!.width).toBeCloseTo(180, 1)
    expect((await section.getByRole('combobox', {name: 'Display mode', exact: true}).boundingBox())!.width)
        .toBeCloseTo(180, 1)

    const rowAlignment = await group.evaluate((element) => {
        const body = element.querySelector<HTMLElement>(':scope > cap-content')!
        const row = element.querySelector<HTMLElement>('cap-textbox')!
        const label = row.querySelector<HTMLElement>('label')!
        const input = row.querySelector<HTMLInputElement>('input')!
        const bodyBounds = body.getBoundingClientRect()
        const labelBounds = label.getBoundingClientRect()
        const inputBounds = input.getBoundingClientRect()
        return {
            labelOffset: labelBounds.left - bodyBounds.left,
            inputEndOffset: bodyBounds.right - inputBounds.right,
        }
    })
    expect(rowAlignment.labelOffset).toBeCloseTo(0, 1)
    expect(rowAlignment.inputEndOffset).toBeCloseTo(0, 1)

    const chrome = await section.evaluate((element) => {
        const header = element.querySelector<HTMLElement>(':scope > cap-header')!
        const columns = element.querySelectorAll<HTMLElement>(
            ':scope > cap-content > cap-groupbox',
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
        '#gallery-checkboxes > cap-content > cap-groupbox',
    )
    const checkboxWidths = await checkboxGroups
        .evaluateAll((es) => es.slice(0, 3).map((e) => e.getBoundingClientRect().width))
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
    const sidebar = page.locator('.gallery-filter-demo')
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

test('data collections distinguish refresh retention from replacement-loading skeletons', async ({page}, testInfo) => {
    await page.goto('/#/data-components')
    const main = page.locator('.gallery-main')
    await expect(main.getByRole('treeitem').first()).toBeVisible()
    const collections = ['#gallery-table cap-datatable', '#gallery-collections cap-listview',
        '#gallery-collections cap-treeview']
    const blockGraph = '#gallery-blockgraph cap-blockgraph'
    for (const state of [
        'Loading (refresh)', 'Ready', 'Initial', 'Ready', 'Loading (replace)', 'Loading (refresh)',
    ]) {
        await page.locator('.gallery-controls').getByRole('radio', {name: state, exact: true}).click()
        if (state === 'Ready') {
            for (const selector of [...collections, blockGraph]) {
                await expect(page.locator(selector).locator('cap-placeholder')).toHaveCount(0)
            }
            continue
        }
        if (state === 'Loading (refresh)') {
            for (const selector of collections) {
                const control = page.locator(selector)
                const busyTarget = selector.includes('cap-datatable')
                    ? control.locator('table')
                    : control
                await expect(busyTarget).toHaveAttribute('aria-busy', 'true')
                await expect(control.locator('cap-placeholder')).toHaveCount(0)
                await expect(control.locator('[data-cap-selectable-row], [role="treeitem"], [role="option"]'))
                    .not.toHaveCount(0)
            }
            await expect(page.locator(blockGraph).locator('cap-placeholder').first()).toBeVisible()
            continue
        }
        for (const selector of [...collections, blockGraph]) {
            const control = page.locator(selector)
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
