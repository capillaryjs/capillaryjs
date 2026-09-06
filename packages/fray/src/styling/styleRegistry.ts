const STYLE_ATTRIBUTE = 'data-fray-structural-styles'
let nextRegistryId = 1

type CSSFragment = RawCSSFragment | HostCSSFragment

interface RawCSSFragment {
    readonly kind: 'raw'
    readonly css: string
}

interface HostCSSFragment {
    readonly kind: 'host'
    readonly css: string
    readonly hosts: Set<string>
}

/** Application-scoped structural-style collection and injection. */
export class StyleRegistry {
    readonly id: string
    private readonly cssFragments = new Map<string, CSSFragment>()

    constructor(id: string = `runtime-${nextRegistryId++}`) {
        if (typeof id !== 'string') throw new TypeError('StyleRegistry id must be a string')
        this.id = id
    }

    registerCSS(css: string): this {
        if (typeof css !== 'string') throw new TypeError('Component CSS must be a string')
        const normalized = css.trim()
        if (normalized.length > 0) {
            this.cssFragments.set(`raw:${normalized}`, {kind: 'raw', css: normalized})
        }
        return this
    }

    /** @internal Collect a host-relative component template without resolving it yet. */
    registerHostCSS(css: string, host: string): this {
        if (typeof css !== 'string') throw new TypeError('Component CSS must be a string')
        if (typeof host !== 'string' || host.trim().length === 0) {
            throw new TypeError('Component CSS host must be a non-empty selector')
        }
        const normalized = css.trim()
        if (normalized.length === 0) return this
        if (!normalized.includes('&')) return this.registerCSS(normalized)

        const key = `host:${normalized}`
        const existing = this.cssFragments.get(key)
        if (existing == null) {
            this.cssFragments.set(key, {
                kind: 'host',
                css: normalized,
                hosts: new Set([host.trim()]),
            })
        } else if (existing.kind === 'host') {
            existing.hosts.add(host.trim())
        }
        return this
    }

    generateCSS(): string {
        return [...this.cssFragments.values()]
            .map(fragment => fragment.kind === 'raw'
                ? fragment.css
                : resolveHostCSS(fragment.css, [...fragment.hosts]))
            .join('\n\n')
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

function resolveHostCSS(css: string, hosts: readonly string[]): string {
    let output = ''
    let cursor = 0
    while (cursor < css.length) {
        const openBrace = findBrace(css, cursor)
        if (openBrace < 0) return output + css.slice(cursor)
        const closeBrace = findMatchingBrace(css, openBrace)
        if (closeBrace < 0) return output + css.slice(cursor)

        const header = css.slice(cursor, openBrace)
        const body = css.slice(openBrace + 1, closeBrace)
        const rule = header.trim()
        output += rule.startsWith('@')
            ? `${header}{${resolveHostCSS(body, hosts)}}`
            : `${expandHostSelectors(header, hosts)}{${body}}`
        cursor = closeBrace + 1
    }
    return output
}

function expandHostSelectors(header: string, hosts: readonly string[]): string {
    if (hosts.length === 1 || !header.includes('&')) {
        return hosts.length === 1 ? header.replaceAll('&', hosts[0]!) : header
    }
    const leading = header.match(/^\s*/)?.[0] ?? ''
    const trailing = header.match(/\s*$/)?.[0] ?? ''
    const selectors = splitSelectors(header.trim())
    const continuationIndent = leading.match(/(?:^|\n)([ \t]*)$/)?.[1] ?? ''
    return leading + selectors.flatMap(selector => selector.includes('&')
        ? hosts.map(host => selector.replaceAll('&', host))
        : [selector]).join(`,\n${continuationIndent}`) + trailing
}

function splitSelectors(selectors: string): string[] {
    const result: string[] = []
    let start = 0
    let parentheses = 0
    let brackets = 0
    let quote: '"' | "'" | null = null
    for (let index = 0; index < selectors.length; index += 1) {
        const character = selectors[index]!
        if (quote != null) {
            if (character === '\\') index += 1
            else if (character === quote) quote = null
            continue
        }
        if (character === '"' || character === "'") {
            quote = character
        } else if (character === '(') {
            parentheses += 1
        } else if (character === ')') {
            parentheses -= 1
        } else if (character === '[') {
            brackets += 1
        } else if (character === ']') {
            brackets -= 1
        } else if (character === ',' && parentheses === 0 && brackets === 0) {
            result.push(selectors.slice(start, index).trim())
            start = index + 1
        }
    }
    result.push(selectors.slice(start).trim())
    return result.filter(Boolean)
}

function findBrace(css: string, from: number): number {
    for (let index = from; index < css.length; index += 1) {
        const character = css[index]!
        if (character === '"' || character === "'") {
            index = skipQuote(css, index)
        } else if (character === '/' && css[index + 1] === '*') {
            index = skipComment(css, index)
        } else if (character === '{') {
            return index
        }
    }
    return -1
}

function findMatchingBrace(css: string, openBrace: number): number {
    let depth = 1
    for (let index = openBrace + 1; index < css.length; index += 1) {
        const character = css[index]!
        if (character === '"' || character === "'") {
            index = skipQuote(css, index)
        } else if (character === '/' && css[index + 1] === '*') {
            index = skipComment(css, index)
        } else if (character === '{') {
            depth += 1
        } else if (character === '}' && --depth === 0) {
            return index
        }
    }
    return -1
}

function skipQuote(css: string, openQuote: number): number {
    const quote = css[openQuote]!
    for (let index = openQuote + 1; index < css.length; index += 1) {
        if (css[index] === '\\') index += 1
        else if (css[index] === quote) return index
    }
    return css.length
}

function skipComment(css: string, openComment: number): number {
    const closeComment = css.indexOf('*/', openComment + 2)
    return closeComment < 0 ? css.length : closeComment + 1
}
