import {Component, FilterMode, live} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild, LiveBinding} from '@capillaryjs/capillary-ui'
import {
    Button,
    Checkbox,
    DatePicker,
    DateTimePicker,
    Dropdown,
    GroupBox,
    Layout,
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
} from '@capillaryjs/capillary-ui'

import type {GalleryModel} from '../model/GalleryModel.js'

export interface GalleryPageProps extends ComponentProps {
    model: GalleryModel
}

const dropdownOptions = [
    {value: 'alpha', label: 'Alpha'},
    {value: 'beta', label: 'Beta'},
    {value: 'gamma', label: 'Gamma'},
] as const

const detailedDropdownOptions = [
    {value: 'compact', label: 'Compact summary'},
    {value: 'standard', label: 'Standard operational overview'},
    {value: 'extended', label: 'Extended analysis with supporting detail'},
] as const

const toggleOptions = [
    ['list', 'List'],
    ['grid', 'Grid'],
] as const

const detailedToggleOptions = [
    ['summary', 'Summary'],
    ['detailed', 'Detailed analysis'],
    ['export', 'Export-ready report'],
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
 * outliers are visible at a glance. The Panel's vertical body stacks section
 * GroupBoxes; each section owns a horizontal row of control GroupBoxes, whose
 * Layout bodies stack control variants vertically.
 */
export class LineInputsPage extends Component<GalleryPageProps> {
    render(): CapillaryUiChild {
        const model = this.props.model
        const data = this.snapshot(model.dataItems)
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
                <Layout vertical context="control" className="gallery-control-demo">
                    <GroupBox header="Filters">
                        <Layout vertical className="gallery-state-column">
                            <Textbox label="Search" placeholder="Filter"
                                {...this.flags()} />
                            <Dropdown label="Category" options={dropdownOptions}
                                {...this.flags()} />
                            <Checkbox label="Enabled" {...this.flags()} />
                        </Layout>
                    </GroupBox>
                </Layout>
                <p class="gallery-data-state" role="status">
                    Data state: {data.fetchState}
                    {data.error == null ? '' : ` — ${String(data.error)}`}
                </p>
            </Sidebar>
            <Layout vertical allocation="flexible" scroll className="gallery-main">
                <Panel island header="Line inputs" id="gallery-line-inputs" context="form">
                    <PanelToolbar>
                        <Toolbar label="Line input toolbar">
                            <Checkbox label="Checkbox" {...this.flags()} />
                            <TriCheckbox label="Tri" {...this.flags()} />
                            <QuadCheckbox label="Quad" {...this.flags()} />
                            <Textbox label="Name" placeholder="Text"
                                {...this.flags()} readOnly={live(model.componentReadOnly)} />
                            <Dropdown label="Choice" options={dropdownOptions} {...this.flags()} />
                            <Button label="Action"
                                disabled={live(model.componentDisabled)}
                                busy={live(model.componentBusy)}
                                error={live(model.componentError)} />
                            <DatePicker label="Date"
                                {...this.flags()} readOnly={live(model.componentReadOnly)} />
                            <TimePicker label="Time" {...this.flags()} />
                        </Toolbar>
                    </PanelToolbar>
                    {this.renderCheckboxRow()}
                    {this.renderBasicRow()}
                    {this.renderDateTimeRow()}
                </Panel>
            </Layout>
        </Layout>
    }

    /** Shared flag bindings applied to every showcased control. */
    private flags(): {
        disabled: LiveBinding<boolean>
        required: LiveBinding<boolean>
        busy: LiveBinding<boolean>
        error: LiveBinding<string | null>
    } {
        const model = this.props.model
        return {
            disabled: live(model.componentDisabled),
            required: live(model.componentRequired),
            busy: live(model.componentBusy),
            error: live(model.componentError),
        }
    }

    private renderCheckboxRow(): CapillaryUiChild {
        return <GroupBox id="gallery-checkboxes" header="Checkboxes" variant="section"
            className="gallery-section">
            <Layout horizontal className="gallery-group-row">
                <GroupBox header="Checkbox" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <Checkbox label="Unchecked" {...this.flags()} />
                        <Checkbox label="Checked"
                            initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                    </Layout>
                </GroupBox>
                <GroupBox header="TriCheckbox" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <TriCheckbox label="Deny"
                            initialSemanticState={FilterMode.Deny} {...this.flags()} />
                        <TriCheckbox label="Neutral"
                            initialSemanticState={FilterMode.Neutral} {...this.flags()} />
                        <TriCheckbox label="Prefer"
                            initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                    </Layout>
                </GroupBox>
                <GroupBox header="QuadCheckbox" variant="column">
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
                </GroupBox>
            </Layout>
        </GroupBox>
    }

    private renderBasicRow(): CapillaryUiChild {
        const model = this.props.model
        return <GroupBox id="gallery-basic-inputs" header="Basic inputs" variant="section"
            className="gallery-section">
            <Layout horizontal className="gallery-group-row">
                <GroupBox header="Textbox" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <Textbox label="Empty" placeholder="Placeholder"
                            {...this.flags()} readOnly={live(model.componentReadOnly)} />
                        <Textbox label="Filled" defaultValue="Ada Lovelace"
                            {...this.flags()} readOnly={live(model.componentReadOnly)} />
                        <Textbox label="Long value"
                            defaultValue="A value long enough to overflow the available inline space"
                            {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    </Layout>
                </GroupBox>
                <GroupBox header="Dropdown" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <Dropdown label="Empty" options={dropdownOptions} defaultValue=""
                            {...this.flags()} />
                        <Dropdown label="Display mode" options={detailedDropdownOptions}
                            {...this.flags()} />
                        <Dropdown label="Choose a report presentation" options={detailedDropdownOptions}
                            {...this.flags()} />
                    </Layout>
                </GroupBox>
                <GroupBox header="Toggle" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <Toggle label="View" options={toggleOptions} {...this.flags()} />
                        <Toggle label="Density" options={detailedToggleOptions} {...this.flags()} />
                        <Toggle label="Choose the report presentation" options={detailedToggleOptions}
                            {...this.flags()} />
                    </Layout>
                </GroupBox>
                <GroupBox header="RadioGroup" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <RadioGroup label="Size" options={radioOptions} {...this.flags()} />
                    </Layout>
                </GroupBox>
                <GroupBox header="Button" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <Button label="Normal"
                            disabled={live(model.componentDisabled)}
                            busy={live(model.componentBusy)}
                            error={live(model.componentError)} />
                        <Button label="Pressed" pressed
                            disabled={live(model.componentDisabled)}
                            busy={live(model.componentBusy)}
                            error={live(model.componentError)} />
                        <Button label="Busy" busy busyLabel="Working…"
                            disabled={live(model.componentDisabled)}
                            error={live(model.componentError)} />
                    </Layout>
                </GroupBox>
                <GroupBox header="Progress" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <ProgressBar label="Empty" value={0} />
                        <ProgressBar label="Partial" value={40} />
                        <ProgressBar label="Complete" value={100} />
                        <ProgressBar label="Indeterminate" value={null} />
                    </Layout>
                </GroupBox>
            </Layout>
        </GroupBox>
    }

    private renderDateTimeRow(): CapillaryUiChild {
        const model = this.props.model
        return <GroupBox id="gallery-date-time" header="Date and time" variant="section"
            className="gallery-section">
            <Layout horizontal className="gallery-group-row">
                <GroupBox header="DatePicker" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <DatePicker label="Empty"
                            {...this.flags()}
                            readOnly={live(model.componentReadOnly)} />
                        <DatePicker label="Filled" defaultValue="2026-09-13"
                            {...this.flags()}
                            readOnly={live(model.componentReadOnly)} />
                    </Layout>
                </GroupBox>
                <GroupBox header="TimePicker" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <TimePicker label="Empty" {...this.flags()} />
                        <TimePicker label="Filled" defaultValue="14:30"
                            {...this.flags()} />
                    </Layout>
                </GroupBox>
                <GroupBox header="DateTimePicker" variant="column">
                    <Layout vertical className="gallery-state-column">
                        <DateTimePicker label="Empty" {...this.flags()} />
                        <DateTimePicker label="Filled"
                            defaultValue="2026-09-13T14:30"
                            {...this.flags()} />
                    </Layout>
                </GroupBox>
            </Layout>
        </GroupBox>
    }

    static dependencies = [
        Layout,
        Sidebar,
        Panel,
        PanelToolbar,
        Toolbar,
        GroupBox,
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
