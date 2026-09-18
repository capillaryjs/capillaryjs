import type {Page} from '@playwright/test'

export interface PaintPoint {
    x: number
    y: number
}

/** Read actual viewport screenshot pixels; no platform-specific image decoder
 * or font-sensitive full-page snapshot baseline is needed. */
export async function screenshotPixels(page: Page, points: readonly PaintPoint[]): Promise<number[][]> {
    const png = await page.screenshot({scale: 'css', animations: 'disabled'})
    return page.evaluate(async ({base64, points}) => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        return points.map(({x, y}) => {
            if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
                throw new Error(`Paint sample outside screenshot: ${x}, ${y}`)
            }
            return [...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3)
        })
    }, {base64: png.toString('base64'), points: [...points]})
}

/** Deterministic chrome for testing clipping independently of any theme. */
export const probeChrome = `
    .island {
        border: 2px solid rgb(192, 0, 192) !important;
        box-shadow: 0 0 0 4px rgb(0, 128, 0) !important;
        border-radius: 0 !important;
    }
`

export async function surfaceChromePixels(page: Page, selector: string) {
    const box = await page.locator(selector).boundingBox()
    if (box == null) throw new Error(`Missing painted surface: ${selector}`)
    const {x, y, width, height} = box
    const points = [
        {x: x - 2, y: y + height / 2},
        {x: x + width + 1, y: y + height / 2},
        {x: x + width / 2, y: y - 2},
        {x: x + width / 2, y: y + height + 1},
        {x: x + 0.5, y: y + height / 2},
        {x: x + width - 0.5, y: y + height / 2},
        {x: x + width / 2, y: y + 0.5},
        {x: x + width / 2, y: y + height - 0.5},
    ]
    const pixels = await screenshotPixels(page, points)
    return {shadow: pixels.slice(0, 4), border: pixels.slice(4)}
}

export const probeShadowPixels = Array.from({length: 4}, () => [0, 128, 0])
export const probeBorderPixels = Array.from({length: 4}, () => [192, 0, 192])
