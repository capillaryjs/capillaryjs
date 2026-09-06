import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {after, before, describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {Window} from 'happy-dom'

import {
    Button,
    Checkbox,
    Component,
    Dropdown,
    Textbox,
    createFrayRuntime,
    frayColorOptions,
    frayThemeOptions,
    frayThemeVariableCatalog,
    getFrayAppearance,
    replaceFrayStylesheet,
    setFrayAppearance,
    styleRegistry,
} from '../src/index.js'

let window: Window

before(() => {
    window = new Window()
    Object.assign(globalThis, {
        window,
        document: window.document,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
    })
})

after(() => window.close())

describe('style registry', () => {
    test('injects and updates one structural stylesheet per document', () => {
        styleRegistry.reset()
        Button.registerStyles()
        const first = styleRegistry.injectAll(document)

        Textbox.registerStyles()
        const second = styleRegistry.injectAll(document)

        assert.equal(first, second)
        assert.equal(
            document.head.querySelectorAll('style[data-fray-structural-styles]').length,
            1,
        )
        assert.match(second.textContent, /button/)
        assert.match(second.textContent, /fray-textbox > input/)
        assert.doesNotMatch(second.textContent, /selectshell/)
        assert.doesNotMatch(second.textContent, /data-fray-component|undefined/)
    })

    test('collects class CSS and dependencies base-to-derived against the concrete host', () => {
        class BaseDependency extends Component {
            static override hostName = 'base-dependency'
            static override css = '& { --dependency-order: base; }'
        }
        class DerivedDependency extends Component {
            static override hostName = 'derived-dependency'
            static override css = '& { --dependency-order: derived; }'
        }
        abstract class BaseProbe extends Component {
            static override dependencies = [BaseDependency]
            static override css = '& { --class-order: base; }'
        }
        class DerivedProbe extends BaseProbe {
            static override hostName = 'derived-probe'
            static override dependencies = [DerivedDependency]
            static override css = '& { --class-order: derived; }'
        }

        const runtime = createFrayRuntime()
        runtime.registerStyles(DerivedProbe)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-derivedprobe\s*\{ --class-order: base; \}/)
        assert.match(stylesheet, /fray-derivedprobe\s*\{ --class-order: derived; \}/)
        assert.ok(stylesheet.indexOf('--class-order: base') < stylesheet.indexOf('--class-order: derived'))
        assert.match(stylesheet, /fray-basedependency/)
        assert.match(stylesheet, /fray-deriveddependency/)
        assert.doesNotMatch(stylesheet, /&|fray-baseprobe/)
    })

    test('select controls inherit shared input and select-shell CSS without recipes', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Dropdown)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-dropdown\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-dropdown > \.selectshell\s*\{/)
        assert.match(stylesheet, /fray-dropdown > \.selectshell::before\s*\{/)
        assert.match(stylesheet, /fray-dropdown > \.selectshell::after\s*\{/)
        assert.match(stylesheet, /appearance:\s*var\(--dropdown-appearance\)/)
    })

    test('keeps checkbox controls separate from generic input and button treatment', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Checkbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-checkbox\s*\{[^}]*display:\s*inline-flex[^}]*line-height:\s*1/)
        assert.match(stylesheet, /fray-checkbox > label\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /input\[type="checkbox"\] \+ \.checkboxshell/)
        assert.doesNotMatch(stylesheet, /fray-checkbox\s*\{[^}]*width:\s*var\(--input-width/)
    })

    test('uses fixed one-hyphen host names and resolves ampersands', () => {
        class Probe extends Component {
            static override hostName = 'probe'
            static override css = '& { display: block; }'
            render() { return this.host(null, 'configured') }
        }

        const runtime = createFrayRuntime()
        runtime.registerStyles(Probe).injectStyles(document)
        const probe = runtime.mount(runtime.create(Probe), document.body)
        assert.equal(probe.dom?.nodeName.toLowerCase(), 'fray-probe')
        assert.match(runtime.styleRegistry.generateCSS(), /fray-probe/)
        assert.doesNotMatch(runtime.styleRegistry.generateCSS(), /&/)
        probe.destroy()
    })
})

