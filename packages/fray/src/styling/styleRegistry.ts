import {
    baseStyleDefinitions,
} from './baseStyleDefinitions.js'
import type {
    BaseStyleDefinition,
    BaseStyleName,
    CSSDeclarations,
    CSSVariantMap,
} from './baseStyleDefinitions.js'

const STYLE_ATTRIBUTE = 'data-fray-structural-styles'
let nextRegistryId = 1

/** Application-scoped structural-style collection and injection. */
export class StyleRegistry {
    readonly id: string
    private readonly cssFragments = new Set<string>()
    private readonly baseStyleMap = new Map<BaseStyleName, Set<string>>()

    constructor(id: string = `runtime-${nextRegistryId++}`) {
        if (typeof id !== 'string') throw new TypeError('StyleRegistry id must be a string')
        this.id = id
    }

    registerCSS(css: string): this {
        if (typeof css !== 'string') throw new TypeError('Component CSS must be a string')
        if (css.trim().length > 0) this.cssFragments.add(css.trim())
        return this
    }

    registerBaseStyle(selector: string, styleNames: string | readonly string[]): this {
        if (typeof selector !== 'string' || selector.trim().length === 0) {
            throw new TypeError('Base style selector must be a non-empty string')
        }
        const names = typeof styleNames === 'string' ? [styleNames] : styleNames
        if (!Array.isArray(names)) {
            throw new TypeError('Base style names must be a string or array')
        }

        for (const name of names) {
            if (!Object.hasOwn(baseStyleDefinitions, name)) {
                throw new Error(`Unknown Fray base style: ${String(name)}`)
            }
            const styleName = name as BaseStyleName
            const selectors = this.baseStyleMap.get(styleName) ?? new Set<string>()
            selectors.add(selector.trim())
            this.baseStyleMap.set(styleName, selectors)
        }
        return this
    }

    generateRootCSS(): string {
        return `:root {
  --base-font-size: 14px;
  --ui-font-size: var(--base-font-size);
  --ui-padding: 0.375rem;
  --ui-padding-h: 0.375rem;
  --ui-padding-v: 0;
  --ui-border-radius: 0.25rem;
  --input-width: 15rem;
  --spacing-small: 0.5rem;
  --spacing-medium: 1rem;
  --panel-padding: 0.75rem;
  --noselect-user-select: none;
  --noselect-cursor: default;
}

*, *::before, *::after {
  box-sizing: border-box;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media (forced-colors: active) {
  :focus-visible {
    outline: 2px solid Highlight !important;
    outline-offset: 2px !important;
  }
}`
    }

    generateBaseStyleCSS(): string {
        let generated = ''
        for (const [name, selectors] of this.baseStyleMap) {
            const {properties, variants} = splitDefinition(baseStyleDefinitions[name])
            const selectorList = [...selectors]
            generated += renderRule(name, selectorList, properties)
            for (const [variant, variantProperties] of Object.entries(variants)) {
                generated += renderRule(
                    `${name}${variant}`,
                    selectorList.map((selector) => appendVariant(selector, variant)),
                    variantProperties,
                )
            }
        }
        return generated.trim()
    }

    generateCSS(): string {
        return [
            this.generateRootCSS(),
            this.generateBaseStyleCSS(),
            [...this.cssFragments].join('\n\n'),
        ].filter(Boolean).join('\n\n')
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
        this.baseStyleMap.clear()
    }
}

/** Create an isolated registry for a configured Fray application runtime. */
export function createStyleRegistry(): StyleRegistry {
    return new StyleRegistry()
}

/** Backward-compatible structural styles for the default Fray runtime. */
export const styleRegistry = new StyleRegistry('')

function splitDefinition(definition: BaseStyleDefinition): {
    properties: CSSDeclarations
    variants: CSSVariantMap
} {
    const properties: CSSDeclarations = {}
    let variants: CSSVariantMap = {}
    for (const [property, value] of Object.entries(definition)) {
        if (property === 'variants') {
            if (typeof value !== 'object') {
                throw new TypeError('Base style variants must be declaration maps')
            }
            variants = value
        } else if (typeof value === 'string') {
            properties[property] = value
        } else {
            throw new TypeError(`Base style property ${property} must be a string`)
        }
    }
    return {properties, variants}
}

function renderRule(
    label: string,
    selectors: string[],
    properties: CSSDeclarations,
): string {
    if (selectors.length === 0 || Object.keys(properties).length === 0) return ''
    const declarations = Object.entries(properties)
        .map(([property, value]) => `  ${property}: ${value};`)
        .join('\n')
    return `/* ${label} */\n${selectors.join(',\n')} {\n${declarations}\n}\n\n`
}

function appendVariant(selector: string, variant: string): string {
    const pseudoElement = selector.indexOf('::')
    if (pseudoElement < 0) return `${selector}${variant}`
    return `${selector.slice(0, pseudoElement)}${variant}${selector.slice(pseudoElement)}`
}

function escapeAttributeValue(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
