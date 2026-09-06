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
    Header,
    Panel,
    ProgressBar,
    RadioButton,
    Sidebar,
    SplitView,
    TabLine,
    Textbox,
    Toggle,
    Toolbar,
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
        assert.match(second.textContent, /fray-button > button/)
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

    test('collects Button CSS only through its fixed host', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Button)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-button > button\s*\{[^}]*background:\s*var\(--button-background\)/)
        assert.match(stylesheet, /fray-button > button:focus-visible/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)button\s*\{|data-fray-component|fray-panel|fray-sidebar/)
    })

    test('select controls inherit shared fixed-shell CSS without recipes', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Dropdown)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-dropdown\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-dropdown > fray-selectshell\s*\{/)
        assert.match(stylesheet, /fray-dropdown > fray-selectshell::before\s*\{/)
        assert.match(stylesheet, /fray-dropdown > fray-selectshell::after\s*\{/)
        assert.match(stylesheet, /appearance:\s*var\(--dropdown-appearance\)/)
        assert.doesNotMatch(stylesheet, /\.selectshell|data-disabled|data-required|data-error|fray-dropdown > (?:input|textarea)/)
    })

    test('keeps checkbox controls separate from generic input and button treatment', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Checkbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-checkbox\s*\{[^}]*display:\s*inline-flex[^}]*line-height:\s*1/)
        assert.match(stylesheet, /fray-checkbox > label\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /input\[type="checkbox"\] \+ fray-checkboxshell/)
        assert.match(stylesheet, /label:has\(> input\[type="checkbox"\]:disabled\)\s*\{[^}]*color:\s*#aaa[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /fray-checkboxshell\s*\{[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
        assert.match(stylesheet, /input\[type="checkbox"\]:checked \+ fray-checkboxshell\s*\{[^}]*box-shadow:\s*var\(--checkbox-box-shadow-checked\)/)
        assert.doesNotMatch(stylesheet, /\.checkboxshell|\[data-(?:disabled|required|error|state)\]|fray-checkbox\s*\{[^}]*width:\s*var\(--input-width/)
    })

    test('collects RadioButton through its fixed shell and native state selectors', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(RadioButton)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-radiobutton\s*\{[^}]*display:\s*inline-flex/)
        assert.match(stylesheet, /fray-radiobutton > label:has\(> input\[type="radio"\]:disabled\)\s*\{[^}]*color:\s*#aaa[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /input\[type="radio"\] \+ fray-radioshell\s*\{[^}]*border-radius:\s*1em[^}]*background:\s*var\(--checkbox-box-background\)[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
        assert.match(stylesheet, /input\[type="radio"\]:checked \+ fray-radioshell\s*\{[^}]*background:\s*var\(--checkbox-box-background-checked\)[^}]*box-shadow:\s*var\(--checkbox-box-shadow-checked\)/)
        assert.match(stylesheet, /input\[type="radio"\]:checked \+ fray-radioshell::after\s*\{[^}]*border-radius:\s*50%[^}]*background:\s*var\(--checkbox-symbol-color\)/)
        assert.match(stylesheet, /input\[type="radio"\]:disabled \+ fray-radioshell\s*\{[^}]*opacity:\s*0\.6[^}]*filter:\s*saturate\(0\.6\)/)
        assert.match(stylesheet, /input\[type="radio"\]:focus-visible \+ fray-radioshell\s*\{[^}]*outline:\s*2px solid var\(--focus-color\)/)
        assert.doesNotMatch(stylesheet, /\.radioshell|data-disabled|data-required|data-error|fray-radiogroup/)
    })

    test('collects ProgressBar through its fixed clipped-label parts and native semantics', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(ProgressBar)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-progressbar\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /fray-progressbar > label,[\s\S]*fray-progressbar > progress\s*\{[^}]*clip:\s*rect\(0 0 0 0\)/)
        assert.match(stylesheet, /fray-progressbar > fray-content\s*\{[^}]*background:\s*var\(--progress-track-background\)[^}]*box-shadow:\s*var\(--progress-track-shadow\)/)
        assert.match(stylesheet, /fray-progressbar > fray-content > fray-progress\s*\{[^}]*width:\s*var\(--progress-width, 0%\)[^}]*background:\s*var\(--progress-value-background\)[^}]*box-shadow:\s*var\(--progress-value-shadow\)/)
        assert.match(stylesheet, /fray-progressbar > fray-content > fray-progress > fray-inverse\s*\{[^}]*width:\s*var\(--progress-inverse-width, 10000%\)[^}]*color:\s*var\(--progress-value-color\)/)
        assert.match(stylesheet, /fray-progressbar:has\(> progress:indeterminate\) > fray-content > fray-progress\s*\{[^}]*display:\s*none/)
        assert.match(stylesheet, /@media \(forced-colors: active\)[\s\S]*fray-progressbar > fray-content > fray-progress\s*\{[^}]*background:\s*Highlight/)
        assert.doesNotMatch(stylesheet, /data-part|fray-checkbox|fray-dropdown|fray-panel/)
    })

    test('collects Textbox with its meaningful labelled-input base only', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Textbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-textbox\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-textbox > input\s*\{[^}]*background:\s*var\(--input-background\)/)
        assert.match(stylesheet, /fray-textbox > input\s*\{[^}]*cursor:\s*text/)
        assert.match(stylesheet, /fray-textbox > input:disabled\s*\{[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /fray-textbox > input:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
        assert.doesNotMatch(stylesheet, /textarea|data-disabled|data-required|data-error|fray-dropdown|fray-button/)
    })

    test('collects the complete Panel treatment without unrelated component CSS', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Panel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-panel\s*\{[^}]*background:\s*var\(--panel-background\)/)
        assert.match(stylesheet, /fray-header\s*\{[^}]*padding:\s*\.25em/)
        assert.match(stylesheet, /fray-panel > fray-content/)
        assert.match(stylesheet, /fray-panel > fray-content\.horizontal/)
        assert.match(stylesheet, /fray-panel > fray-content\.vertical/)
        assert.match(stylesheet, /fray-panel\[aria-disabled="true"\]\s*\{[^}]*opacity:\s*\.65/)
        assert.doesNotMatch(stylesheet, /fray-panel > header/)
        assert.doesNotMatch(stylesheet, /fray-sidebar|fray-dropdown|fray-checkbox|fray-textbox/)
    })

    test('collects Header CSS without unrelated component rules', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Header)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-header\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /background:\s*var\(--section-header-background\)/)
        assert.match(stylesheet, /box-shadow:\s*var\(--section-header-shadow\)/)
        assert.match(stylesheet, /fray-header > h1,[\s\S]*fray-header > h6/)
        assert.doesNotMatch(stylesheet, /fray-panel|fray-sidebar|fray-dropdown|fray-button/)
    })

    test('collects the complete Sidebar treatment without unrelated component CSS', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Sidebar)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-sidebar\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-sidebar > aside\s*\{[^}]*flex:\s*1 1 auto/)
        assert.match(stylesheet, /fray-sidebar > aside > fray-header,[\s\S]*fray-sidebar > aside > fray-toolbarcontent/)
        assert.match(stylesheet, /fray-sidebar > aside > fray-content\s*\{[^}]*flex:\s*1[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /fray-header\s*\{[^}]*padding:\s*\.25em/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)aside\s*\{/)
        assert.doesNotMatch(stylesheet, /fray-panel|fray-dropdown|fray-checkbox|fray-textbox/)
    })

    test('collects the complete SplitView treatment without unrelated component CSS', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(SplitView)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-splitview\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-splitview\.horizontal\s*\{[^}]*flex-direction:\s*row/)
        assert.match(stylesheet, /fray-splitview\.vertical\s*\{[^}]*flex-direction:\s*column/)
        assert.match(stylesheet, /fray-splitview > fray-primary\s*\{[^}]*flex:\s*0 1 var\(--split-primary-size, 40%\)/)
        assert.match(stylesheet, /fray-splitview > fray-secondary\s*\{[^}]*flex:\s*1/)
        assert.match(stylesheet, /fray-splitview > fray-primary,[\s\S]*fray-splitview > fray-secondary/)
        assert.match(stylesheet, /fray-splitview\.horizontal > fray-primary\s*\{[^}]*border-inline-end/)
        assert.match(stylesheet, /fray-splitview\.vertical > fray-primary\s*\{[^}]*border-block-end/)
        assert.doesNotMatch(stylesheet, /\[data-direction|\[data-part/)
        assert.doesNotMatch(stylesheet, /fray-panel|fray-sidebar|fray-dropdown|fray-checkbox/)
    })

    test('collects the complete TabLine treatment without unrelated component CSS', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(TabLine)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-tabline\s*\{[^}]*background:\s*var\(--tabline-background\)/)
        assert.match(stylesheet, /button\[role="tab"\]:hover:not\(:disabled\)\[aria-selected="false"\]/)
        assert.match(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="true"\]/)
        assert.match(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="false"\]::after/)
        assert.match(stylesheet, /button\[role="tab"\]:disabled\s*\{[^}]*cursor:\s*not-allowed/)
        assert.doesNotMatch(stylesheet, /fray-panel|fray-sidebar|fray-splitview|fray-dropdown/)
    })

    test('collects Toolbar CSS from its host without data hooks or unrelated rules', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Toolbar)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-toolbar\s*\{[^}]*background:\s*var\(--toolbar-background\)/)
        assert.match(stylesheet, /fray-toolbar > \*\s*\{[^}]*margin:\s*0/)
        assert.match(stylesheet, /fray-toolbar\[aria-orientation="vertical"\]/)
        assert.doesNotMatch(stylesheet, /data-orientation|toolbarlike|fray-panel|fray-sidebar|fray-dropdown/)
    })

    test('collects host-scoped Toggle CSS without data hooks or unrelated rules', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Toggle)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-toggle\s*\{[^}]*display:\s*inline-block[^}]*inline-size:\s*fit-content/)
        assert.match(stylesheet, /fray-toggle > fray-options\s*\{[^}]*display:\s*flex[^}]*box-shadow:\s*var\(--toggle-group-shadow\)/)
        assert.match(stylesheet, /button\[role="radio"\]\[aria-checked="true"\]/)
        assert.match(stylesheet, /button\[role="radio"\]\[aria-checked="false"\]\s*\+\s*\[role="radio"\]\[aria-checked="false"\]::after/)
        assert.match(stylesheet, /button\[role="radio"\]:disabled\s*\{[^}]*cursor:\s*not-allowed/)
        assert.doesNotMatch(stylesheet, /:has\(|fieldset|\.options|data-part|data-disabled|fray-panel|fray-sidebar|fray-dropdown/)
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

    test('Shiny preserves Bank2 Toolbar, primary text, and glossy ProgressBar tokens', async () => {
        const css = await readFile(
            fileURLToPath(new URL('../themes/shiny/theme.css', import.meta.url)),
            'utf8',
        )
        assert.match(css, /--toolbar-background:\s*var\(--ui-gradient\)/)
        assert.match(css, /--text-color:\s*var\(--palette-primary-900\)/)
        assert.match(css, /--ui-color:\s*var\(--text-color\)/)
        assert.match(css, /--progress-value-background:[\s\S]*radial-gradient/)
        assert.match(css, /--progress-value-shadow:[\s\S]*inset -1px 1px 3px 0 #0003/)
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