describe('four-file styling contract', () => {
    test('base.css owns defaults and palette derivation but no presentation selectors', async () => {
        const css = await readFile(
            fileURLToPath(new URL('../themes/base.css', import.meta.url)),
            'utf8',
        )
        assertVariableOnly(css, false)
        assert.doesNotMatch(css, /@import/)
        for (const family of ['primary', 'secondary', 'neutral']) {
            assert.match(css, new RegExp(`--palette-${family}-500:`))
            assert.match(css, new RegExp(`--palette-${family}-light-mix:\\s*var\\(--palette-light\\)`))
            assert.match(css, new RegExp(`--palette-${family}-900:[^;]*--palette-${family}-dark-mix`))
        }
        for (const {name, fallback} of frayThemeVariableCatalog) {
            if (fallback == null) assert.match(css, new RegExp(`${name}:`))
        }
    })

    test('color files contain anchors/endpoints only and never import base.css', async () => {
        for (const option of frayColorOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            assertVariableOnly(css, false)
            assert.doesNotMatch(css, /@import/)
            assert.doesNotMatch(css, /^\s*--(?!palette-)[a-z0-9-]+\s*:/m)
            for (const family of ['primary', 'secondary', 'neutral']) {
                assert.match(css, new RegExp(`--palette-${family}-500:`))
                assert.doesNotMatch(css, new RegExp(`--palette-${family}-(?:50|100|200|300|400|600|700|800|900|950):`))
            }
        }
    })

    test('theme files contain intentional overrides only and never import base.css', async () => {
        const base = await readFile(
            fileURLToPath(new URL('../themes/base.css', import.meta.url)),
            'utf8',
        )
        const baseDeclarations = oneLineCustomProperties(base)
        for (const option of frayThemeOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            assertVariableOnly(css, true)
            assert.doesNotMatch(css, /@import/)
            assert.doesNotMatch(css, /fray-|\[data-fray|\.buttonlike|\.selectshell/)
            assert.doesNotMatch(css, /^\s*--palette-[a-z0-9-]+\s*:/m)
            for (const [name, value] of oneLineCustomProperties(css)) {
                assert.notEqual(value, baseDeclarations.get(name),
                    `${option.value} repeats the base value for ${name}`)
            }
        }
    })

    test('catalog fallbacks reference declared variables', () => {
        const names = new Set(frayThemeVariableCatalog.map(({name}) => name))
        assert.equal(names.size, frayThemeVariableCatalog.length)
        for (const definition of frayThemeVariableCatalog) {
            if (definition.fallback != null) assert.ok(names.has(definition.fallback))
        }
    })

    test('replaces theme and color links independently', () => {
        document.head.replaceChildren()
        const theme = frayThemeOptions[0]!
        const colors = frayColorOptions[0]!
        const themeLink = replaceFrayStylesheet('theme', theme, document)
        const colorLink = replaceFrayStylesheet('colors', colors, document)
        assert.notEqual(themeLink, colorLink)
        assert.equal(document.head.querySelectorAll('link[rel="stylesheet"]').length, 2)
        assert.equal(document.documentElement.dataset.theme, theme.value)
        assert.equal(document.documentElement.dataset.color, colors.value)
    })

    test('uses one root appearance setting for adaptive themes', () => {
        document.documentElement.removeAttribute('data-appearance')
        assert.equal(getFrayAppearance(document), 'system')
        setFrayAppearance('dark', document)
        assert.equal(getFrayAppearance(document), 'dark')
        setFrayAppearance('system', document)
        assert.equal(document.documentElement.hasAttribute('data-appearance'), false)
        assert.throws(() => setFrayAppearance('dim' as never, document), /light, dark, or system/)
    })

    test('publishes base, generated structural, theme, and color assets', async () => {
        const packagePath = fileURLToPath(new URL('../package.json', import.meta.url))
        const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
            exports?: Record<string, unknown>
        }
        assert.equal(packageJson.exports?.['./themes/base.css'], './themes/base.css')
        assert.equal(packageJson.exports?.['./styles/structural.css'], './styles/structural.css')
        assert.equal(packageJson.exports?.['./themes/*/theme.css'], './themes/*/theme.css')
        assert.equal(packageJson.exports?.['./colors/*/colors.css'], './colors/*/colors.css')

        const structural = await readFile(
            fileURLToPath(new URL('../styles/structural.css', import.meta.url)),
            'utf8',
        )
        assert.match(structural, /Generated by scripts\/build-structural-css\.mjs/)
        assert.doesNotMatch(structural, /^\s*--palette-[a-z0-9-]+\s*:/m)
    })
})

function assertVariableOnly(css: string, allowColorScheme: boolean): void {
    const declarations = [...css.matchAll(/^\s*([a-z-]+)\s*:/gmi)].map(([, name]) => name!)
    const unexpected = declarations.filter((name) =>
        !name.startsWith('--') && !(allowColorScheme && name === 'color-scheme'))
    assert.deepEqual(unexpected, [])
    assert.doesNotMatch(css, /@scope|:where\(|@media/)
}

function oneLineCustomProperties(css: string): Map<string, string> {
    return new Map([...css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;\n]+);/gmi)]
        .map(([, name, value]) => [name!, value!.trim()]))
}
