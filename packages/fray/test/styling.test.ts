import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {after, before, describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {Window} from 'happy-dom'

import {
    Button,
    Component,
    Textbox,
    createFrayRuntime,
    frayColorOptions,
    frayThemeOptions,
    frayThemeVariableCatalog,
    replaceFrayStylesheet,
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
        assert.match(second.textContent, /button\[data-fray-component="button"\]/)
        assert.match(second.textContent, /fray-textbox > input:focus-visible/)
        assert.match(second.textContent, /fray-textbox > input:disabled/)
        assert.doesNotMatch(second.textContent, /undefined/)
    })

    test('rejects unknown semantic styles', () => {
        assert.throws(
            () => styleRegistry.registerBaseStyle('.example', 'not-a-style'),
            /Unknown Fray base style/,
        )
    })

    test('contains only semantic styles used by supported components', () => {
        assert.deepEqual(Object.keys(baseStyleDefinitions).sort(), [
            'after',
            'button',
            'disabled',
            'error',
            'input',
            'inputlike',
            'inputline',
            'label',
            'labeledinput',
            'noselect',
            'panel',
            'sectionheader',
            'toolbar',
            'uiline',
            'working',
        ])
    })

    test('scopes configured host names and styles to an immutable runtime', () => {
        document.body.replaceChildren()
        document.head.replaceChildren()

        class Probe extends Component {
            render() {
                return this.host(null, 'configured')
            }

            static override hostName = 'probe'
            static override standaloneHostName = 'runtime-probe'
            static override baseStyles = [
                ['&', 'panel'],
            ]
            static override css = '& { display: block; }'
        }

        const acmeRuntime = createFrayRuntime({elementNames: {prefix: 'acme'}})
        acmeRuntime.registerStyles(Probe).injectStyles(document)
        const acmeProbe = acmeRuntime.mount(acmeRuntime.create(Probe), document.body)
        assert.equal(acmeProbe.dom?.nodeName.toLowerCase(), 'acme-probe')
        assert.match(acmeRuntime.styleRegistry.generateCSS(), /acme-probe/)
        assert.doesNotMatch(acmeRuntime.styleRegistry.generateCSS(), /&/)

        const compactRuntime = createFrayRuntime({elementNames: {prefix: null}})
        compactRuntime.registerStyles(Probe).injectStyles(document)
        const compactProbe = compactRuntime.mount(compactRuntime.create(Probe), document.body)
        assert.equal(compactProbe.dom?.nodeName.toLowerCase(), 'runtime-probe')
        assert.equal(
            document.head.querySelectorAll('style[data-fray-structural-styles]').length,
            2,
        )

        acmeProbe.destroy()
        compactProbe.destroy()
        document.body.replaceChildren()
        document.head.replaceChildren()
    })

    test('validates prefixes, prefixless names, and exact overrides', () => {
        assert.throws(
            () => createFrayRuntime({elementNames: {prefix: ''}}),
            /lowercase kebab-case/,
        )
        assert.throws(
            () => createFrayRuntime({elementNames: {prefix: null}})
                .resolveElementName('panel'),
            /containing a hyphen/,
        )

        const runtime = createFrayRuntime({
            elementNames: {
                prefix: null,
                overrides: {panel: 'custom-panel'},
            },
        })
        assert.equal(runtime.resolveElementName('panel'), 'custom-panel')
        assert.throws(
            () => createFrayRuntime({
                elementNames: {overrides: {panel: 'annotation-xml'}},
            }),
            /non-reserved/,
        )
    })
})

