import {expect, test, type Page} from '@playwright/test'
import {readFile} from 'node:fs/promises'

const colors = ['iceblue', 'ocean', 'green', 'gray', 'orange', 'purple', 'red', 'yellow']
const legacySurfaces = [[245, 247, 248, 255], [235, 239, 243, 255], [215, 222, 227, 255]]
const uiAliases = ['--ui-primary-bg-color', '--ui-medium-bg-color', '--ui-dark-bg-color']

async function stylesheet(path: string): Promise<string> {
    return readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}

// Resolve real CSS through the browser, then normalize to sRGB bytes rather than
// depending on engine-specific color()/rgb() computed-style serialization.
async function surfaceColors(page: Page): Promise<[number, number, number, number][]> {
    return page.evaluate((names) => {
        const probe = document.createElement('span')
        document.body.append(probe)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d')!
        try {
            return names.map((name): [number, number, number, number] => {
                probe.style.backgroundColor = `var(${name})`
                context.clearRect(0, 0, 1, 1)
                context.fillStyle = getComputedStyle(probe).backgroundColor
                context.fillRect(0, 0, 1, 1)
                const bytes = context.getImageData(0, 0, 1, 1).data
                return [bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!]
            })
        } finally {
            probe.remove()
        }
    }, uiAliases)
}

test.beforeEach(async ({page}) => {
    await page.goto('/')
    await page.waitForFunction(() => globalThis.capillaryUiTestReady === true)
    await page.addStyleTag({content: await stylesheet('themes/base.css')})
})

test('muted surfaces follow every palette in every theme and preserve exact Ice blue colors',
    async ({page}) => {
        // The base alone uses the same primary/light reference anchors.
        expect(await surfaceColors(page)).toEqual(legacySurfaces)
        for (const theme of ['capillary', 'shiny', 'soft', 'white', 'minimal']) {
            const themeStyle = await page.addStyleTag({content: await stylesheet(`themes/${theme}/theme.css`)})
            const distinct = uiAliases.map(() => new Set<string>())
            for (const color of colors) {
                const colorStyle = await page.addStyleTag({content: await stylesheet(`colors/${color}/colors.css`)})
                const surfaces = await surfaceColors(page)
                if (color === 'iceblue') expect(surfaces).toEqual(legacySurfaces)
                const brightness: number[] = []
                surfaces.forEach(([r, g, b, alpha], index) => {
                    expect(alpha, `${theme}/${color} ${uiAliases[index]} opacity`).toBe(255)
                    expect(Math.min(r, g, b), `${theme}/${color} light surface`).toBeGreaterThan(180)
                    expect(Math.max(r, g, b) - Math.min(r, g, b), `${theme}/${color} muted surface`).toBeLessThan(40)
                    brightness.push(r + g + b)
                    distinct[index]!.add(`${r},${g},${b}`)
                })
                expect(brightness[0]).toBeGreaterThan(brightness[1]!)
                expect(brightness[1]).toBeGreaterThan(brightness[2]!)
                await colorStyle.evaluate((element) => element.parentNode?.removeChild(element))
            }
            distinct.forEach((values) => expect(values.size).toBe(colors.length))
            await themeStyle.evaluate((element) => element.parentNode?.removeChild(element))
        }
    })

test('palette surface saturation scales only the three muted chrome surfaces', async ({page}) => {
    await page.addStyleTag({content: await stylesheet('colors/iceblue/colors.css')})
    const calibrated = await surfaceColors(page)
    expect(calibrated).toEqual(legacySurfaces)

    const half = await page.addStyleTag({content: ':root { --palette-primary-surface-saturation: .5; }'})
    const halfSaturated = await surfaceColors(page)
    halfSaturated.forEach(([r, g, b], index) => {
        expect(Math.max(r, g, b) - Math.min(r, g, b), uiAliases[index]).toBeLessThan(
            Math.max(...calibrated[index]!) - Math.min(...calibrated[index]!),
        )
    })

    const neutral = await page.addStyleTag({content: ':root { --palette-primary-surface-saturation: 0; }'})
    const neutralSurfaces = await surfaceColors(page)
    neutralSurfaces.forEach(([r, g, b], index) => {
        expect(r, `${uiAliases[index]} red/green`).toBe(g)
        expect(g, `${uiAliases[index]} green/blue`).toBe(b)
    })
    await neutral.evaluate((element) => element.parentNode?.removeChild(element))
    await half.evaluate((element) => element.parentNode?.removeChild(element))
    expect(await surfaceColors(page)).toEqual(legacySurfaces)
})

