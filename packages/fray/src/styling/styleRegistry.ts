const STYLE_ATTRIBUTE = 'data-fray-structural-styles'
let nextRegistryId = 1

/** Application-scoped structural-style collection and injection. */
export class StyleRegistry {
    readonly id: string
    private readonly cssFragments = new Set<string>()

    constructor(id: string = `runtime-${nextRegistryId++}`) {
        if (typeof id !== 'string') throw new TypeError('StyleRegistry id must be a string')
        this.id = id
    }

    registerCSS(css: string): this {
        if (typeof css !== 'string') throw new TypeError('Component CSS must be a string')
        if (css.trim().length > 0) this.cssFragments.add(css.trim())
        return this
    }

    generateCSS(): string {
        return [...this.cssFragments].join('\n\n')
    }

    injectAll(targetDocument: Document = globalThis.document): HTMLStyleElement {
        if (targetDocument?.head == null) {
            throw new TypeError('StyleRegistry.injectAll requires a document with a head')
        }
        const selector = `style[${STYLE_ATTRIBUTE}="${escapeAttributeValue(this.id)}"]`
        let style = targetDocument.head.querySelector<HTMLStyleElement>(selector)
        if (style == null) {
            style = targetDocument.createElement('style')
            style.setAttribute(STYLE_ATTRIBUTE, this.id)
            targetDocument.head.prepend(style)
        }
        const css = this.generateCSS()
        if (style.textContent !== css) style.textContent = css
        return style
    }

    reset(): void {
        this.cssFragments.clear()
    }
}

/** Create an isolated registry for a configured Fray application runtime. */
export function createStyleRegistry(): StyleRegistry {
    return new StyleRegistry()
}

/** Backward-compatible structural styles for the default Fray runtime. */
export const styleRegistry = new StyleRegistry('')

function escapeAttributeValue(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
