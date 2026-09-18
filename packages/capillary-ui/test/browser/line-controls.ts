import {
    Button, CapillaryUiApp, Checkbox, DatePicker, DateTimePicker, Dropdown, FilterMode, GroupBox,
    Layout, OptionGroup, OptionsBox, Panel, ProgressBar, QuadCheckbox, RadioButton, RadioGroup, Textbox, TimePicker, Toggle, Toolbar,
    TriCheckbox, createCapillaryUiRuntime, h, mountCapillaryUiApp,
} from '../../src/index.js'

function text() {
    return h('span', {'data-text': ''}, 'Ag Text')
}

function controls(state: {disabled?: boolean, busy?: boolean, error?: string} = {}) {
    return [
        h(Textbox, {...state, label: text(), defaultValue: 'Ag Text'}),
        h(Dropdown, {...state, label: text(), options: [{value: 'a', label: 'Ag Text'}]}),
        h(Toggle, {
            ...state,
            label: text(),
            options: [['a', text()], ['b', text()], ['c', text()]],
        }),
        h(Checkbox, {...state, label: text(), initialSemanticState: FilterMode.Prefer}),
        h(Button, {...state, label: text()}),
    ]
}

function checkables() {
    return [
        h(Checkbox, {label: text()}),
        h(TriCheckbox, {label: text()}),
        h(QuadCheckbox, {label: text()}),
        h(RadioButton, {label: text(), value: 'a'}),
    ]
}

class LineControlsApp extends CapillaryUiApp {
    static override dependencies = [
        Button, Checkbox, DatePicker, DateTimePicker, Dropdown, GroupBox, Layout, OptionGroup, OptionsBox,
        Panel, ProgressBar, QuadCheckbox, RadioButton, RadioGroup, Textbox, TimePicker, Toggle, Toolbar, TriCheckbox,
    ]

    override renderContent() {
        return [
            h(Toolbar, {id: 'toolbar', className: 'control-row'}, ...controls()),
            h(Layout, {id: 'layout', horizontal: true, className: 'control-row'}, ...controls()),
            h(Panel, {id: 'panel', horizontal: true, className: 'control-row'}, ...controls()),
            h(Layout, {id: 'tall', horizontal: true, className: 'control-row tall-row'}, ...controls()),
            ...(['disabled', 'busy', 'error'] as const).map((state) => h(Layout, {
                id: state, horizontal: true, className: 'control-row',
            }, ...controls({[state]: state === 'error' ? 'Required' : true}))),
            h(Layout, {id: 'variants', horizontal: true, className: 'control-row'},
                h(Textbox, {type: 'password', defaultValue: 'password', ariaLabel: 'Password'}),
                h(Textbox, {placeholder: 'Ag Text', ariaLabel: 'Placeholder'}),
                h(Textbox, {readOnly: true, defaultValue: 'Ag Text', ariaLabel: 'Read only'}),
                h(DatePicker, {ariaLabel: 'Date'}),
                h(TimePicker, {ariaLabel: 'Time'})),
            h(Layout, {id: 'stack', vertical: true},
                ...controls(), ...checkables(),
                h(DatePicker, {ariaLabel: 'Stack date'}),
                h(TimePicker, {ariaLabel: 'Stack time'}),
                h(DateTimePicker, {ariaLabel: 'Stack date and time'}),
                h(ProgressBar, {label: 'Stack progress', value: 50})),
            h(Layout, {id: 'check-stack', vertical: true}, ...checkables()),
            h(RadioGroup, {id: 'radio-stack', ariaLabel: 'Stack radios',
                options: [['a', 'First'], ['b', 'Second'], ['c', 'Third'], ['d', 'Fourth']]}),
            h(OptionsBox, {header: 'Compact options'},
                h(OptionGroup, {label: 'Selection'},
                    h(Layout, {id: 'compact', vertical: true, className: 'compact-list'}, ...checkables()),
                    h(Textbox, {ariaLabel: 'Compact text', defaultValue: 'Ag Text'}))),
            h(Layout, {id: 'narrow', horizontal: true},
                h(GroupBox, {header: 'Name'},
                    h(Textbox, {label: 'Name', defaultValue: 'Ag Text'}))),
        ]
    }
}

mountCapillaryUiApp(createCapillaryUiRuntime(), LineControlsApp, document.querySelector('#app')!)
