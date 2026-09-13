export interface NavigationAdapter {
    read(): string
    href(location: string): string
    push(location: string): void
    replace(location: string): void
    subscribe(listener: () => void): () => void
}

export interface HistoryNavigationOptions {
    basePath?: string
}

export interface BrowserNavigationTarget extends EventTarget {
    readonly location: Location
    readonly history: History
}

export class MemoryNavigationAdapter implements NavigationAdapter {
    private readonly listeners = new Set<() => void>()
    private entries: string[]
    private index = 0

    constructor(initialLocation = '/') {
        this.entries = [normalizeRouteLocation(initialLocation)]
    }

    read(): string {
        return this.entries[this.index] ?? '/'
    }

    href(location: string): string {
        return normalizeRouteLocation(location)
    }

    push(location: string): void {
        this.entries = this.entries.slice(0, this.index + 1)
        this.entries.push(normalizeRouteLocation(location))
        this.index += 1
    }

    replace(location: string): void {
        this.entries[this.index] = normalizeRouteLocation(location)
    }

    subscribe(listener: () => void): () => void {
        if (typeof listener !== 'function') {
            throw new TypeError('Navigation adapter subscriber must be a function')
        }
        this.listeners.add(listener)
        let active = true
        return () => {
            if (!active) return
            active = false
            this.listeners.delete(listener)
        }
    }

    back(): void {
        if (this.index === 0) return
        this.index -= 1
        this.notify()
    }

    forward(): void {
        if (this.index >= this.entries.length - 1) return
        this.index += 1
        this.notify()
    }

    get length(): number {
        return this.entries.length
    }

    private notify(): void {
        for (const listener of [...this.listeners]) listener()
    }
}

export function createHistoryNavigation(
    target: BrowserNavigationTarget = globalThis.window,
    options: HistoryNavigationOptions = {},
): NavigationAdapter {
    assertBrowserTarget(target)
    const basePath = normalizeBasePath(options.basePath ?? '/')
    return {
        read() {
            const pathname = target.location.pathname
            const relative = pathname === basePath.slice(0, -1)
                ? '/'
                : pathname.startsWith(basePath)
                    ? `/${pathname.slice(basePath.length)}`
                    : pathname
            return normalizeRouteLocation(`${relative}${target.location.search}`)
        },
        href(location) {
            const normalized = normalizeRouteLocation(location)
            return `${basePath}${normalized.slice(1)}`
        },
        push(location) {
            target.history.pushState(null, '', this.href(location))
        },
        replace(location) {
            target.history.replaceState(null, '', this.href(location))
        },
        subscribe(listener) {
            target.addEventListener('popstate', listener)
            return () => target.removeEventListener('popstate', listener)
        },
    }
}

export function createHashNavigation(
    target: BrowserNavigationTarget = globalThis.window,
): NavigationAdapter {
    assertBrowserTarget(target)
    return {
        read() {
            return normalizeRouteLocation(target.location.hash.slice(1) || '/')
        },
        href(location) {
            return `#${normalizeRouteLocation(location)}`
        },
        push(location) {
            target.history.pushState(null, '', this.href(location))
        },
        replace(location) {
            target.history.replaceState(null, '', this.href(location))
        },
        subscribe(listener) {
            let last = this.read()
            const notify = () => {
                const next = this.read()
                if (next === last) return
                last = next
                listener()
            }
            target.addEventListener('popstate', notify)
            target.addEventListener('hashchange', notify)
            return () => {
                target.removeEventListener('popstate', notify)
                target.removeEventListener('hashchange', notify)
            }
        },
    }
}

export function normalizeRouteLocation(location: string): string {
    if (typeof location !== 'string') throw new TypeError('Route location must be a string')
    const hashIndex = location.indexOf('#')
    const withoutHash = hashIndex < 0 ? location : location.slice(0, hashIndex)
    const queryIndex = withoutHash.indexOf('?')
    const rawPath = queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex)
    const search = queryIndex < 0 ? '' : withoutHash.slice(queryIndex)
    const rooted = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    const pathname = rooted.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
    return `${pathname}${search}`
}

function normalizeBasePath(value: string): string {
    const normalized = normalizeRouteLocation(value).split('?')[0] ?? '/'
    return normalized === '/' ? '/' : `${normalized}/`
}

function assertBrowserTarget(value: unknown): asserts value is BrowserNavigationTarget {
    if (value == null
        || typeof value !== 'object'
        || !('location' in value)
        || !('history' in value)
        || !('addEventListener' in value)) {
        throw new TypeError('Browser navigation requires a window-like target')
    }
}