describe('supported theme bundles', () => {
    test('define the documented stable contract without dotted declarations', async () => {
        const required = [
            '--ui-text-color',
            '--ui-input-bg',
            '--ui-input-border',
            '--ui-input-bg-disabled',
            '--ui-input-border-disabled',
            '--ui-input-text-color-disabled',
            '--ui-accent-color',
            '--ui-accent-color-highlight',
            '--button-background',
            '--button-background-hover',
            '--button-background-disabled',
            '--button-border',
            '--button-border-disabled',
            '--button-color',
            '--toggle-selected-bg',
            '--toggle-selected-text',
            '--panel-bg',
            '--panel-border',
            '--panel-radius',
            '--panel-shadow',
            '--panel-color',
            '--toolbar-bg',
            '--sectionheader-bg',
            '--tabline-bg',
            '--tab-bg-active',
            '--error-color',
        ]

        for (const name of ['light.css', 'dark.css']) {
            const path = fileURLToPath(new URL(`../themes/${name}`, import.meta.url))
            const css = await readFile(path, 'utf8')
            const declarations = [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gmi)]
                .map((match) => match[1])
            for (const property of required) {
                assert.match(css, new RegExp(`${property.replaceAll('-', '\\-')}\\s*:`),
                    `${name} must define ${property}`)
            }
            assert.match(css, /^:where\(:root\), \[data-fray-theme="(?:light|dark)"\]/)
            assert.equal(new Set(declarations).size, declarations.length,
                `${name} must not repeat custom-property declarations`)
            assert.doesNotMatch(css, /^\s*\.[a-z-]+\s*:/m)
        }
    })

    test('exports both supported bundles through package subpaths', async () => {
        const path = fileURLToPath(new URL('../package.json', import.meta.url))
        const packageJson = JSON.parse(await readFile(path, 'utf8')) as {
            exports?: Record<string, unknown>
            files?: string[]
        }

        assert.equal(packageJson.exports?.['./themes/light.css'], './themes/light.css')
        assert.equal(packageJson.exports?.['./themes/dark.css'], './themes/dark.css')
        assert.ok(packageJson.files?.includes('themes'))
    })

    test('publishes separate hierarchical theme and color bundles', async () => {
        const themeRequired = frayThemeVariableCatalog
            .filter(({layer, fallback}) => layer === 'theme' && fallback == null)
            .map(({name}) => name)
        const colorRequired = frayThemeVariableCatalog
            .filter(({layer}) => layer === 'color')
            .map(({name}) => name)

        let allThemes = ''
        for (const option of frayThemeOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            allThemes += css
            for (const property of themeRequired) assert.match(css, new RegExp(`${property}:`))
            assert.doesNotMatch(css, /^\s*--fray-color-[a-z0-9-]+\s*:/m)
            assert.match(css, new RegExp(`\\[data-fray-theme="${option.value}"\\]`))
            assert.doesNotMatch(css, /^\s*\.[a-z-]+\s*:/m)
        }
        for (const optionalOverride of [
            '--fray-table-header-background',
            '--fray-toggle-button-background',
            '--fray-dropdown-trigger-background',
        ]) assert.match(allThemes, new RegExp(`${optionalOverride}:`))

        for (const option of frayColorOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            for (const property of colorRequired) assert.match(css, new RegExp(`${property}:`))
            assert.doesNotMatch(css, /^\s*--fray-(?!color-)[a-z0-9-]+\s*:/m)
            assert.match(css, new RegExp(`\\[data-fray-color="${option.value}"\\]`))
        }
    })

    test('catalog fallbacks reference declared variables', () => {
        const names = new Set(frayThemeVariableCatalog.map(({name}) => name))
        assert.equal(names.size, frayThemeVariableCatalog.length)
        for (const definition of frayThemeVariableCatalog) {
            if (definition.fallback != null) assert.ok(names.has(definition.fallback))
        }
        assert.ok(frayThemeVariableCatalog.some(({name}) =>
            name === '--fray-table-header-background'))
        assert.ok(frayThemeVariableCatalog.some(({name}) =>
            name === '--fray-toggle-button-background'))
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
        assert.equal(document.documentElement.dataset.frayTheme, theme.value)
        assert.equal(document.documentElement.dataset.frayColor, colors.value)

        const replacement = frayThemeOptions[1]
        assert.ok(replacement)
        assert.equal(replaceFrayStylesheet('theme', replacement, document), themeLink)
        assert.equal(themeLink.dataset.fraySelection, replacement.value)
        assert.equal(colorLink.dataset.fraySelection, colors.value)
    })

    test('ships one generated structural artifact without palette declarations', async () => {
        const path = fileURLToPath(new URL('../styles/structural.css', import.meta.url))
        const css = await readFile(path, 'utf8')
        assert.match(css, /Generated by scripts\/build-structural-css\.mjs/)
        assert.match(css, /fray-theme-picker/)
        assert.match(css, /fray-color-picker/)
        assert.doesNotMatch(css, /^\s*--fray-color-[a-z0-9-]+\s*:/m)
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
