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
    GroupBox,
    Header,
    OptionGroup,
    OptionsBox,
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
    QuadCheckbox,
    TriCheckbox,
    TreeView,
    createCapillaryUiRuntime,
    capillaryUiColorOptions,
    capillaryUiThemeOptions,
    capillaryUiThemeVariableCatalog,
    getCapillaryUiAppearance,
    replaceCapillaryUiStylesheet,
    setCapillaryUiAppearance,
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
            document.head.querySelectorAll('style[data-cap-structural-styles]').length,
            1,
        )
        assert.match(second.textContent, /cap-button > button/)
        assert.match(second.textContent, /cap-textbox > input/)
        assert.match(second.textContent, /\.cap-fill-horizontal,\s*\.cap-fill-vertical\s*\{[^}]*font-family:\s*var\(--font-family\)[^}]*font-size:\s*var\(--font-size\)[^}]*line-height:\s*var\(--line-height\)/)
        assert.match(second.textContent, /\.cap-fill-horizontal\s*\{[^}]*width:\s*100vw[^}]*overflow-x:\s*auto/)
        assert.match(second.textContent, /\.cap-fill-vertical\s*\{[^}]*height:\s*100vh[^}]*overflow-y:\s*auto/)
        assert.match(second.textContent, /\.cap-layout-horizontal,\s*\.cap-layout-vertical\s*\{[^}]*display:\s*flex[^}]*align-items:\s*stretch[^}]*min-inline-size:\s*0[^}]*min-block-size:\s*0/)
        assert.match(second.textContent, /\.cap-layout-horizontal\s*\{[^}]*flex-direction:\s*row/)
        assert.match(second.textContent, /\.cap-layout-vertical\s*\{[^}]*flex-direction:\s*column/)
        assert.match(second.textContent, /\.cap-size-natural\s*\{[^}]*flex:\s*0 0 auto/)
        assert.match(second.textContent, /\.cap-size-flexible\s*\{[^}]*flex:\s*1 1 0[^}]*min-inline-size:\s*0[^}]*min-block-size:\s*0/)
        assert.match(second.textContent, /\.cap-scroll\s*\{[^}]*overflow:\s*auto[^}]*min-inline-size:\s*0[^}]*min-block-size:\s*0/)
        assert.doesNotMatch(second.textContent, /\.cap-(?:layout|size|scroll)[^{]*\{[^}]*!important/)
        assert.doesNotMatch(second.textContent, /\.cap-fill-(?:horizontal|vertical) \[data-cap\]/)
        assert.match(second.textContent, /\.colored\s*\{[^}]*--colored-base-bg:[\s\S]*linear-gradient\([^}]*background:\s*var\(--colored-base-bg\)[^}]*box-shadow:\s*var\(--colored-shadow\)/)
        assert.match(second.textContent, /\.island\s*\{[^}]*margin:\s*var\(--island-margin\)/)
        assert.match(second.textContent, /\.cap-fill-horizontal \.island\s*\{[^}]*max-width:[^}]*overflow-x:\s*auto/)
        assert.match(second.textContent, /\.cap-fill-vertical \.island\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/)
        assert.equal((second.textContent.match(/^\s*\.island\s*\{/gm) ?? []).length, 1)
        assert.doesNotMatch(second.textContent, /\.cap-app/)
        assert.doesNotMatch(second.textContent, /selectshell/)
        assert.doesNotMatch(second.textContent, /data-cap-component|undefined/)
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

        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(DerivedProbe)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-derivedprobe\s*\{ --class-order: base; \}/)
        assert.match(stylesheet, /cap-derivedprobe\s*\{ --class-order: derived; \}/)
        assert.ok(stylesheet.indexOf('--class-order: base') < stylesheet.indexOf('--class-order: derived'))
        assert.match(stylesheet, /cap-basedependency/)
        assert.match(stylesheet, /cap-deriveddependency/)
        assert.doesNotMatch(stylesheet, /&|cap-baseprobe/)
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

        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(CheckboxProbe)
        runtime.registerStyles(RadioProbe)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-checkboxprobe > label,\s*cap-radioprobe > label\s*\{[^}]*--shared-checkable-rule:\s*normal/)
        assert.match(stylesheet, /@media \(forced-colors: active\)\s*\{[\s\S]*cap-checkboxprobe > label,\s*cap-radioprobe > label\s*\{[^}]*--shared-checkable-rule:\s*forced/)
        assert.equal((stylesheet.match(/@keyframes shared-checkable-probe/g) ?? []).length, 1)
    })

    test('coalesces the shared checkable-control rules for Checkbox and RadioButton', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Checkbox)
        runtime.registerStyles(RadioButton)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-checkbox > label,\s*cap-radiobutton > label\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /cap-checkbox > label > input \+ cap-checkshell,\s*cap-radiobutton > label > input \+ cap-checkshell\s*\{[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
    })

    test('collects one semantic loading/error system across controls and data views', () => {
        const runtime = createCapillaryUiRuntime()
        for (const component of [
            Button,
            Textbox,
            Dropdown,
            Checkbox,
            RadioGroup,
            Toggle,
            DatePicker,
            TimePicker,
            DateTimePicker,
            OptionGroup,
            ProgressBar,
            ListView,
            TreeView,
            DataTable,
        ]) runtime.registerStyles(component)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.equal(stylesheet.match(/@keyframes cap-working-progress/g)?.length, 1)
        assert.match(stylesheet, /cap-button > button\[aria-busy="true"\][^{]*\{[^}]*animation:\s*cap-working-progress/)
        assert.match(stylesheet, /cap-textbox > input\[aria-busy="true"\][^{]*\{[^}]*background:\s*var\(--working-background-image\)/)
        assert.match(stylesheet, /cap-dropdown > cap-selectshell:has\(> select\[aria-busy="true"\]/)
        assert.match(stylesheet, /input\[aria-busy="true"\][^{]*\+ cap-checkshell\s*\{[^}]*animation:\s*cap-working-progress/)
        assert.match(stylesheet, /cap-toggle > cap-options\[aria-busy="true"\][\s\S]*button\[role="radio"\][\s\S]*animation:\s*cap-working-progress/)
        assert.match(stylesheet, /cap-progressbar:has\(> progress:indeterminate\) > cap-content::after[\s\S]*animation:\s*cap-working-progress/)
        assert.match(stylesheet, /cap-placeholder::after[\s\S]*animation:\s*cap-working-progress/)
        for (const host of ['cap-datatable', 'cap-listview', 'cap-treeview']) {
            assert.match(stylesheet, new RegExp(`${host}\\[data-cap-retained-loading\\]::after`))
        }
        assert.doesNotMatch(stylesheet, /td::after|\[role="option"\]::after|\[role="treeitem"\]::after/)

        assert.match(stylesheet, /cap-error\s*\{[^}]*position:\s*absolute/)
        assert.match(stylesheet, /cap-error > cap-erroricon\s*\{[^}]*background:\s*var\(--error-color\)/)
        assert.match(stylesheet, /cap-error > cap-erroricon\s*\{[^}]*position:\s*absolute/)
        assert.match(stylesheet, /cap-error > cap-errortext\s*\{[^}]*position:\s*absolute[^}]*visibility:\s*hidden/)
        assert.match(stylesheet, /cap-error > cap-erroricon:hover \+ cap-errortext/)
        assert.match(stylesheet, /\[aria-invalid="true"\][^{]*\{[^}]*border-color:\s*var\(--error-control-border\)[^}]*box-shadow:\s*var\(--error-control-shadow\)/)
        assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/)
        assert.match(stylesheet, /@media \(forced-colors: active\)[\s\S]*(?:Mark|Highlight)/)
    })

    test('collects Button CSS only through its fixed host', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Button)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-button > button\s*\{[^}]*background:\s*var\(--button-background\)/)
        assert.match(stylesheet, /cap-button > button:focus-visible/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)button\s*\{|data-cap-component|cap-panel|cap-sidebar/)
    })

    test('collects Dialog through its fixed host, native dialog, and fixed content part', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Dialog)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-dialog > dialog\s*\{[^}]*z-index:\s*2[^}]*background:\s*var\(--panel-background\)[^}]*box-shadow:\s*var\(--dialog-shadow\)[^}]*isolation:\s*isolate/)
        assert.doesNotMatch(stylesheet, /cap-dialog > dialog\s*\{[^}]*position:/)
        assert.match(stylesheet, /cap-dialog > dialog\[open\]\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/)
        assert.match(stylesheet, /cap-dialog > dialog::backdrop\s*\{[^}]*background:\s*var\(--dialog-backdrop-background\)/)
        assert.match(stylesheet, /cap-dialog > dialog > cap-content\s*\{[^}]*position:\s*relative[^}]*z-index:\s*0[^}]*display:\s*block[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /cap-dialog > dialog > header\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1[^}]*background:\s*var\(--dialog-header-background\)[^}]*box-shadow:\s*var\(--section-header-shadow\)/)
        assert.match(stylesheet, /cap-button > button/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)dialog\s*\{|data-part|cap-panel|cap-dropdown/)
    })

    test('collects TabPanel through native panel sections without styling data hooks', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(TabPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-tabpanel\s*\{[^}]*background:\s*var\(--panel-background\)[^}]*border-radius:\s*var\(--panel-radius\)[^}]*box-shadow:\s*var\(--panel-shadow\)/)
        assert.match(stylesheet, /cap-tabpanel > section\[role="tabpanel"\]\s*\{[^}]*overflow:\s*auto[^}]*padding:\s*3px/)
        assert.match(stylesheet, /cap-tabpanel > section\[role="tabpanel"\]\[hidden\]\s*\{[^}]*display:\s*none/)
        assert.match(stylesheet, /cap-tabpanel > section\[role="tabpanel"\] > cap-toolbar\[role="toolbar"\]:first-child\s*\{[^}]*width:\s*calc\(100% \+ 6px\)[^}]*margin-block-start:\s*-3px/)
        assert.match(stylesheet, /cap-tabline > button\[role="tab"\]/)
        assert.doesNotMatch(stylesheet, /cap-tabpanel[^}]*data-part|cap-tabpanel > div/)
    })

    test('collects NavigationBar and RouteOutlet through their native structure', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(NavigationBar)
        runtime.registerStyles(RouteOutlet)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-navigationbar\s*\{[^}]*color:\s*var\(--navigation-bar-color\)[^}]*background:\s*var\(--navigation-bar-background\)[^}]*border:\s*var\(--navigation-bar-border\)/)
        assert.match(stylesheet, /cap-navigationbar > nav > ul\s*\{[^}]*display:\s*flex[^}]*list-style:\s*none/)
        assert.match(stylesheet, /cap-navigationbar > nav > ul > li > a,\s*cap-navigationbar > nav > ul > li > span\[aria-disabled="true"\]\s*\{[^}]*color:\s*var\(--navigation-link-color\)[^}]*background:\s*var\(--navigation-link-background\)[^}]*border:\s*var\(--navigation-link-border\)/)
        assert.match(stylesheet, /cap-navigationbar > nav > ul > li > a\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--navigation-link-color-current\)[^}]*background:\s*var\(--navigation-link-background-current\)[^}]*box-shadow:\s*var\(--navigation-link-shadow-current\)[^}]*font-weight:\s*var\(--navigation-link-font-weight-current\)/)
        assert.match(stylesheet, /cap-routeoutlet\s*\{[^}]*display:\s*flex[^}]*overflow:\s*hidden/)
        assert.match(stylesheet, /cap-routeoutlet > div\[hidden\]\s*\{[^}]*display:\s*none/)
        assert.doesNotMatch(stylesheet, /cap-tabline|role="tab"|data-part/)
    })

    test('DescriptionItem emits direct native terms and values without structural CSS', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(DescriptionItem)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.doesNotMatch(stylesheet, /div:has\(> dt \+ dd\)|description-item|cap-descriptionitem/)
    })

    test('collects DescriptionList through its fixed host and native list surface', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(DescriptionList)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-descriptionlist\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /cap-descriptionlist > dl\s*\{[^}]*display:\s*grid[^}]*margin:\s*0/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)dl:has\(|data-cap-component|cap-panel|cap-sidebar/)
    })

    test('InfoField emits direct native terms and values without structural CSS', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(InfoField)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.doesNotMatch(stylesheet, /info-field|cap-infofield/)
    })

    test('collects InfoPanel through its fixed host with panel chrome and grid layout', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(InfoPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-infopanel\s*\{[\s\S]*border:[\s\S]*display:\s*flex/)
        assert.match(stylesheet, /cap-infopanel > dl\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*auto 1fr/)
        assert.match(stylesheet, /cap-infopanel > dl > dt\s*\{[\s\S]*font-weight:\s*600/)
        assert.match(stylesheet, /cap-infopanel > dl > dd\s*\{[\s\S]*margin:\s*0/)
    })

    test('collects Placeholder through its fixed host and working texture only', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Placeholder)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-placeholder\s*\{[^}]*width:\s*5em[^}]*height:\s*1em[^}]*background:\s*#ccc/)
        assert.match(stylesheet, /cap-placeholder::after\s*\{[^}]*animation:\s*cap-working-progress \.55s linear infinite[^}]*background-image:\s*var\(--working-background-image\)/)
        assert.match(stylesheet, /@keyframes cap-working-progress\s*\{[\s\S]*background-position:\s*2rem 0/)
        assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*cap-placeholder::after\s*\{[^}]*animation:\s*none/)
        assert.doesNotMatch(stylesheet, /(?:^|\n)placeholder\s*\{|data-part|data-state|cap-panel|cap-sidebar/)
    })

    test('collects ListView through its fixed host and native list items', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(ListView)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-listview\s*\{[^}]*background:\s*var\(--ui-input-bg\)[^}]*pointer-events:\s*all[^}]*white-space:\s*nowrap/)
        assert.match(stylesheet, /cap-listview > \[role="listbox"\],\s*cap-listview > ul\[aria-hidden="true"\]\s*\{[^}]*list-style:\s*none/)
        assert.match(stylesheet, /cap-listview > \[role="listbox"\] > \[role="option"\],[^{]*\{[^}]*line-height:\s*calc\(var\(--ui-font-size\)/)
        assert.match(stylesheet, /cap-listview > \[role="listbox"\] > \[role="option"\]:hover\s*\{[^}]*background:\s*var\(--hover-bg-color, #f5f5f5\)/)
        assert.match(stylesheet, /cap-listview\s*\{[^}]*flex:\s*1 1 auto[^}]*min-block-size:\s*0[^}]*max-block-size:\s*100%[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /cap-listview > \[role="listbox"\] > \[role="option"\]\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--selected-bg-color, #e0e7ff\)/)
        assert.match(stylesheet, /cap-placeholder::after/)
        assert.doesNotMatch(stylesheet, /cap-list-view|data-part|(?:^|\n)div\s*\{|cap-panel|cap-sidebar/)
    })

    test('collects TreeView through its native tree and fixed internal parts', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(TreeView)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-treeview\s*\{[^}]*flex:\s*1 1 auto[^}]*min-block-size:\s*0[^}]*max-block-size:\s*100%[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /cap-treeview > \[role="tree"\],[\s\S]*cap-treeview > ul\[aria-hidden="true"\]\s*\{[^}]*list-style:\s*none/)
        assert.match(stylesheet, /cap-treeview \[role="treeitem"\]:hover\s*\{[^}]*background:\s*var\(--button-background-hover\)/)
        assert.match(stylesheet, /cap-treeview \[role="treeitem"\]:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
        assert.match(stylesheet, /cap-treeview \[role="treeitem"\]\[aria-selected="true"\]\s*\{[^}]*color:\s*var\(--ui-select-text-color\)[^}]*background:\s*var\(--ui-select-bg\)/)
        assert.match(stylesheet, /cap-treeview cap-expander\s*\{/)
        assert.match(stylesheet, /cap-treeview cap-label\s*\{/)
        assert.doesNotMatch(stylesheet, /data-(?:part|depth|expandable)|(?:^|\n)div\s*\{|cap-listview|cap-panel/)
    })

    test('collects FilterPanel through its fixed Bank2 floating surface and Checkbox dependency', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(FilterPanel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-filterpanel\s*\{[^}]*position:\s*absolute[^}]*color:\s*var\(--filter-panel-color\)[^}]*background:\s*var\(--filter-panel-background\)[^}]*border:\s*var\(--filter-panel-border\)[^}]*border-radius:\s*var\(--filter-panel-radius\)[^}]*padding:\s*var\(--filter-panel-padding\)[^}]*min-width:\s*var\(--filter-panel-min-width\)[^}]*box-shadow:\s*var\(--filter-panel-shadow\)[^}]*left:\s*100%[^}]*top:\s*0/)
        assert.match(stylesheet, /cap-filterpanel > p\s*\{[^}]*margin:\s*0/)
        assert.match(stylesheet, /cap-checkbox > label > input \+ cap-checkshell/)
        assert.doesNotMatch(stylesheet, /panellike|data-state|data-part|cap-table|cap-listview/)
    })

    test('collects the native DataTable family through the fixed table boundary', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(DataTable)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-datatable\s*\{[^}]*display:\s*block[^}]*flex:\s*1 1 auto[^}]*min-block-size:\s*0[^}]*max-block-size:\s*100%[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /cap-datatable > table > thead\s*\{[^}]*color:\s*var\(--table-header-color\)[^}]*background:\s*var\(--ui-gradient\)/)
        assert.match(stylesheet, /cap-datatable > table > thead > tr > th\s*\{[^}]*position:\s*sticky[^}]*inset-block-start:\s*0[^}]*background:\s*var\(--ui-gradient\)/)
        assert.match(stylesheet, /cap-datatable > table > thead > tr > th\[aria-sort\]\s*\{[^}]*position:\s*sticky[^}]*inset-block-start:\s*0/)
        assert.match(stylesheet, /button\.sort > span\.sortindicator\s*\{[^}]*right:\s*20px[^}]*text-align:\s*center/)
        assert.match(stylesheet, /button\.filter\s*\{[^}]*right:\s*2px[^}]*opacity:\s*0\.5/)
        assert.match(stylesheet, /cap-datatable > table > tbody > tr\[aria-selected="true"\] > td\s*\{[^}]*background:\s*var\(--ui-select-bg\)/)
        assert.match(stylesheet, /cap-datatable > table > tbody > tr:nth-child\(even\)\[aria-selected="true"\] > td\s*\{[^}]*background:\s*var\(--ui-select-bg-dark\)/)
        assert.match(stylesheet, /cap-filterpanel\s*\{/)
        assert.match(stylesheet, /cap-placeholder\s*\{/)
        assert.doesNotMatch(stylesheet, /datacomponentlike|data-(?:loading|error|part)|cap-listview|cap-treeview|(?:^|\n)th\[aria-sort\]/)
    })

    test('select controls inherit shared fixed-shell CSS without recipes', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Dropdown)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-dropdown\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /cap-dropdown > cap-selectshell\s*\{/)
        assert.match(stylesheet, /cap-dropdown > cap-selectshell::before\s*\{/)
        assert.match(stylesheet, /cap-dropdown > cap-selectshell::after\s*\{/)
        assert.match(stylesheet, /cap-selectshell:has\(> select:required:invalid:not\(:disabled\):not\(\[aria-invalid="true"\]\)\)\s*\{[^}]*outline:\s*1px dashed var\(--required-color\)/)
        assert.match(stylesheet, /appearance:\s*var\(--dropdown-appearance\)/)
        assert.doesNotMatch(stylesheet, /\.selectshell|data-disabled|data-required|data-error|cap-dropdown > (?:input|textarea)/)
    })

    test('collects both stylesheet pickers through the shared select hierarchy', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(ThemePicker)
        runtime.registerStyles(ColorPicker)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-dropdown\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /cap-dropdown > cap-selectshell > select\s*\{[^}]*min-width:/)
        assert.match(stylesheet, /cap-dropdown > cap-selectshell::before/)
        assert.doesNotMatch(stylesheet, /data-(?:kind|disabled|required|error)|cap-themepicker|cap-colorpicker|cap-treeview/)
    })

    test('keeps checkbox controls separate from generic input and button treatment', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Checkbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-checkbox\s*\{[^}]*display:\s*inline-flex[^}]*line-height:\s*1/)
        assert.match(stylesheet, /cap-checkbox > label\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /input \+ cap-checkshell/)
        assert.match(stylesheet, /label:has\(> input:disabled\)\s*\{[^}]*color:\s*var\(--checkable-label-color-disabled\)[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /cap-checkshell\s*\{[^}]*width:\s*var\(--checkbox-box-size, 1em\)[^}]*height:\s*var\(--checkbox-box-size, 1em\)[^}]*border-radius:\s*var\(--checkbox-box-radius,[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
        assert.match(stylesheet, /input:checked \+ cap-checkshell\s*\{[^}]*border:\s*var\(--checkbox-box-border-checked,[^}]*box-shadow:\s*var\(--checkbox-box-shadow-checked\)/)
        assert.doesNotMatch(stylesheet, /input\[value="(?:require|deny|prefer)"\]/)
        assert.match(stylesheet, /label:has\(> input\[type="checkbox"\]:required:invalid:not\(:disabled\):not\(\[aria-invalid="true"\]\)\)\s*\{[^}]*outline:\s*1px dashed var\(--required-color\)/)
        assert.doesNotMatch(stylesheet, /\.checkboxshell|\[data-(?:disabled|required|error|state)\]|cap-checkboxshell|cap-checkbox\s*\{[^}]*width:\s*var\(--input-width/)
    })

    test('keeps semantic checkbox state chrome out of ordinary checkboxes', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(TriCheckbox)
        runtime.registerStyles(QuadCheckbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-(?:tri|quad)checkbox[^{}]*input\[value="require"\] \+ cap-checkshell\s*\{[^}]*background:\s*var\(--checkbox-positive-background\)/)
        assert.match(stylesheet, /cap-(?:tri|quad)checkbox[^{}]*input\[value="deny"\] \+ cap-checkshell\s*\{[^}]*background:\s*var\(--checkbox-negative-background\)/)
        assert.match(stylesheet, /cap-(?:tri|quad)checkbox[^{}]*input\[value="prefer"\] \+ cap-checkshell\s*\{[^}]*background:\s*var\(--checkbox-neutral-background\)/)
        assert.doesNotMatch(stylesheet, /cap-checkbox > label > input\[value="(?:require|deny|prefer)"\]/)
    })

    test('collects RadioButton through its fixed shell and native state selectors', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(RadioButton)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-radiobutton\s*\{[^}]*display:\s*inline-flex/)
        assert.match(stylesheet, /cap-radiobutton > label:has\(> input:disabled\)\s*\{[^}]*color:\s*var\(--checkable-label-color-disabled\)[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /input \+ cap-checkshell\s*\{[^}]*background:\s*var\(--checkbox-box-background,[^}]*box-shadow:\s*var\(--checkbox-box-shadow\)/)
        assert.match(stylesheet, /input:checked \+ cap-checkshell\s*\{[^}]*background:\s*var\(--checkbox-box-background-checked,[^}]*box-shadow:\s*var\(--checkbox-box-shadow-checked\)/)
        assert.match(stylesheet, /input\[type="radio"\] \+ cap-checkshell\s*\{[^}]*border-radius:\s*50%/)
        assert.match(stylesheet, /input\[type="radio"\]:checked \+ cap-checkshell\s*\{[^}]*background:\s*var\(--radio-box-background-checked,[^}]*border:\s*var\(--radio-box-border-checked,[^}]*box-shadow:\s*var\(--radio-box-shadow-checked,/)
        assert.match(stylesheet, /input\[type="radio"\]:checked \+ cap-checkshell::after\s*\{[^}]*width:\s*var\(--radio-symbol-size, \.4em\)[^}]*border-radius:\s*50%[^}]*background:\s*var\(--radio-symbol-color, var\(--checkbox-symbol-color\)\)/)
        assert.match(stylesheet, /input:disabled \+ cap-checkshell\s*\{[^}]*opacity:\s*0\.6[^}]*filter:\s*saturate\(0\.6\)/)
        assert.match(stylesheet, /input:focus-visible \+ cap-checkshell\s*\{[^}]*outline:\s*2px solid var\(--focus-color,/)
        assert.doesNotMatch(stylesheet, /\.radioshell|data-disabled|data-required|data-error|cap-radioshell|cap-radiogroup/)
    })

    test('collects RadioGroup through its native fieldset and RadioButton dependency', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(RadioGroup)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-radiogroup > fieldset\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*column wrap[^}]*gap:\s*var\(--radio-group-gap, \.5rem\)[^}]*min-inline-size:\s*0/)
        assert.match(stylesheet, /cap-radiogroup > fieldset > legend\s*\{[^}]*flex:\s*0 0 100%[^}]*padding:\s*0/)
        assert.match(stylesheet, /cap-radiobutton > label > input\[type="radio"\] \+ cap-checkshell\s*\{[^}]*border-radius:\s*50%/)
        assert.doesNotMatch(stylesheet, /data-part|data-disabled|data-required|data-error|cap-options|cap-toggle/)
    })

    test('collects ProgressBar through its fixed clipped-label parts and native semantics', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(ProgressBar)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-progressbar\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /cap-progressbar > label,[\s\S]*cap-progressbar > progress\s*\{[^}]*clip:\s*rect\(0 0 0 0\)/)
        assert.match(stylesheet, /cap-progressbar > cap-content\s*\{[^}]*background:\s*var\(--progress-track-background\)[^}]*box-shadow:\s*var\(--progress-track-shadow\)/)
        assert.match(stylesheet, /cap-progressbar > cap-content > cap-progress\s*\{[^}]*width:\s*var\(--progress-width, 0%\)[^}]*background:\s*var\(--progress-value-background\)[^}]*box-shadow:\s*var\(--progress-value-shadow\)/)
        assert.match(stylesheet, /cap-progressbar > cap-content > cap-progress > cap-inverse\s*\{[^}]*width:\s*var\(--progress-inverse-width, 10000%\)[^}]*color:\s*var\(--progress-value-color\)/)
        assert.match(stylesheet, /cap-progressbar:has\(> progress:indeterminate\) > cap-content > cap-progress\s*\{[^}]*display:\s*none/)
        assert.match(stylesheet, /@media \(forced-colors: active\)[\s\S]*cap-progressbar > cap-content > cap-progress\s*\{[^}]*background:\s*Highlight/)
        assert.doesNotMatch(stylesheet, /data-part|cap-checkbox|cap-dropdown|cap-panel/)
    })

    test('collects Textbox with its meaningful labelled-input base only', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Textbox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-textbox\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /cap-textbox > input\s*\{[^}]*background:\s*var\(--input-background\)/)
        assert.match(stylesheet, /cap-textbox > input\s*\{[^}]*cursor:\s*text/)
        assert.match(stylesheet, /cap-textbox > input:disabled\s*\{[^}]*cursor:\s*not-allowed/)
        assert.match(stylesheet, /cap-textbox > input:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
        assert.match(stylesheet, /cap-textbox > input:required:invalid:not\(:disabled\):not\(\[readonly\]\):not\(\[aria-invalid="true"\]\)\s*\{[^}]*outline:\s*1px dashed var\(--required-color\)/)
        assert.doesNotMatch(stylesheet, /textarea|data-disabled|data-required|data-error|cap-dropdown|cap-button/)
    })

    test('collects the complete Panel treatment without unrelated component CSS', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Panel)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-panel\s*\{[^}]*background:\s*var\(--panel-background\)/)
        assert.match(stylesheet, /cap-header\s*\{[^}]*padding:\s*\.25em/)
        assert.match(stylesheet, /cap-panel > cap-layout\.panel-content\s*\{[^}]*padding:\s*var\(--panel-content-padding, var\(--panel-padding, 0\.75rem\)\)/)
        assert.match(stylesheet, /cap-panel\.island:has\(> cap-header\) > cap-layout\.panel-content:has\(> \[data-cap-surface='data'\]:only-child\)\s*\{[^}]*--panel-content-padding:\s*0/)
        assert.doesNotMatch(stylesheet, /cap-datatable|cap-listview|cap-treeview|cap-blockgraph/)
        assert.match(stylesheet, /cap-panel\[aria-disabled="true"\]\s*\{[^}]*opacity:\s*\.65/)
        assert.doesNotMatch(stylesheet, /cap-panel > header/)
        assert.doesNotMatch(stylesheet, /cap-sidebar|cap-dropdown|cap-checkbox|cap-textbox/)
    })

    test('collects OptionGroup fieldset shell and labeled legend treatment', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(OptionGroup)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-optiongroup\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /cap-optiongroup > fieldset\s*\{[^}]*margin:\s*0[^}]*padding:\s*0[^}]*border:\s*0/)
        assert.match(stylesheet, /cap-optiongroup > fieldset > legend\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*border-bottom:\s*1px solid var\(--ui-border-color\)/)
        assert.match(stylesheet, /cap-optiongroup > fieldset > legend > span\s*\{[^}]*flex:\s*1/)
        assert.doesNotMatch(stylesheet, /cap-groupbox|cap-panel|cap-header|cap-checkbox/)
    })

    test('collects OptionsBox with inherited GroupBox flex layout and option rhythm', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(OptionsBox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-optionsbox\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*var\(--cap-groupbox-flow, row nowrap\)[^}]*border:\s*var\(--cap-groupbox-border, 1px solid var\(--ui-border-color\)\)/)
        assert.match(stylesheet, /cap-optionsbox > cap-header\s*\{[^}]*place-items:\s*var\(--cap-groupbox-header-align, center\)[^}]*writing-mode:\s*var\(--cap-groupbox-header-writing, vertical-rl\)[^}]*transform:\s*var\(--cap-groupbox-header-transform, rotate\(180deg\)\)/)
        assert.match(stylesheet, /cap-optionsbox > cap-content\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*gap:\s*1rem/)
        assert.match(stylesheet, /cap-optionsbox > cap-content \* > fieldset > legend\s*\{[^}]*padding:\s*0 0 0\.25rem[^}]*margin-bottom:\s*0\.25rem/)
        assert.match(stylesheet, /cap-optionsbox > cap-content \* > fieldset\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*column[^}]*gap:\s*\.33rem/)
        assert.match(stylesheet, /cap-header\s*\{[^}]*background:\s*var\(--section-header-background\)/)
        assert.doesNotMatch(stylesheet, /cap-panel|cap-sidebar|cap-checkbox/)
    })

    test('collects GroupBox default, section, and column structural treatment', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(GroupBox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-groupbox\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*var\(--cap-groupbox-flow, row nowrap\)[^}]*gap:\s*var\(--cap-groupbox-gap, 0 0\.35rem\)[^}]*border:\s*var\(--cap-groupbox-border, 1px solid var\(--ui-border-color\)\)/)
        assert.match(stylesheet, /cap-groupbox > cap-header\s*\{[^}]*place-items:\s*var\(--cap-groupbox-header-align, center\)[^}]*width:\s*var\(--cap-groupbox-header-width, 1\.7em\)[^}]*border-radius:\s*var\(--ui-border-radius\)/)
        assert.match(stylesheet, /cap-groupbox > cap-header\s*\{[^}]*color:\s*var\(--cap-groupbox-header-color, var\(--section-header-color\)\)[^}]*writing-mode:\s*var\(--cap-groupbox-header-writing, vertical-rl\)[^}]*transform:\s*var\(--cap-groupbox-header-transform, rotate\(180deg\)\)/)
        assert.match(stylesheet, /cap-groupbox\.cap-groupbox-section\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)[^}]*grid-template-rows:\s*max-content minmax\(max-content, 1fr\)[^}]*border:\s*0/)
        assert.match(stylesheet, /cap-groupbox\.cap-groupbox-section::before\s*\{[^}]*border-block-start:\s*var\(--groupbox-section-separator\)/)
        assert.match(stylesheet, /cap-groupbox\.cap-groupbox-section > cap-header\s*\{[^}]*color:\s*var\(--groupbox-section-header-color\)[^}]*font-size:\s*var\(--groupbox-section-font-size, 1\.2em\)[^}]*font-weight:\s*600/)
        assert.match(stylesheet, /cap-layout-horizontal > cap-groupbox\.cap-groupbox-section::before\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*2[^}]*border-inline-end:\s*var\(--groupbox-section-separator\)/)
        assert.match(stylesheet, /cap-groupbox\.cap-groupbox-column\s*\{[^}]*gap:\s*0[^}]*border:\s*0[^}]*flex:\s*0 1 auto/)
        assert.match(stylesheet, /cap-groupbox\.cap-groupbox-column > cap-header[\s\S]*?margin-block-end:\s*0\.75rem[\s\S]*?font-size:\s*var\(--ui-font-size\)[\s\S]*?font-weight:\s*600/)
        assert.match(stylesheet, /cap-layout-horizontal > cap-groupbox\.cap-groupbox-column,[\s\S]*?cap-layout-vertical > cap-groupbox\.cap-groupbox-column\s*\{[^}]*align-self:\s*stretch/)
        assert.match(stylesheet, /cap-layout-horizontal > cap-groupbox\.cap-groupbox-column \+ cap-groupbox\.cap-groupbox-column\s*\{[^}]*border-inline-start:\s*var\(--groupbox-column-separator\)/)
        assert.match(stylesheet, /cap-layout-vertical > cap-groupbox\.cap-groupbox-column \+ cap-groupbox\.cap-groupbox-column\s*\{[^}]*border-block-start:\s*var\(--groupbox-column-separator\)/)
        assert.doesNotMatch(stylesheet, /groupbox-preferred-width|cap-groupbox-grow-preference/)
        assert.match(stylesheet, /cap-header\s*\{[^}]*background:\s*var\(--section-header-background\)[^}]*box-shadow:\s*var\(--section-header-shadow\)/)
        assert.doesNotMatch(stylesheet, /cap-panel|cap-sidebar|cap-checkbox/)
    })

    test('GroupBox declares complete control and form context property sets', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(GroupBox)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /\[data-cap-context='control'\]\s*\{[^}]*--cap-groupbox-flow:\s*row nowrap[^}]*--cap-groupbox-border:\s*1px solid var\(--ui-border-color\)[^}]*--cap-groupbox-header-color:\s*var\(--section-header-color\)[^}]*--cap-groupbox-header-writing:\s*vertical-rl/)
        assert.match(stylesheet, /\[data-cap-context='form'\]\s*\{[^}]*--cap-groupbox-flow:\s*column nowrap[^}]*--cap-groupbox-border:\s*1px solid var\(--ui-border-color\)[^}]*--cap-groupbox-header-color:\s*var\(--text-color\)[^}]*--cap-groupbox-header-background:\s*var\(--panel-background\)[^}]*--cap-groupbox-header-writing:\s*horizontal-tb/)
    })

    test('collects Header CSS without unrelated component rules', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Header)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-header\s*\{[^}]*display:\s*block/)
        assert.match(stylesheet, /background:\s*var\(--section-header-background\)/)
        assert.match(stylesheet, /box-shadow:\s*var\(--section-header-shadow\)/)
        assert.match(stylesheet, /cap-header > h1,[\s\S]*cap-header > h6/)
        assert.doesNotMatch(stylesheet, /cap-panel|cap-sidebar|cap-dropdown|cap-button/)
    })

    test('collects the complete Sidebar treatment without unrelated component CSS', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Sidebar)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-sidebar\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/)
        assert.match(stylesheet, /cap-sidebar > cap-header,[\s\S]*cap-sidebar > cap-toolbarcontent/)
        assert.match(stylesheet, /cap-sidebar > cap-content\s*\{[^}]*flex:\s*1[^}]*overflow:\s*auto/)
        assert.match(stylesheet, /cap-header\s*\{[^}]*padding:\s*\.25em/)
        assert.doesNotMatch(stylesheet, /cap-sidebar > aside/)
        assert.doesNotMatch(stylesheet, /cap-panel|cap-dropdown|cap-checkbox|cap-textbox/)
    })

    test('collects the complete SplitView treatment without unrelated component CSS', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(SplitView)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-splitview\s*\{[^}]*display:\s*flex/)
        assert.match(stylesheet, /cap-splitview\.horizontal\s*\{[^}]*flex-direction:\s*row/)
        assert.match(stylesheet, /cap-splitview\.vertical\s*\{[^}]*flex-direction:\s*column/)
        assert.match(stylesheet, /cap-splitview > cap-primary\s*\{[^}]*flex:\s*0 0 var\(--split-primary-size, 40%\)/)
        assert.match(stylesheet, /cap-splitview > cap-secondary\s*\{[^}]*flex:\s*1 1 0/)
        assert.match(stylesheet, /cap-splitview > cap-separator\s*\{[^}]*touch-action:\s*none/)
        assert.match(stylesheet, /cap-splitview\.horizontal > cap-separator\s*\{[^}]*cursor:\s*col-resize/)
        assert.match(stylesheet, /cap-splitview\.vertical > cap-separator\s*\{[^}]*cursor:\s*row-resize/)
        assert.doesNotMatch(stylesheet, /\[data-direction|\[data-part/)
        assert.doesNotMatch(stylesheet, /cap-panel|cap-sidebar|cap-dropdown|cap-checkbox/)
    })

    test('collects the complete TabLine treatment without unrelated component CSS', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(TabLine)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-tabline\s*\{[^}]*background:\s*var\(--tabline-background\)/)
        assert.match(stylesheet, /cap-tabline\s*\{[^}]*overflow:\s*hidden/)
        assert.match(stylesheet, /button\[role="tab"\]:hover:not\(:disabled\)\[aria-selected="false"\]/)
        assert.match(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="true"\]\s*\{[^}]*min-height:\s*var\(--control-min-height, 2rem\)[^}]*margin-block-start:\s*0/)
        assert.match(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="false"\]::after/)
        assert.match(stylesheet, /button\[role="tab"\]:disabled\s*\{[^}]*cursor:\s*not-allowed/)
        assert.doesNotMatch(stylesheet, /button\[role="tab"\]:not\(:disabled\)\[aria-selected="true"\]::after|tab-button-active-(?:lift|bridge)/)
        assert.doesNotMatch(stylesheet, /cap-panel|cap-sidebar|cap-splitview|cap-dropdown/)
    })

    test('collects Toolbar CSS from its host without data hooks or unrelated rules', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Toolbar)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-toolbar\s*\{[^}]*background:\s*var\(--toolbar-background\)/)
        assert.match(stylesheet, /cap-toolbar > \*\s*\{[^}]*margin:\s*0/)
        assert.match(stylesheet, /cap-toolbar\[aria-orientation="vertical"\]/)
        assert.doesNotMatch(stylesheet, /data-orientation|toolbarlike|cap-panel|cap-sidebar|cap-dropdown/)
    })

    test('collects host-scoped Toggle CSS without data hooks or unrelated rules', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Toggle)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-toggle\s*\{[^}]*display:\s*flex[^}]*flex-flow:\s*row nowrap[^}]*align-items:\s*center/)
        assert.match(stylesheet, /cap-toggle > cap-options\s*\{[^}]*display:\s*flex[^}]*box-shadow:\s*var\(--toggle-group-shadow\)/)
        assert.match(stylesheet, /button\[role="radio"\]\[aria-checked="true"\]/)
        assert.match(stylesheet, /button\[role="radio"\]\[aria-checked="true"\]::before\s*\{[^}]*box-shadow:\s*var\(--toggle-button-shadow-checked\)/)
        assert.match(stylesheet, /button\[role="radio"\]\[aria-checked="false"\]\s*\+\s*\[role="radio"\]\[aria-checked="false"\]::after/)
        assert.match(stylesheet, /button\[role="radio"\]:disabled\s*\{[^}]*cursor:\s*not-allowed/)
        assert.doesNotMatch(stylesheet, /fieldset|\.options|data-part|data-disabled|cap-panel|cap-sidebar|cap-dropdown/)
    })

    test('collects DatePicker, TimePicker, and DateTimePicker structural CSS', () => {
        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(DatePicker)
        runtime.registerStyles(TimePicker)
        runtime.registerStyles(DateTimePicker)
        const stylesheet = runtime.styleRegistry.generateCSS()

        assert.match(stylesheet, /cap-datepicker[^{]*\{\s*display:\s*grid/)
        assert.match(stylesheet, /cap-timepicker[^{]*\{\s*display:\s*grid/)
        assert.match(stylesheet, /cap-datetimepicker[^{]*\{\s*display:\s*grid/)
        assert.match(stylesheet, /cap-datepicker > input[^{]*\{[^}]*min-height:\s*var\(--control-min-height, 2em\)/)
        assert.match(stylesheet, /cap-timepicker > input[^{]*\{[^}]*min-height:\s*var\(--control-min-height, 2em\)/)
        assert.match(stylesheet, /cap-datetimepicker > input[^{]*\{[^}]*min-height:\s*var\(--control-min-height, 2em\)/)
        assert.match(stylesheet, /cap-datepicker > input:required:invalid:not\(:disabled\):not\(\[readonly\]\):not\(\[aria-invalid="true"\]\),[\s\S]*?outline:\s*1px dashed var\(--required-color\)/)
        assert.doesNotMatch(stylesheet, /cap-timepicker > cap-selectshell|cap-datepicker > dialog|cap-datetimepicker > fieldset/)
        assert.doesNotMatch(stylesheet, /data-(?:disabled|required|error)|cap-textbox|cap-dropdown/)
    })

    test('uses fixed one-hyphen host names and resolves ampersands', () => {
        class Probe extends Component {
            static override hostName = 'probe'
            static override css = '& { display: block; }'
            render() { return this.host(null, 'configured') }
        }

        const runtime = createCapillaryUiRuntime()
        runtime.registerStyles(Probe).injectStyles(document)
        const probe = runtime.mount(runtime.create(Probe), document.body)
        assert.equal(probe.dom?.nodeName.toLowerCase(), 'cap-probe')
        assert.match(runtime.styleRegistry.generateCSS(), /cap-probe/)
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
        assert.match(css, /--palette-primary-surface-saturation:\s*1/)
        for (const status of ['negative', 'positive', 'neutral']) {
            assert.match(css, new RegExp(`--palette-status-${status}:`))
        }
        assert.doesNotMatch(css, /--palette-(?:red|green):/)
        assert.match(css, /--error-color:\s*var\(--negative-color\)/)
        assert.match(css, /--success-color:\s*var\(--positive-color\)/)
        for (const {name, fallback} of capillaryUiThemeVariableCatalog) {
            if (fallback == null) assert.match(css, new RegExp(`${name}:`))
        }
        for (const [alias, tone] of [['primary', 'light'], ['medium', 'medium'], ['dark', 'dark']]) {
            assert.match(css, new RegExp(`--ui-${alias}-bg-color:\\s*var\\(--palette-primary-surface-${tone}\\)`))
        }
    })

    test('color files contain anchors/endpoints only and never import base.css', async () => {
        for (const option of capillaryUiColorOptions) {
            const css = await readFile(fileURLToPath(option.href), 'utf8')
            assertVariableOnly(css, false)
            assert.doesNotMatch(css, /@import/)
            assert.doesNotMatch(css, /^\s*--(?!palette-)[a-z0-9-]+\s*:/m)
            for (const family of ['primary', 'secondary', 'neutral']) {
                assert.match(css, new RegExp(`--palette-${family}-500:`))
                assert.doesNotMatch(css, new RegExp(`--palette-${family}-(?:50|100|200|300|400|600|700|800|900|950):`))
            }
            const saturation = css.match(/--palette-primary-surface-saturation:\s*([\d.]+)/)?.[1]
            assert.ok(saturation != null, `${option.value} declares palette surface saturation`)
            assert.ok(Number(saturation) >= 0 && Number(saturation) <= 1,
                `${option.value} palette surface saturation is within 0–1`)
            for (const status of ['negative', 'positive', 'neutral']) {
                assert.match(css, new RegExp(`--palette-status-${status}:`))
            }
            assert.doesNotMatch(css, /--palette-(?:red|green):/)
        }
    })

    test('theme files layer tokens, keep ordinary rules unlayered, and never import base.css', async () => {
        const base = await readFile(
            fileURLToPath(new URL('../themes/base.css', import.meta.url)),
            'utf8',
        )
        const baseDeclarations = oneLineCustomProperties(base)
        for (const option of capillaryUiThemeOptions) {
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
        assert.match(css, /--toolbar-background:\s*var\(--ui-gradient-2\)/)
        assert.match(css, /--text-color:\s*var\(--palette-primary-900\)/)
        assert.match(css, /--ui-color:\s*var\(--text-color\)/)
        assert.match(css, /--island-border:\s*0px solid rgb\(255 255 255 \/ 0\.45\)/)
        assert.match(css, /--island-shadow:\s*0px 1px 2\.5px 0px var\(--palette-neutral-600\)/)
        assert.match(css, /--shiny-background:[\s\S]*radial-gradient\(140% 75% at 30% 10%, #fff2, #fff3 47%, #fff0 55%, #fff0\)[\s\S]*linear-gradient\(to bottom, var\(--palette-primary-900\) 0%, var\(--palette-primary\) 65%, var\(--palette-primary\) 66%, var\(--palette-primary-400\) 100%\)/)
        assert.match(css, /--section-header-background:\s*var\(--shiny-background\)/)
        assert.match(css, /--navigation-bar-background:\s*var\(--ui-gradient-2\)/)
        assert.match(css, /--navigation-bar-color:\s*var\(--text-color\)/)
        assert.match(css, /--navigation-link-color-current:\s*var\(--palette-contrast-light\)/)
        assert.match(css, /--navigation-link-background-current:\s*var\(--section-header-background\)/)
        const {unlayered} = splitThemeLayer(css)
        assert.match(unlayered, /\.colored\s*\{[^}]*background:\s*radial-gradient/)
        assert.match(unlayered, /^nav > ul > li\s*\{[^}]*border-radius:/m)
        assert.match(unlayered, /^cap-navigationbar nav > ul > li > a\s*\{[^}]*line-height:\s*1\.7em/m)
        assert.doesNotMatch(css, /--panel-shadow:/)
        assert.match(css, /--progress-track-background:\s*linear-gradient\(0deg, var\(--ui-dark-bg-color\) 0%, var\(--ui-primary-bg-color\) 100%\)/)
        assert.match(css, /--progress-value-background:[\s\S]*radial-gradient[\s\S]*linear-gradient\(15deg, var\(--palette-primary-800\) 0%, var\(--palette-primary\) 65%, var\(--palette-primary\) 65%, var\(--palette-primary-300\) 100%\)/)
        assert.match(css, /--progress-value-shadow:[\s\S]*inset -1px 1px 3px 0 #0003/)
        assert.match(css, /--block-graph-block-border:\s*none/)
        assert.match(css, /--colored-shadow:[\s\S]*inset -2px 2px 2px 0px #0006,[\s\S]*inset 2px -2px 2px 0px #fff5,[\s\S]*-3px 3px 4px 0px #0006/)
        assert.doesNotMatch(css, /--block-graph-block-shadow:/)
    })

    test('Capillary defines compact, palette-derived card chrome', async () => {
        const css = await readFile(
            fileURLToPath(new URL('../themes/capillary/theme.css', import.meta.url)),
            'utf8',
        )
        assert.match(css, /--panel-radius:\s*var\(--radius-lg\)/)
        assert.match(css, /--panel-background:[\s\S]*linear-gradient\([\s\S]*var\(--ui-primary-bg-color\)/)
        assert.match(css, /--panel-shadow:[\s\S]*inset 0 1px 0 color-mix\(in srgb, var\(--palette-light\) 96%, transparent\)[\s\S]*var\(--palette-dark\) 10%, transparent\)/)
        assert.match(css, /--capillary-active-background:[\s\S]*radial-gradient[\s\S]*var\(--palette-primary-700\)/)
        assert.match(css, /--button-background-active:\s*var\(--capillary-active-background\)/)
        assert.match(css, /--toggle-button-background-checked:\s*var\(--capillary-active-background\)/)
        assert.match(css, /--checkbox-box-background-checked:\s*var\(--capillary-active-background\)/)
        assert.match(css, /--checkbox-box-size:\s*1\.25em/)
        assert.match(css, /--checkbox-box-radius:\s*3px/)
        assert.match(css, /--radio-box-background-checked:\s*var\(--checkbox-box-background\)/)
        assert.match(css, /--radio-box-border-checked:\s*1px solid var\(--palette-primary\)/)
        assert.match(css, /--radio-symbol-color:\s*var\(--palette-primary\)/)
        assert.match(css, /--radio-symbol-size:\s*0\.5em/)
        assert.match(css, /--colored-shadow:[\s\S]*inset 0 1px 0 color-mix\(in srgb, var\(--palette-light\) 52%, transparent\)[\s\S]*var\(--c1, var\(--colored-dark\)\) 42%/)
        assert.match(css, /--block-graph-block-border:[\s\S]*var\(--c1, var\(--colored-dark\)\) 68%, var\(--palette-light\)/)
        assert.match(css, /--checkbox-(?:negative|positive|neutral)-background:[\s\S]*var\(--palette-status-(?:negative|positive|neutral)\)/)
        assert.match(css, /--progress-value-background:[\s\S]*var\(--palette-primary-400\), var\(--palette-primary\)/)
        assert.match(css, /--dropdown-trigger-background:\s*transparent/)
        assert.match(css, /--dropdown-trigger-border:\s*0 solid transparent/)
        assert.match(css, /cap-button > button\[aria-pressed="true"\][\s\S]*color:\s*var\(--palette-contrast-light\)/)
        assert.match(css, /cap-dropdown > cap-selectshell::after\s*\{[^}]*border-radius:\s*var\(--ui-border-radius\)/)
        assert.match(css, /cap-groupbox\.cap-groupbox-section:not\(cap-groupbox cap-groupbox\)[\s\S]*box-shadow:\s*var\(--panel-shadow\)/)
    })

    test('base BlockGraph tokens retain flat semantic category colors', async () => {
        const css = await readFile(
            fileURLToPath(new URL('../themes/base.css', import.meta.url)),
            'utf8',
        )
        assert.match(css, /--colored-shadow:\s*none/)
        assert.match(css, /--block-graph-block-shadow:\s*var\(--colored-shadow\)/)
    })

    test('base islands default to a 1rem margin over neutral panel chrome', async () => {
        const [base, minimal] = await Promise.all([
            readFile(fileURLToPath(new URL('../themes/base.css', import.meta.url)), 'utf8'),
            readFile(fileURLToPath(new URL('../themes/minimal/theme.css', import.meta.url)), 'utf8'),
        ])
        assert.match(base, /--application-background:\s*var\(--palette-light\)/)
        assert.match(base, /--island-margin:\s*1rem/)
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
        const names = new Set(capillaryUiThemeVariableCatalog.map(({name}) => name))
        assert.equal(names.size, capillaryUiThemeVariableCatalog.length)
        for (const definition of capillaryUiThemeVariableCatalog) {
            if (definition.fallback != null) assert.ok(names.has(definition.fallback))
        }
    })

    test('publishes the complete supported theme catalog', () => {
        assert.deepEqual(
            capillaryUiThemeOptions.map(({value, appearance}) => [value, appearance]),
            [
                ['capillary', 'light'],
                ['shiny', 'light'],
                ['soft', 'light'],
                ['white', 'light'],
                ['minimal', 'adaptive'],
            ],
        )
    })

    test('replaces theme and color links independently', () => {
        document.head.replaceChildren()
        const theme = capillaryUiThemeOptions[0]!
        const colors = capillaryUiColorOptions[0]!
        const themeLink = replaceCapillaryUiStylesheet('theme', theme, document)
        const colorLink = replaceCapillaryUiStylesheet('colors', colors, document)
        assert.notEqual(themeLink, colorLink)
        assert.equal(document.head.querySelectorAll('link[rel="stylesheet"]').length, 2)
        assert.equal(document.documentElement.dataset.theme, theme.value)
        assert.equal(document.documentElement.dataset.color, colors.value)
    })

    test('uses one root appearance setting for adaptive themes', () => {
        document.documentElement.removeAttribute('data-appearance')
        assert.equal(getCapillaryUiAppearance(document), 'system')
        setCapillaryUiAppearance('dark', document)
        assert.equal(getCapillaryUiAppearance(document), 'dark')
        setCapillaryUiAppearance('system', document)
        assert.equal(document.documentElement.hasAttribute('data-appearance'), false)
        assert.throws(() => setCapillaryUiAppearance('dim' as never, document), /light, dark, or system/)
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
        assert.match(structural, /cap-app\s*\{[^}]*display:\s*block[^}]*color:\s*var\(--ui-color\)/)
        assert.match(structural, /cap-navigationbar > nav > ul\s*\{[^}]*display:\s*flex/)
        assert.match(structural, /cap-routeoutlet > div\[hidden\]\s*\{[^}]*display:\s*none/)
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
