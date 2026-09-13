import {Component, FilterMode, live} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild, LiveBinding} from '@sylwellsoftware/fray'
import {
    Button,
    Checkbox,
    DatePicker,
    DateTimePicker,
    Dropdown,
    Layout,
    OptionGroup,
    Panel,
    PanelToolbar,
    ProgressBar,
    QuadCheckbox,
    RadioGroup,
    Sidebar,
    Textbox,
    TimePicker,
    Toggle,
    Toolbar,
    TriCheckbox,
} from '@sylwellsoftware/fray'

import type {GalleryModel} from '../model/GalleryModel.js'

export interface GalleryPageProps extends ComponentProps {
    model: GalleryModel
}

const dropdownOptions = [
    {value: 'alpha', label: 'Alpha'},
    {value: 'beta', label: 'Beta'},
    {value: 'gamma', label: 'Gamma'},
] as const

const toggleOptions = [
    ['list', 'List'],
    ['grid', 'Grid'],
] as const

const radioOptions = [
    ['small', 'Small'],
    ['medium', 'Medium'],
    ['large', 'Large'],
] as const

/**
 * Line-input gallery: one instance per control and intrinsic state, every
 * flag-capable prop bound to the shared toolbar emitters. Toggling a header
 * flag makes that state the uniform expectation across the page, so themed
 * outliers are visible at a glance. Each OptionGroup stacks its variants
 * vertically; groups flow side by side and wrap within the panel.
 */
export class LineInputsPage extends Component<GalleryPageProps> {
    render(): FrayChild {
        const model = this.props.model
        const data = this.snapshot(model.dataSource)
        return <Layout horizontal allocation="flexible" className="gallery-page">
            <Sidebar island header="Sections" className="gallery-sidebar">
                <nav class="gallery-section-nav" aria-label="Line input sections">
                    <Button label="Checkboxes"
                        onClick={() => scrollToSection('gallery-checkboxes')} />
                    <Button label="Basic inputs"
                        onClick={() => scrollToSection('gallery-basic-inputs')} />
                    <Button label="Date and time"
                        onClick={() => scrollToSection('gallery-date-time')} />
                </nav>
                <p class="gallery-data-state" role="status">
                    Data state: {data.fetchState}
                    {data.error == null ? '' : ` — ${String(data.error)}`}
                </p>
            </Sidebar>
            <Layout vertical allocation="flexible" scroll className="gallery-main">
                {this.renderCheckboxPanel()}
                {this.renderBasicPanel()}
                {this.renderDateTimePanel()}
            </Layout>
        </Layout>
    }

    /** Shared flag bindings applied to every showcased control. */
    private flags(): {
        disabled: LiveBinding<boolean>
        required: LiveBinding<boolean>
        error: LiveBinding<string | null>
    } {
        const model = this.props.model
        return {
            disabled: live(model.componentDisabled),
            required: live(model.componentRequired),
            error: live(model.componentError),
        }
    }

    private renderCheckboxPanel(): FrayChild {
        return <Panel island header="Checkboxes" id="gallery-checkboxes">
            <PanelToolbar>
                <Toolbar label="Checkbox toolbar">
                    <Checkbox label="Checkbox" {...this.flags()} />
                    <TriCheckbox label="Tri" {...this.flags()} />
                    <QuadCheckbox label="Quad" {...this.flags()} />
                </Toolbar>
            </PanelToolbar>
            <Layout horizontal className="gallery-group-row">
                <OptionGroup label="Checkbox">
                    <Layout vertical className="gallery-state-column">
                        <Checkbox label="Unchecked" {...this.flags()} />
                        <Checkbox label="Checked"
                            initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                    </Layout>
                </OptionGroup>
                <OptionGroup label="TriCheckbox">
                    <Layout vertical className="gallery-state-column">
                        <TriCheckbox label="Deny"
                            initialSemanticState={FilterMode.Deny} {...this.flags()} />
                        <TriCheckbox label="Neutral"
                            initialSemanticState={FilterMode.Neutral} {...this.flags()} />
                        <TriCheckbox label="Prefer"
                            initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                    </Layout>
                </OptionGroup>
                <OptionGroup label="QuadCheckbox">
                    <Layout vertical className="gallery-state-column">
                        <QuadCheckbox label="Deny"
                            initialSemanticState={FilterMode.Deny} {...this.flags()} />
                        <QuadCheckbox label="Neutral"
                            initialSemanticState={FilterMode.Neutral} {...this.flags()} />
                        <QuadCheckbox label="Prefer"
                            initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                        <QuadCheckbox label="Require"
                            initialSemanticState={FilterMode.Require} {...this.flags()} />
                    </Layout>
                </OptionGroup>
            </Layout>
        </Panel>
    }

