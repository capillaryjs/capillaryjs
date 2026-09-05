import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {after, before, describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {Window} from 'happy-dom'

import {
    Button,
    Checkbox,
    Component,
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
import {baseStyleDefinitions} from '../src/styling/baseStyleDefinitions.js'

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
        assert.doesNotMatch(second.textContent, /data-fray-component/)
        assert.doesNotMatch(second.textContent, /undefined/)
    })

    test('rejects unknown semantic styles', () => {
        assert.throws(
            () => styleRegistry.registerBaseStyle('.example', 'not-a-style'),
            /Unknown Fray base style/,
        )
    })

    test('keeps checkbox controls separate from generic input and button traits', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Checkbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-checkbox\s*\{[^}]*display:\s*inline-block/)
        assert.match(stylesheet, /fray-checkbox > label\s*\{[^}]*display:\s*inline-flex/)
        assert.match(stylesheet, /input\[type="checkbox"\] \+ \.checkboxshell/)
        assert.match(stylesheet, /\.checkboxshell\s*\{[^}]*background:\s*var\(--checkbox-box-background/)
        assert.match(stylesheet,
            /input\[type="checkbox"\]:checked \+ \.checkboxshell\s*\{[^}]*background:/)
        assert.doesNotMatch(stylesheet,
            /fray-checkbox\s*\{[^}]*width:var\(--input-width, 15rem\)/)
    })

    test('contains only semantic styles used by supported components', () => {
        assert.deepEqual(Object.keys(baseStyleDefinitions).sort(), [
            'after',
            'button',
            'input',
            'inputlike',
            'inputline',
            'labeledinput',
            'noselect',
            'uiline',
            'working',
        ])
    })

    test('uses fixed one-hyphen host names and styles', () => {
        document.body.replaceChildren()
        document.head.replaceChildren()

        class Probe extends Component {
            render() {
                return this.host(null, 'configured')
            }

            static override hostName = 'probe'
            static override css = '& { display: block; }'
        }

        const runtime = createFrayRuntime()
        runtime.registerStyles(Probe).injectStyles(document)
        const probe = runtime.mount(runtime.create(Probe), document.body)
        assert.equal(probe.dom?.nodeName.toLowerCase(), 'fray-probe')
        assert.match(runtime.styleRegistry.generateCSS(), /fray-probe/)
        assert.doesNotMatch(runtime.styleRegistry.generateCSS(), /&/)

        probe.destroy()
        document.body.replaceChildren()
        document.head.replaceChildren()
    })

    test('rejects removed host-name configuration and resolves fixed stems', () => {
        assert.throws(
            () => createFrayRuntime({elementNames: {prefix: 'acme'}} as never),
            /no longer supports configurable element names/,
        )
        const runtime = createFrayRuntime()
        assert.equal(runtime.resolveElementName('panel'), 'fray-panel')
        assert.equal(runtime.resolveElementName('list-view'), 'fray-listview')
    })
})