test('Shiny retains legacy panel, table, and button pixels while chrome responds to palette overrides',
    async ({page}) => {
        await page.addStyleTag({content: await stylesheet('colors/iceblue/colors.css')})
        await page.addStyleTag({content: await stylesheet('themes/shiny/theme.css')})
        const panel = page.locator('#panel-review-probe')
        const header = page.locator('cap-datatable > table > thead').first()
        const button = page.getByRole('button', {name: 'Save', exact: true})
        const progress = page.locator('#record-primitives-root cap-progressbar > cap-content').first()
        // Gradients whose two endpoints are palette-derived resolve as color()
        // values. Their interpolation can differ from literal legacy hex stops,
        // even when the endpoint bytes are identical; the surface regression
        // above covers those bytes. These three legacy surfaces retain pixels.
        const pixelComponents = [panel, header, button]
        const images = []
        for (const component of pixelComponents) images.push(await component.screenshot({animations: 'disabled'}))
        const legacyStyle = await page.addStyleTag({content: `:root {
            --ui-primary-bg-color: #f5f7f8;
            --ui-medium-bg-color: #ebeff3;
            --ui-dark-bg-color: #d7dee3;
            --ui-gradient: linear-gradient(to top, var(--ui-primary-bg-color) 9px, var(--ui-primary-bg-color) 13px, var(--ui-dark-bg-color) 100%);
            --ui-gradient-2: linear-gradient(to bottom, var(--ui-primary-bg-color) 9px, var(--ui-primary-bg-color) 13px, var(--ui-dark-bg-color) 100%);
            --progress-track-background: linear-gradient(0deg, var(--ui-dark-bg-color) 0%, #f0f0f0 100%);
        }`})
        for (const [index, component] of pixelComponents.entries()) {
            const legacyImage = await component.screenshot({animations: 'disabled'})
            const derivedImage = images[index]!
            if (!legacyImage.equals(derivedImage)) {
                await test.info().attach(`derived-${index}`, {body: derivedImage, contentType: 'image/png'})
                await test.info().attach(`legacy-${index}`, {body: legacyImage, contentType: 'image/png'})
            }
            expect(legacyImage.equals(derivedImage), `Shiny component ${index} matches legacy pixels`).toBe(true)
        }
        await legacyStyle.evaluate((element) => element.parentNode?.removeChild(element))

        const backgrounds = async () => Promise.all([...pixelComponents, progress].map((component) => component.evaluate(
            (element) => getComputedStyle(element).background,
        )))
        const iceblueBackgrounds = await backgrounds()
        const primaryOverride = await page.addStyleTag({content: ':root { --palette-primary-500: #a94b00; }'})
        const orangeSurfaces = await surfaceColors(page)
        orangeSurfaces.forEach((value, index) => expect(value).not.toEqual(legacySurfaces[index]))
        const orangeBackgrounds = await backgrounds()
        orangeBackgrounds.forEach((value, index) => expect(value).not.toBe(iceblueBackgrounds[index]))
        await primaryOverride.evaluate((element) => element.parentNode?.removeChild(element))

        const lightOverride = await page.addStyleTag({content: ':root { --palette-light: #fff3dc; }'})
        const tintedSurfaces = await surfaceColors(page)
        tintedSurfaces.forEach((value, index) => expect(value).not.toEqual(legacySurfaces[index]))
        await lightOverride.evaluate((element) => element.parentNode?.removeChild(element))
        expect(await surfaceColors(page)).toEqual(legacySurfaces)

        // Existing application overrides continue to win over the palette aliases.
        await page.addStyleTag({content: ':root { --ui-primary-bg-color: rgb(1 2 3); }'})
        await expect(panel).toHaveCSS('background-color', 'rgb(1, 2, 3)')
    })