    private renderBasicPanel(): FrayChild {
        const model = this.props.model
        return <Panel island header="Basic inputs" id="gallery-basic-inputs">
            <PanelToolbar>
                <Toolbar label="Basic input toolbar">
                    <Textbox label="Name" placeholder="Text"
                        {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    <Dropdown label="Choice" options={dropdownOptions} {...this.flags()} />
                    <Button label="Action" disabled={live(model.componentDisabled)} />
                </Toolbar>
            </PanelToolbar>
            <Layout horizontal className="gallery-group-row">
                <OptionGroup label="Textbox">
                    <Layout vertical className="gallery-state-column">
                        <Textbox label="Empty" placeholder="Placeholder"
                            {...this.flags()} readOnly={live(model.componentReadOnly)} />
                        <Textbox label="Filled" defaultValue="Ada Lovelace"
                            {...this.flags()} readOnly={live(model.componentReadOnly)} />
                        <Textbox label="Long value"
                            defaultValue="A value long enough to overflow the available inline space"
                            {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    </Layout>
                </OptionGroup>
                <Layout vertical className="gallery-state-column">
                    <Dropdown label="Choice" options={dropdownOptions}
                        {...this.flags()} />
                    <Toggle label="View" options={toggleOptions} {...this.flags()} />
                    <RadioGroup label="Size" options={radioOptions} {...this.flags()} />
                </Layout>
                <OptionGroup label="Button">
                    <Layout vertical className="gallery-state-column">
                        <Button label="Normal" disabled={live(model.componentDisabled)} />
                        <Button label="Pressed" pressed
                            disabled={live(model.componentDisabled)} />
                        <Button label="Busy" busy busyLabel="Working…"
                            disabled={live(model.componentDisabled)} />
                    </Layout>
                </OptionGroup>
                <OptionGroup label="Progress">
                    <Layout vertical className="gallery-state-column">
                        <ProgressBar label="Empty" value={0} />
                        <ProgressBar label="Partial" value={40} />
                        <ProgressBar label="Complete" value={100} />
                        <ProgressBar label="Indeterminate" value={null} />
                    </Layout>
                </OptionGroup>
            </Layout>
        </Panel>
    }

    private renderDateTimePanel(): FrayChild {
        const model = this.props.model
        return <Panel island header="Date and time" id="gallery-date-time">
            <PanelToolbar>
                <Toolbar label="Date and time toolbar">
                    <DatePicker label="Date"
                        {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    <TimePicker label="Time" {...this.flags()} />
                </Toolbar>
            </PanelToolbar>
            <Layout horizontal className="gallery-group-row">
                <OptionGroup label="DatePicker">
                    <Layout vertical className="gallery-state-column">
                        <DatePicker label="Empty"
                            {...this.flags()}
                            readOnly={live(model.componentReadOnly)} />
                        <DatePicker label="Filled" defaultValue="2026-09-13"
                            {...this.flags()}
                            readOnly={live(model.componentReadOnly)} />
                    </Layout>
                </OptionGroup>
                <OptionGroup label="TimePicker">
                    <Layout vertical className="gallery-state-column">
                        <TimePicker label="Empty" {...this.flags()} />
                        <TimePicker label="Filled" defaultValue="14:30"
                            {...this.flags()} />
                    </Layout>
                </OptionGroup>
                <OptionGroup label="DateTimePicker">
                    <Layout vertical className="gallery-state-column">
                        <DateTimePicker label="Empty" {...this.flags()} />
                        <DateTimePicker label="Filled"
                            defaultValue={{date: '2026-09-13', time: '14:30'}}
                            {...this.flags()} />
                    </Layout>
                </OptionGroup>
            </Layout>
        </Panel>
    }

    static dependencies = [
        Layout,
        Sidebar,
        Panel,
        PanelToolbar,
        Toolbar,
        OptionGroup,
        Button,
        Checkbox,
        TriCheckbox,
        QuadCheckbox,
        Textbox,
        Dropdown,
        Toggle,
        RadioGroup,
        ProgressBar,
        DatePicker,
        TimePicker,
        DateTimePicker,
    ]
}

function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({block: 'start'})
}