describe('supported theme bundles', () => {
    test('does not publish obsolete light/dark compatibility bundles', async () => {
        const path = fileURLToPath(new URL('../package.json', import.meta.url))
        const packageJson = JSON.parse(await readFile(path, 'utf8')) as {
            exports?: Record<string, unknown>
            files?: string[]
        }

        assert.equal(packageJson.exports?.['./themes/light.css'], undefined)
        assert.equal(packageJson.exports?.['./themes/dark.css'], undefined)
        assert.ok(packageJson.files?.includes('themes'))
    })

    test('publishes separate hierarchical theme and color bundles', async () => {
        const themeRequired = frayThemeVariableCatalog
            .filter(({layer, fallback}) => layer === 'theme' && fallback == null)
            .map(({name}) => name)
        const paletteRequired = frayThemeVariableCatalog
            .filter(({layer, fallback}) => layer === 'palette' && fallback == null)
            .map(({name}) => name)

        const baseTheme = await readFile(
            fileURLToPath(new URL('../themes/base.css', import.meta.url)),
            'utf8',
        )
        assert.doesNotMatch(baseTheme, /@scope|:where\(/)
        let allThemes = baseTheme
        for (const option of frayThemeOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            allThemes += css
            const resolved = option.value === 'shiny' ? css : `${baseTheme}\n${css}`
            for (const property of themeRequired) assert.match(resolved, new RegExp(`${property}:`))
            assert.doesNotMatch(resolved, /^\s*--palette-[a-z0-9-]+\s*:/m)
            if (option.value !== 'shiny') {
                assert.match(css, /@import "\.\.\/base\.css"/)
                assert.doesNotMatch(resolved, /@scope|:where\(/)
            }
            for (const trait of ['buttonlike', 'inputlike', 'datacomponentlike',
                'headerlike', 'coloredlike', 'panellike', 'toolbarlike',
                'buttonshell', 'buttoninner', 'checkboxshell', 'inputshell', 'inputinner',
                'datacomponentshell', 'datacomponentinner', 'headershell',
                'headerinner', 'panelshell', 'panelinner', 'toolbarshell',
                'toolbarinner', 'coloredshell', 'coloredinner', 'selectshell']) {
                assert.match(resolved, new RegExp(`\\.${trait}\\b`))
            }
            assert.doesNotMatch(resolved, /--([a-z0-9-]+):\\s*var\\(--\\1\\)/)
        }
        for (const optionalOverride of [
            '--table-header-background',
            '--toggle-button-background',
            '--dropdown-trigger-background',
        ]) assert.match(allThemes, new RegExp(`${optionalOverride}:`))

        for (const option of frayColorOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            const isDerived = css.includes('@import "../base.css"')
            for (const property of paletteRequired) {
                if (isDerived && property.match(/--palette-(?:primary|secondary|neutral)-(?!500)\d+/)) {
                    continue
                }
                assert.match(css, new RegExp(`${property}:`))
            }
            assert.doesNotMatch(css, /^\s*--(?!palette-)[a-z0-9-]+\s*:/m)
            assert.match(css, /@import "\.\.\/base\.css"/)
            assert.match(css, /:root\s*\{/)
            assert.doesNotMatch(css, /:where|\[data-color/)
        }
    })

    test('catalog fallbacks reference declared variables', () => {
        const names = new Set(frayThemeVariableCatalog.map(({name}) => name))
        assert.equal(names.size, frayThemeVariableCatalog.length)
        for (const definition of frayThemeVariableCatalog) {
            if (definition.fallback != null) assert.ok(names.has(definition.fallback))
        }
        assert.ok(frayThemeVariableCatalog.some(({name}) =>
            name === '--table-header-background'))
        assert.ok(frayThemeVariableCatalog.some(({name}) =>
            name === '--toggle-button-background'))
    })

    test('replaces theme and color links independently', () => {
        document.head.replaceChildren()
        const theme = frayThemeOptions[0]
        const colors = frayColorOptions[0]
        assert.ok(theme)
        assert.ok(colors)

        const themeLink = replaceFrayStylesheet('theme', theme, document)
        const colorLink = replaceFrayStylesheet('colors', colors, document)
        assert.notEqual(themeLink, colorLink)
        assert.equal(document.head.querySelectorAll('link[rel="stylesheet"]').length, 2)
        assert.equal(document.documentElement.dataset.theme, theme.value)
        assert.equal(document.documentElement.dataset.color, colors.value)

        const replacement = frayThemeOptions[1]
        assert.ok(replacement)
        assert.equal(replaceFrayStylesheet('theme', replacement, document), themeLink)
        assert.equal(themeLink.dataset.fraySelection, replacement.value)
        assert.equal(colorLink.dataset.fraySelection, colors.value)
    })

    test('uses one root appearance setting for adaptive themes', () => {
        document.documentElement.removeAttribute('data-appearance')
        assert.equal(getFrayAppearance(document), 'system')

        setFrayAppearance('dark', document)
        assert.equal(document.documentElement.dataset.appearance, 'dark')
        assert.equal(getFrayAppearance(document), 'dark')

        setFrayAppearance('light', document)
        assert.equal(document.documentElement.dataset.appearance, 'light')
        setFrayAppearance('system', document)
        assert.equal(document.documentElement.hasAttribute('data-appearance'), false)
        assert.equal(getFrayAppearance(document), 'system')
        assert.throws(() => setFrayAppearance('dim' as never, document), /light, dark, or system/)
    })

    test('ships one generated structural artifact without palette declarations', async () => {
        const path = fileURLToPath(new URL('../styles/structural.css', import.meta.url))
        const css = await readFile(path, 'utf8')
        assert.match(css, /Generated by scripts\/build-structural-css\.mjs/)
        assert.match(css, /fray-themepicker/)
        assert.match(css, /fray-colorpicker/)
        assert.doesNotMatch(css, /^\s*--palette-[a-z0-9-]+\s*:/m)
        assert.doesNotMatch(css, /data-fray-component/)
        assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i)
    })

    test('exports the structural, hierarchical theme, and color subpaths', async () => {
        const path = fileURLToPath(new URL('../package.json', import.meta.url))
        const packageJson = JSON.parse(await readFile(path, 'utf8')) as {
            exports?: Record<string, unknown>
            files?: string[]
        }
        assert.equal(
            packageJson.exports?.['./styles/structural.css'],
            './styles/structural.css',
        )
        assert.equal(
            packageJson.exports?.['./themes/*/theme.css'],
            './themes/*/theme.css',
        )
        assert.equal(
            packageJson.exports?.['./colors/*/colors.css'],
            './colors/*/colors.css',
        )
        assert.ok(packageJson.files?.includes('styles'))
        assert.ok(packageJson.files?.includes('colors'))
    })
})
