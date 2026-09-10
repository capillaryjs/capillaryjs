import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {after, before, describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {Window} from 'happy-dom'

import {
    Button,
    Checkbox,
    ColorPicker,
    Component,
    DataTable,
    DatePicker,
    DateTimePicker,
    DescriptionItem,
    DescriptionList,
    Dialog,
    Dropdown,
    InfoField,
    InfoPanel,
    FilterPanel,
    GroupPanel,
    Header,
    OptionGroup,
    OptionsPanel,
    ListView,
    NavigationBar,
    Panel,
    Placeholder,
    ProgressBar,
    RadioButton,
    RadioGroup,
    RouteOutlet,
    Sidebar,
    SplitView,
    TabLine,
    TabPanel,
    Textbox,
    ThemePicker,
    TimePicker,
    Toggle,
    Toolbar,
    TreeView,
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
        assert.match(second.textContent, /\.fray-fill-horizontal,\s*\.fray-fill-vertical\s*\{[^}]*font-family:\s*var\(--font-family\)[^}]*font-size:\s*var\(--font-size\)[^}]*line-height:\s*var\(--line-height\)/)
        assert.match(second.textContent, /\.fray-fill-horizontal\s*\{[^}]*width:\s*100vw[^}]*overflow-x:\s*auto/)
        assert.match(second.textContent, /\.fray-fill-vertical\s*\{[^}]*height:\s*100vh[^}]*overflow-y:\s*auto/)
        assert.doesNotMatch(second.textContent, /\.fray-fill-(?:horizontal|vertical) \[data-fray\]/)
        assert.match(second.textContent, /\.colored\s*\{[^}]*--colored-base-bg:[\s\S]*linear-gradient\([^}]*background:\s*var\(--colored-base-bg\)[^}]*box-shadow:\s*var\(--colored-shadow\)/)
        assert.match(second.textContent, /\.island\s*\{[^}]*margin:\s*var\(--island-margin\)/)
        assert.match(second.textContent, /\.fray-fill-horizontal \.island\s*\{[^}]*max-width:[^}]*overflow-x:\s*auto/)
        assert.match(second.textContent, /\.fray-fill-vertical \.island\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/)
        assert.equal((second.textContent.match(/^\s*\.island\s*\{/gm) ?? []).length, 1)
        assert.doesNotMatch(second.textContent, /\.fray-app/)
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

    test('coalesces one inherited host-relative template across concrete hosts', () => {
        abstract class SharedCheckableProbe extends Component {
            static override css = `
                & > label { --shared-checkable-rule: normal; }

                @media (forced-colors: active) {
                    & > label { --shared-checkable-rule: forced; }
                }

                @keyframes shared-checkable-probe {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `
        }
        class CheckboxProbe extends SharedCheckableProbe {
            static override hostName = 'checkbox-probe'
        }
        class RadioProbe extends SharedCheckableProbe {
            static override hostName = 'radio-probe'
        }

        const runtime = createFrayRuntime()
        runtime.registerStyles(CheckboxProbe)
        runtime.registerStyles(RadioProbe)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-checkboxprobe > label,\s*fray-radioprobe > label\s*\{[^}]*--shared-checkable-rule:\s*normal/)
        assert.match(stylesheet, /@media \(forced-colors: active\)\s*\{[\s\S]*fray-checkboxprobe > label,\s*fray-radioprobe > label\s*\{[^}]*--shared-checkable-rule:\s*forced/)
        assert.equal((stylesheet.match(/@keyframes shared-checkable-probe/g) ?? []).length, 1)
    })

    test('coalesces the shared checkable-control rules for Checkbox and RadioButton', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Checkbox)
        runtime.registerStyles(RadioButton)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-checkbox > label,\s*fray-radiobutton > label\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-checkbox > label > input \+ fray-checkshell,\s*fray-radiobutton > label > input \+ fray-checkshell\s*\{[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
    })

    test('collects Button CSS only through its fixed host', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Button)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-button > button\s*\{[^}]*background:\s*var\(--button-background\)/)
        assert.match(stylesheet, /fray-button > button:focus-visible/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)button\s*\{|data-fray-component|fray-panel|fray-sidebar/)
    })

    test('collects Dialog through its fixed host, native dialog, and fixed content part', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Dialog)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-dialog > dialog\s*\{[^}]*z-index:\s*2[^}]*background:\s*var\(--panel-background\)[^}]*box-shadow:\s*var\(--dialog-shadow\)[^}]*isolation:\s*isolate/)
        assert.doesNotMatch(stylesheet, /fray-dialog > dialog\s*\{[^}]*position:/)
        assert.match(stylesheet, /fray-dialog > dialog\[open\]\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/)
        assert.match(stylesheet, /fray-dialog > dialog::backdrop\s*\{[^}]*background:\s*var\(--dialog-backdrop-background\)/)
        assert.match(stylesheet, /fray-dialog > dialog > fray-content\s*\{[^}]*position:\s*relative[^}]*z-index:\s*0[^}]*display:\s*block[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /fray-dialog > dialog > header\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1[^}]*background:\s*var\(--dialog-header-background\)[^}]*box-shadow:\s*var\(--section-header-shadow\)/)
        assert.match(stylesheet, /fray-button > button/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)dialog\s*\{|data-part|fray-panel|fray-dropdown/)
    })

    test('collects TabPanel through native panel sections without styling data hooks', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(TabPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-tabpanel\s*\{[^}]*background:\s*var\(--panel-background\)[^}]*border-radius:\s*var\(--panel-radius\)[^}]*box-shadow:\s*var\(--panel-shadow\)/)
        assert.match(stylesheet, /fray-tabpanel > section\[role="tabpanel"\]\s*\{[^}]*overflow:\s*auto[^}]*padding:\s*3px/)
        assert.match(stylesheet, /fray-tabpanel > section\[role="tabpanel"\]\[hidden\]\s*\{[^}]*display:\s*none/)
        assert.match(stylesheet, /fray-tabpanel > section\[role="tabpanel"\] > fray-toolbar\[role="toolbar"\]:first-child\s*\{[^}]*width:\s*calc\(100% \+ 6px\)[^}]*margin-block-start:\s*-3px/)
        assert.match(stylesheet, /fray-tabline > button\[role="tab"\]/)
        assert.doesNotMatch(stylesheet, /fray-tabpanel[^}]*data-part|fray-tabpanel > div/)
    })

    test('collects NavigationBar and RouteOutlet through their native structure', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(NavigationBar)
        runtime.registerStyles(RouteOutlet)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-navigationbar\s*\{[^}]*color:\s*var\(--navigation-bar-color\)[^}]*background:\s*var\(--navigation-bar-background\)[^}]*border:\s*var\(--navigation-bar-border\)/)
        assert.match(stylesheet, /fray-navigationbar > nav > ul\s*\{[^}]*display:\s*flex[^}]*list-style:\s*none/)
        assert.match(stylesheet, /fray-navigationbar > nav > ul > li > a,\s*fray-navigationbar > nav > ul > li > span\[aria-disabled="true"\]\s*\{[^}]*color:\s*var\(--navigation-link-color\)[^}]*background:\s*var\(--navigation-link-background\)[^}]*border:\s*var\(--navigation-link-border\)/)
        assert.match(stylesheet, /fray-navigationbar > nav > ul > li > a\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--navigation-link-color-current\)[^}]*background:\s*var\(--navigation-link-background-current\)[^}]*box-shadow:\s*var\(--navigation-link-shadow-current\)[^}]*font-weight:\s*var\(--navigation-link-font-weight-current\)/)
        assert.match(stylesheet, /fray-routeoutlet\s*\{[^}]*display:\s*flex[^}]*overflow:\s*hidden/)
        assert.match(stylesheet, /fray-routeoutlet > div\[hidden\]\s*\{[^}]*display:\s*none/)
        assert.doesNotMatch(stylesheet, /fray-tabline|role="tab"|data-part/)
    })

    test('DescriptionItem emits direct native terms and values without structural CSS', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(DescriptionItem)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.doesNotMatch(stylesheet, /div:has\(> dt \+ dd\)|description-item|fray-descriptionitem/)
    })

    test('collects DescriptionList through its fixed host and native list surface', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(DescriptionList)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-descriptionlist\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /fray-descriptionlist > dl\s*\{[^}]*display:\s*grid[^}]*margin:\s*0/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)dl:has\(|data-fray-component|fray-panel|fray-sidebar/)
    })

    test('InfoField emits direct native terms and values without structural CSS', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(InfoField)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.doesNotMatch(stylesheet, /info-field|fray-infofield/)
    })

    test('collects InfoPanel through its fixed host with panel chrome and grid layout', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(InfoPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-infopanel\s*\{[\s\S]*border:[\s\S]*display:\s*flex/)
        assert.match(stylesheet, /fray-infopanel > dl\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*auto 1fr/)
        assert.match(stylesheet, /fray-infopanel > dl > dt\s*\{[\s\S]*font-weight:\s*600/)
        assert.match(stylesheet, /fray-infopanel > dl > dd\s*\{[\s\S]*margin:\s*0/)
    })

    test('collects Placeholder through its fixed host and working texture only', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Placeholder)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-placeholder\s*\{[^}]*width:\s*5em[^}]*height:\s*1em[^}]*background:\s*#ccc/)
        assert.match(stylesheet, /fray-placeholder::after\s*\{[^}]*animation:\s*fray-placeholder-progress 0\.55s linear infinite[^}]*background-image:\s*var\(--working-background-image\)/)
        assert.match(stylesheet, /@keyframes fray-placeholder-progress\s*\{[\s\S]*background-position:\s*2rem 0/)
        assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*fray-placeholder::after\s*\{[^}]*animation:\s*none/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)placeholder\s*\{|data-part|data-state|fray-panel|fray-sidebar/)
    })

    test('collects ListView through its fixed host and native list items', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(ListView)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-listview\s*\{[^}]*background:\s*var\(--ui-input-bg\)[^}]*pointer-events:\s*all[^}]*white-space:\s*nowrap/)
        assert.match(stylesheet, /fray-listview > \[role="listbox"\],\s*fray-listview > ul\[aria-hidden="true"\]\s*\{[^}]*list-style:\s*none/)
        assert.match(stylesheet, /fray-listview > \[role="listbox"\] > \[role="option"\]\s*\{[^}]*line-height:\s*calc\(var\(--ui-font-size\)/)
        assert.match(stylesheet, /fray-listview > \[role="listbox"\] > \[role="option"\]:hover\s*\{[^}]*background:\s*var\(--hover-bg-color, #f5f5f5\)/)
        assert.match(stylesheet, /fray-listview > \[role="listbox"\] > \[role="option"\]\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--selected-bg-color, #e0e7ff\)/)
        assert.match(stylesheet, /fray-placeholder::after/)
        assert.doesNotMatch(stylesheet, /fray-list-view|data-part|(?:^|\n)div\s*\{|fray-panel|fray-sidebar/)
    })

    test('collects TreeView through its native tree and fixed internal parts', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(TreeView)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-treeview > \[role="tree"\]\s*\{[^}]*list-style:\s*none/)
        assert.match(stylesheet, /fray-treeview \[role="treeitem"\]:hover\s*\{[^}]*background:\s*var\(--button-background-hover\)/)
        assert.match(stylesheet, /fray-treeview \[role="treeitem"\]:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
        assert.match(stylesheet, /fray-treeview \[role="treeitem"\]\[aria-selected="true"\]\s*\{[^}]*color:\s*var\(--ui-select-text-color\)[^}]*background:\s*var\(--ui-select-bg\)/)
        assert.match(stylesheet, /fray-treeview fray-expander\s*\{/)
        assert.match(stylesheet, /fray-treeview fray-label\s*\{/)
        assert.doesNotMatch(stylesheet, /data-(?:part|depth|expandable)|(?:^|\n)div\s*\{|fray-listview|fray-panel/)
    })

    test('collects FilterPanel through its fixed Bank2 floating surface and Checkbox dependency', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(FilterPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-filterpanel\s*\{[^}]*position:\s*absolute[^}]*background:\s*white[^}]*border:\s*1px solid #ccc[^}]*padding:\s*8px[^}]*min-width:\s*180px[^}]*box-shadow:\s*0 2px 6px rgba\(0, 0, 0, 0\.15\)[^}]*left:\s*100%[^}]*top:\s*0/)
        assert.match(stylesheet, /fray-filterpanel > p\s*\{[^}]*margin:\s*0/)
        assert.match(stylesheet, /fray-checkbox > label > input \+ fray-checkshell/)
        assert.doesNotMatch(stylesheet, /panellike|data-state|data-part|fray-table|fray-listview/)
    })

    test('collects the native DataTable family through the fixed table boundary', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(DataTable)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-datatable\s*\{[^}]*display:\s*block[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /fray-datatable > table > thead\s*\{[^}]*color:\s*var\(--table-header-color\)[^}]*background:\s*var\(--ui-gradient\)/)
        assert.match(stylesheet, /fray-datatable > table > thead > tr > th\[aria-sort\]\s*\{[^}]*position:\s*relative/)
        assert.match(stylesheet, /button\.sort > span\.sortindicator\s*\{[^}]*right:\s*20px[^}]*text-align:\s*center/)
        assert.match(stylesheet, /button\.filter\s*\{[^}]*right:\s*2px[^}]*opacity:\s*0\.5/)
        assert.match(stylesheet, /fray-datatable > table > tbody > tr\[aria-selected="true"\] > td\s*\{[^}]*background:\s*var\(--ui-select-bg\)/)
        assert.match(stylesheet, /fray-datatable > table > tbody > tr:nth-child\(even\)\[aria-selected="true"\] > td\s*\{[^}]*background:\s*var\(--ui-select-bg-dark\)/)
        assert.match(stylesheet, /fray-filterpanel\s*\{/)
        assert.match(stylesheet, /fray-placeholder\s*\{/)
        assert.doesNotMatch(stylesheet, /datacomponentlike|data-(?:loading|error|part)|fray-listview|fray-treeview|(?:^|\n)th\[aria-sort\]/)
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

    test('collects both stylesheet pickers through the shared select hierarchy', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(ThemePicker)
        runtime.registerStyles(ColorPicker)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-themepicker,\s*fray-colorpicker\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-themepicker > fray-selectshell > select,\s*fray-colorpicker > fray-selectshell > select\s*\{[^}]*min-width:\s*8rem/)
        assert.match(stylesheet, /fray-themepicker > fray-selectshell::before,\s*fray-colorpicker > fray-selectshell::before/)
        assert.doesNotMatch(stylesheet, /data-(?:kind|disabled|required|error)|fray-dropdown|fray-treeview/)
    })

    test('keeps checkbox controls separate from generic input and button treatment', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(Checkbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-checkbox\s*\{[^}]*display:\s*inline-flex[^}]*line-height:\s*1/)
        assert.match(stylesheet, /fray-checkbox > label\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /input \+ fray-checkshell/)
        assert.match(stylesheet, /label:has\(> input:disabled\)\s*\{[^}]*color:\s*var\(--checkable-label-color-disabled\)[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /fray-checkshell\s*\{[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
        assert.match(stylesheet, /input:checked \+ fray-checkshell\s*\{[^}]*box-shadow:\s*var\(--checkbox-box-shadow-checked\)/)
        assert.doesNotMatch(stylesheet, /\.checkboxshell|\[data-(?:disabled|required|error|state)\]|fray-checkboxshell|fray-checkbox\s*\{[^}]*width:\s*var\(--input-width/)
    })

    test('collects RadioButton through its fixed shell and native state selectors', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(RadioButton)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-radiobutton\s*\{[^}]*display:\s*inline-flex/)
        assert.match(stylesheet, /fray-radiobutton > label:has\(> input:disabled\)\s*\{[^}]*color:\s*var\(--checkable-label-color-disabled\)[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /input \+ fray-checkshell\s*\{[^}]*background:\s*var\(--checkbox-box-background,[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
        assert.match(stylesheet, /input:checked \+ fray-checkshell\s*\{[^}]*background:\s*var\(--checkbox-box-background-checked,[^}]*box-shadow:\s*var\(--checkbox-box-shadow-checked\)/)
        assert.match(stylesheet, /input\[type="radio"\] \+ fray-checkshell\s*\{[^}]*border-radius:\s*50%/)
        assert.match(stylesheet, /input\[type="radio"\]:checked \+ fray-checkshell::after\s*\{[^}]*border-radius:\s*50%[^}]*background:\s*var\(--checkbox-symbol-color\)/)
        assert.match(stylesheet, /input:disabled \+ fray-checkshell\s*\{[^}]*opacity:\s*0\.6[^}]*filter:\s*saturate\(0\.6\)/)
        assert.match(stylesheet, /input:focus-visible \+ fray-checkshell\s*\{[^}]*outline:\s*2px solid var\(--focus-color,/)
        assert.doesNotMatch(stylesheet, /\.radioshell|data-disabled|data-required|data-error|fray-radioshell|fray-radiogroup/)
    })

    test('collects RadioGroup through its native fieldset and RadioButton dependency', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(RadioGroup)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-radiogroup > fieldset\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*column wrap[^}]*gap:\s*0[^}]*min-inline-size:\s*0/)
        assert.match(stylesheet, /fray-radiogroup > fieldset > legend\s*\{[^}]*flex:\s*0 0 100%[^}]*padding:\s*0/)
        assert.match(stylesheet, /fray-radiobutton > label > input\[type="radio"\] \+ fray-checkshell\s*\{[^}]*border-radius:\s*50%/)
        assert.doesNotMatch(stylesheet, /data-part|data-disabled|data-required|data-error|fray-options|fray-toggle/)
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

    test('collects OptionGroup fieldset shell and labeled legend treatment', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(OptionGroup)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-optiongroup\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /fray-optiongroup > fieldset\s*\{[^}]*margin:\s*0[^}]*padding:\s*0[^}]*border:\s*0/)
        assert.match(stylesheet, /fray-optiongroup > fieldset > legend\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*border-bottom:\s*1px solid var\(--ui-border-color\)/)
        assert.match(stylesheet, /fray-optiongroup > fieldset > legend > span\s*\{[^}]*flex:\s*1/)
        assert.doesNotMatch(stylesheet, /fray-grouppanel|fray-panel|fray-header|fray-checkbox/)
    })

    test('collects OptionsPanel with inherited GroupPanel flex layout and flex content override', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(OptionsPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-optionspanel\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*row nowrap[^}]*border:\s*1px solid var\(--ui-border-color\)/)
        assert.match(stylesheet, /fray-optionspanel > fray-header\s*\{[^}]*place-items:\s*center[^}]*writing-mode:\s*vertical-rl[^}]*transform:\s*rotate\(180deg\)/)
        assert.match(stylesheet, /fray-optionspanel > fray-content\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*\.5em/)
        assert.match(stylesheet, /fray-header\s*\{[^}]*background:\s*var\(--section-header-background\)/)
        assert.doesNotMatch(stylesheet, /fray-panel|fray-sidebar|fray-checkbox/)
    })

    test('collects GroupPanel border and vertical Header treatment', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(GroupPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-grouppanel\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*row nowrap[^}]*column-gap:\s*0\.35rem[^}]*padding-inline:\s*0\.125rem 0\.35rem[^}]*border:\s*1px solid var\(--ui-border-color\)/)
        assert.match(stylesheet, /fray-grouppanel > fray-header\s*\{[^}]*place-items:\s*center[^}]*box-sizing:\s*border-box[^}]*width:\s*1\.7em[^}]*min-width:\s*0[^}]*border-radius:\s*var\(--ui-border-radius\)/)
        assert.match(stylesheet, /fray-grouppanel > fray-header\s*\{[^}]*writing-mode:\s*vertical-rl[^}]*transform:\s*rotate\(180deg\)/)
        assert.match(stylesheet, /fray-header\s*\{[^}]*background:\s*var\(--section-header-background\)[^}]*box-shadow:\s*var\(--section-header-shadow\)/)
        assert.doesNotMatch(stylesheet, /fray-panel|fray-sidebar|fray-checkbox/)
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
        assert.match(stylesheet, /fray-tabline\s*\{[^}]*overflow:\s*hidden/)
        assert.match(stylesheet, /button\[role="tab"\]:hover:not\(:disabled\)\[aria-selected="false"\]/)
        assert.match(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="true"\]\s*\{[^}]*min-height:\s*var\(--control-min-height, 2rem\)[^}]*margin-block-start:\s*0/)
        assert.match(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="false"\]::after/)
        assert.match(stylesheet, /button\[role="tab"\]:disabled\s*\{[^}]*cursor:\s*not-allowed/)
        assert.doesNotMatch(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="true"\]::after|tab-button-active-(?:lift|bridge)/)
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

    test('collects DatePicker, TimePicker, and DateTimePicker structural CSS', () => {
        const runtime = createFrayRuntime()
        runtime.registerStyles(DatePicker)
        runtime.registerStyles(TimePicker)
        runtime.registerStyles(DateTimePicker)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /fray-datepicker\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-datepicker > input\s*\{[^}]*cursor:\s*text/)
        assert.match(stylesheet, /fray-datepicker > dialog\s*\{[^}]*position:/)

        assert.match(stylesheet, /fray-timepicker\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /fray-timepicker > fray-selectshell\s*\{/)
        assert.match(stylesheet, /fray-timepicker > fray-selectshell > select\s*\{[^}]*min-height:\s*var\(--control-min-height, 2rem\)/)

        assert.match(stylesheet, /fray-datetimepicker\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /fray-datetimepicker > fieldset\s*\{[^}]*display:\s*flex/)
        assert.doesNotMatch(stylesheet, /data-(?:disabled|required|error)|fray-textbox|fray-dropdown/)
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

    test('theme files layer tokens, keep ordinary rules unlayered, and never import base.css', async () => {
        const base = await readFile(
            fileURLToPath(new URL('../themes/base.css', import.meta.url)),
            'utf8',
        )
        const baseDeclarations = oneLineCustomProperties(base)
        for (const option of frayThemeOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            assert.doesNotMatch(css, /@import/)
            assert.doesNotMatch(css, /@scope|:where\(|@media/)

            const {layered, unlayered} = splitThemeLayer(css)
            assert.match(layered, /:root\s*\{/,
                `${option.value} declares no @layer theme token block`)
            assertVariableOnly(layered, true)
            // Component CSS is unlayered, so a layered theme rule could never win.
            assert.doesNotMatch(unlayered, /@layer/,
                `${option.value} must keep ordinary rules outside @layer theme`)

            assert.doesNotMatch(css, /^\s*--palette-[a-z0-9-]+\s*:/m)
            for (const [name, value] of oneLineCustomProperties(css)) {
                assert.notEqual(value, baseDeclarations.get(name),
                    `${option.value} repeats the base value for ${name}`)
            }
        }
    })

    test('Shiny preserves its chrome, light navigation strip, and glossy graphical tokens', async () => {
        const css = await readFile(
            fileURLToPath(new URL('../themes/shiny/theme.css', import.meta.url)),
            'utf8',
        )
        assert.match(css, /--toolbar-background:\s*var\(--ui-gradient\)/)
        assert.match(css, /--text-color:\s*var\(--palette-primary-900\)/)
        assert.match(css, /--ui-color:\s*var\(--text-color\)/)
        assert.match(css, /--island-margin:\s*var\(--space-sm\)/)
        assert.match(css, /--island-border:\s*1px solid rgb\(255 255 255 \/ 0\.45\)/)
        assert.match(css, /--island-shadow:\s*0px 1px 2\.5px 0px #666/)
        assert.match(css, /--shiny-background:[\s\S]*radial-gradient\(140% 75% at 30% 10%, #fff2, #fff3 47%, #fff0 55%, #fff0\)[\s\S]*linear-gradient\(to bottom, var\(--palette-primary-900\) 0%, var\(--palette-primary\) 65%, var\(--palette-primary\) 66%, var\(--palette-primary-400\) 100%\)/)
        assert.match(css, /--section-header-background:\s*var\(--shiny-background\)/)
        assert.match(css, /--navigation-bar-background:\s*var\(--ui-gradient-2\)/)
        assert.match(css, /--navigation-bar-color:\s*var\(--text-color\)/)
        assert.match(css, /--navigation-link-color-current:\s*white/)
        assert.match(css, /--navigation-link-background-current:\s*var\(--section-header-background\)/)
        const {unlayered} = splitThemeLayer(css)
        assert.match(unlayered, /\.colored\s*\{[^}]*background:\s*radial-gradient/)
        assert.match(unlayered, /^nav > ul > li\s*\{[^}]*border-radius:/m)
        assert.match(unlayered, /^fray-navigationbar nav > ul > li > a\s*\{[^}]*line-height:\s*1\.7em/m)
        assert.doesNotMatch(css, /--panel-shadow:/)
        assert.match(css, /--progress-value-background:[\s\S]*radial-gradient/)
        assert.match(css, /--progress-value-shadow:[\s\S]*inset -1px 1px 3px 0 #0003/)
        assert.match(css, /--block-graph-block-border:\s*none/)
        assert.match(css, /--colored-shadow:[\s\S]*inset -2px 2px 2px 0px #0006,[\s\S]*inset 2px -2px 2px 0px #fff5,[\s\S]*-3px 3px 4px 0px #0006/)
        assert.doesNotMatch(css, /--block-graph-block-shadow:/)
    })

    test('base BlockGraph tokens retain flat semantic category colors', async () => {
        const css = await readFile(
            fileURLToPath(new URL('../themes/base.css', import.meta.url)),
            'utf8',
        )
        assert.match(css, /--colored-shadow:\s*none/)
        assert.match(css, /--block-graph-block-shadow:\s*var\(--colored-shadow\)/)
    })

    test('base and Minimal keep island layout neutral', async () => {
        const [base, minimal] = await Promise.all([
            readFile(fileURLToPath(new URL('../themes/base.css', import.meta.url)), 'utf8'),
            readFile(fileURLToPath(new URL('../themes/minimal/theme.css', import.meta.url)), 'utf8'),
        ])
        assert.match(base, /--application-background:\s*var\(--palette-light\)/)
        assert.match(base, /--island-margin:\s*0/)
        assert.match(base, /--island-padding:\s*0/)
        assert.match(base, /--island-background:\s*var\(--panel-background\)/)
        assert.match(base, /--island-border:\s*var\(--panel-border\)/)
        assert.match(base, /--island-radius:\s*var\(--panel-radius\)/)
        assert.match(base, /--island-shadow:\s*var\(--panel-shadow\)/)
        assert.match(base, /--navigation-bar-background:\s*transparent/)
        assert.match(base, /--navigation-link-background:\s*transparent/)
        assert.match(base, /--navigation-link-border-current:\s*2px solid var\(--palette-primary\)/)
        assert.doesNotMatch(minimal, /--island-(?:margin|padding|background|border|radius|shadow):/)
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
        assert.match(structural, /fray-app\s*\{[^}]*display:\s*block[^}]*color:\s*var\(--ui-color\)/)
        assert.match(structural, /fray-navigationbar > nav > ul\s*\{[^}]*display:\s*flex/)
        assert.match(structural, /fray-routeoutlet > div\[hidden\]\s*\{[^}]*display:\s*none/)
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

/** Separate a theme's `@layer theme` token block from its ordinary rules. */
function splitThemeLayer(css: string): {layered: string; unlayered: string} {
    const start = css.indexOf('@layer theme')
    if (start < 0) return {layered: '', unlayered: css}
    let depth = 0
    let end = css.length
    for (let index = start; index < css.length; index += 1) {
        if (css[index] === '{') depth += 1
        else if (css[index] === '}') {
            depth -= 1
            if (depth === 0) {
                end = index + 1
                break
            }
        }
    }
    return {layered: css.slice(start, end), unlayered: css.slice(0, start) + css.slice(end)}
}

function oneLineCustomProperties(css: string): Map<string, string> {
    return new Map([...css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;\n]+);/gmi)]
        .map(([, name, value]) => [name!, value!.trim()]))
}
