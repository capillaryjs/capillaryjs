import type {
    Component,
    ComponentDependency,
} from './Components/component.js'
import {
    createStyleRegistry,
    styleRegistry,
} from './styling/styleRegistry.js'
import type {StyleRegistry} from './styling/styleRegistry.js'

const RESERVED_CUSTOM_ELEMENT_NAMES = new Set([
    'annotation-xml',
    'color-profile',
    'font-face',
    'font-face-src',
    'font-face-uri',
    'font-face-format',
    'font-face-name',
    'missing-glyph',
])

export interface FrayElementNameOptions {
    /** Namespace prepended to component host names. Defaults to `fray`. */
    prefix?: string | null
    /** Complete standards-valid tag names keyed by stable component host name. */
    overrides?: Readonly<Record<string, string>>
}

export interface FrayRuntimeOptions {
    elementNames?: FrayElementNameOptions
}

/** Immutable application scope for element naming and structural styles. */
export class FrayRuntime {
    readonly elementPrefix: string | null
    readonly elementNameOverrides: Readonly<Record<string, string>>
    readonly styleRegistry: StyleRegistry

    constructor(
        options: FrayRuntimeOptions = {},
        registry: StyleRegistry = createStyleRegistry(),
    ) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('FrayRuntime options must be an object')
        }
        const elementNames = options.elementNames ?? {}
        if (elementNames == null
            || typeof elementNames !== 'object'
            || Array.isArray(elementNames)) {
            throw new TypeError('Fray elementNames must be an object')
        }
        const prefix = elementNames.prefix === undefined ? 'fray' : elementNames.prefix
        if (prefix !== null) assertNamePart(prefix, 'Fray element prefix')

        const overrides = elementNames.overrides ?? {}
        if (overrides == null || typeof overrides !== 'object' || Array.isArray(overrides)) {
            throw new TypeError('Fray element-name overrides must be an object')
        }
        for (const [componentName, tagName] of Object.entries(overrides)) {
            assertNamePart(componentName, 'Fray component host name')
            assertCustomElementName(tagName)
        }

        this.elementPrefix = prefix
        this.elementNameOverrides = Object.freeze({...overrides})
        this.styleRegistry = registry
    }

    resolveElementName(hostName: string, standaloneHostName: string | null = null): string {
        assertNamePart(hostName, 'Fray component host name')
        const override = this.elementNameOverrides[hostName]
        const resolved = override
            ?? (this.elementPrefix == null
                ? standaloneHostName ?? hostName
                : `${this.elementPrefix}-${hostName}`)
        assertCustomElementName(resolved)
        return resolved
    }

    resolveHostSelector(
        selector: string,
        hostName: string,
        standaloneHostName: string | null = null,
    ): string {
        if (typeof selector !== 'string') throw new TypeError('Host selector must be a string')
        return selector.replaceAll('&', this.resolveElementName(hostName, standaloneHostName))
    }

    resolveHostCSS(
        cssText: string,
        hostName: string,
        standaloneHostName: string | null = null,
    ): string {
        if (typeof cssText !== 'string') throw new TypeError('Host CSS must be a string')
        return cssText.replaceAll('&', this.resolveElementName(hostName, standaloneHostName))
    }

    create<TArgs extends unknown[], TComponent extends Component>(
        componentType: new(...args: TArgs) => TComponent,
        ...args: TArgs
    ): TComponent {
        const component = new componentType(...args)
        component._setRuntime(this)
        return component
    }

    mount<TComponent extends Component>(
        component: TComponent,
        parent: ParentNode,
        before: Node | null = null,
    ): TComponent {
        component._setRuntime(this)
        component.mount(parent, before)
        return component
    }

    registerStyles(dependency: ComponentDependency): this {
        if (dependency == null || typeof dependency.registerStyles !== 'function') {
            throw new TypeError('registerStyles requires a Fray component dependency')
        }
        dependency.registerStyles(this)
        return this
    }

    injectStyles(targetDocument: Document = globalThis.document): HTMLStyleElement {
        return this.styleRegistry.injectAll(targetDocument)
    }
}

export function createFrayRuntime(options: FrayRuntimeOptions = {}): FrayRuntime {
    return new FrayRuntime(options)
}

/** Runtime used by Component.new(), direct mount(), and the legacy styleRegistry export. */
export const defaultFrayRuntime = new FrayRuntime({}, styleRegistry)

function assertNamePart(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
        throw new TypeError(`${label} must be a lowercase kebab-case name`)
    }
}

function assertCustomElementName(value: unknown): asserts value is string {
    assertNamePart(value, 'Fray element name')
    if (!value.includes('-') || RESERVED_CUSTOM_ELEMENT_NAMES.has(value)) {
        throw new TypeError(`Fray element name must be a non-reserved name containing a hyphen: ${value}`)
    }
}
