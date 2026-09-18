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
    OptionGroup,
    OptionsBox,
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
                <Layout vertical context="control" className="gallery-control-demo gallery-filter-demo">
                    <GroupBox header="Filters">
                        <Textbox label="Search" placeholder="Filter"
                            {...this.flags()} />
                        <Dropdown label="Category" options={dropdownOptions}
                            {...this.flags()} />
                        <Checkbox label="Enabled" {...this.flags()} />
                    </GroupBox>
                </Layout>
                <Layout vertical context="control" className="gallery-control-demo">
                    <OptionsBox header="View options">
                        <RadioGroup label="Presentation" options={radioOptions} {...this.flags()} />
                    </OptionsBox>
                </Layout>
                <Layout vertical context="control" className="gallery-control-demo">
                    <OptionsBox header="Record options">
                        <OptionGroup label="Include">
                            <Checkbox label="Active records" {...this.flags()} />
                            <Checkbox label="Assigned to me" {...this.flags()} />
                            <Checkbox label="Needs review" {...this.flags()} />
                        </OptionGroup>
                    </OptionsBox>
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
                            <Toggle label="View" options={toggleOptions} {...this.flags()} />
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
        const model = this.props.model
        return <GroupBox id="gallery-checkboxes" header="Checkboxes" variant="section"
            className="gallery-section gallery-group-row">
                <GroupBox header="Checkbox" variant="column">
                    <Checkbox label="Unchecked" {...this.flags()} />
                    <Checkbox label="Checked"
                        initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                </GroupBox>
                <GroupBox header="TriCheckbox" variant="column">
                    <TriCheckbox label="Deny"
                        initialSemanticState={FilterMode.Deny} {...this.flags()} />
                    <TriCheckbox label="Neutral"
                        initialSemanticState={FilterMode.Neutral} {...this.flags()} />
                    <TriCheckbox label="Prefer"
                        initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                </GroupBox>
                <GroupBox header="QuadCheckbox" variant="column">
                    <QuadCheckbox label="Deny"
                        initialSemanticState={FilterMode.Deny} {...this.flags()} />
                    <QuadCheckbox label="Neutral"
                        initialSemanticState={FilterMode.Neutral} {...this.flags()} />
                    <QuadCheckbox label="Prefer"
                        initialSemanticState={FilterMode.Prefer} {...this.flags()} />
                    <QuadCheckbox label="Require"
                        initialSemanticState={FilterMode.Require} {...this.flags()} />
                </GroupBox>
                <GroupBox header="Textbox" variant="column">
                    <Textbox label="Empty" placeholder="Placeholder"
                             {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    <Textbox label="Filled" defaultValue="Ada Lovelace"
                             {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    <Textbox label="Long value"
                             defaultValue="A value long enough to overflow the available inline space"
                             {...this.flags()} readOnly={live(model.componentReadOnly)} />
                </GroupBox>
                <GroupBox header="Dropdown" variant="column">
                    <Dropdown label="Empty" options={dropdownOptions} defaultValue=""
                              {...this.flags()} />
                    <Dropdown label="Display mode" options={detailedDropdownOptions}
                              {...this.flags()} />
                    <Dropdown label="Choose a report presentation" options={detailedDropdownOptions}
                              {...this.flags()} />
                </GroupBox>
        </GroupBox>
    }

    private renderBasicRow(): CapillaryUiChild {
        const model = this.props.model
        return <GroupBox id="gallery-basic-inputs" header="Basic inputs" variant="section"
            className="gallery-section gallery-group-row">
                <GroupBox header="Textbox" variant="column">
                    <Textbox label="Empty" placeholder="Placeholder"
                        {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    <Textbox label="Filled" defaultValue="Ada Lovelace"
                        {...this.flags()} readOnly={live(model.componentReadOnly)} />
                    <Textbox label="Long value"
                        defaultValue="A value long enough to overflow the available inline space"
                        {...this.flags()} readOnly={live(model.componentReadOnly)} />
                </GroupBox>
                <GroupBox header="Dropdown" variant="column">
                    <Dropdown label="Empty" options={dropdownOptions} defaultValue=""
                        {...this.flags()} />
                    <Dropdown label="Display mode" options={detailedDropdownOptions}
                        {...this.flags()} />
                    <Dropdown label="Choose a report presentation" options={detailedDropdownOptions}
                        {...this.flags()} />
                </GroupBox>
                <GroupBox header="Toggle" variant="column">
                    <Toggle label="View" options={toggleOptions} {...this.flags()} />
                    <Toggle label="Density" options={detailedToggleOptions} {...this.flags()} />
                    <Toggle label="Choose the report presentation" options={detailedToggleOptions}
                        {...this.flags()} />
                </GroupBox>
                <GroupBox header="RadioGroup" variant="column">
                    <RadioGroup label="Size" options={radioOptions} {...this.flags()} />
                </GroupBox>
                <GroupBox header="Button" variant="column">
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
                </GroupBox>
                <GroupBox header="Progress" variant="column">
                    <ProgressBar label="Empty" valueEmitter={model.progressValues[0]!} />
                    <ProgressBar label="Partial" valueEmitter={model.progressValues[1]!} />
                    <ProgressBar label="Complete" valueEmitter={model.progressValues[2]!} />
                    <ProgressBar label="Indeterminate" valueEmitter={model.progressValues[3]!} />
                </GroupBox>
        </GroupBox>
    }

    private renderDateTimeRow(): CapillaryUiChild {
        const model = this.props.model
        return <GroupBox id="gallery-date-time" header="Date and time" variant="section"
            className="gallery-section gallery-group-row">
                <GroupBox header="DatePicker" variant="column">
                    <DatePicker label="Empty"
                        {...this.flags()}
                        readOnly={live(model.componentReadOnly)} />
                    <DatePicker label="Filled" defaultValue="2026-09-13"
                        {...this.flags()}
                        readOnly={live(model.componentReadOnly)} />
                </GroupBox>
                <GroupBox header="TimePicker" variant="column">
                    <TimePicker label="Empty" {...this.flags()} />
                    <TimePicker label="Filled" defaultValue="14:30"
                        {...this.flags()} />
                </GroupBox>
                <GroupBox header="DateTimePicker" variant="column">
                    <DateTimePicker label="Empty" {...this.flags()} />
                    <DateTimePicker label="Filled"
                        defaultValue="2026-09-13T14:30"
                        {...this.flags()} />
                </GroupBox>
        </GroupBox>
    }

    static dependencies = [
        Layout,
        Sidebar,
        Panel,
        PanelToolbar,
        Toolbar,
        GroupBox,
        OptionsBox,
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
