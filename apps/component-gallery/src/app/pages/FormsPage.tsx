import {Component} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
import {
    Button,
    Checkbox,
    DataTable,
    DatePicker,
    DateTimePicker,
    DescriptionItem,
    DescriptionList,
    Dialog,
    DialogActions,
    Dropdown,
    Layout,
    OptionGroup,
    OptionsPanel,
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

import {serviceOwners} from '../model/data.js'
import type {GalleryModel} from '../model/GalleryModel.js'
import type {GalleryPageProps} from './DataGridPage.js'
import {submissionColumns} from './serviceColumns.js'

/** Line-input gallery: OptionsPanel sidebar, control panel, submissions table. */
export class FormsPage extends Component<GalleryPageProps> {
    render(): FrayChild {
        const model = this.props.model
        const disabled = this.read(model.formDisabled)
        const required = this.read(model.formRequired)
        const error = this.read(model.formError)
        const progress = this.read(model.formProgress)
        const submitBlocked = this.read(model.formSubmitBlocked)
        return <Layout horizontal allocation="flexible" className="gallery-page">
            <Sidebar island header="Control state" className="gallery-sidebar">
                <OptionsPanel header="State">
                    <OptionGroup label="Inputs">
                        <label>
                            <input type="checkbox" bind:checked={model.formDisabled} />
                            Disabled
                        </label>
                        <label>
                            <input type="checkbox" bind:checked={model.formRequired} />
                            Required
                        </label>
                        <label>
                            <input type="checkbox" bind:checked={model.formErrorFlag} />
                            Show error
                        </label>
                    </OptionGroup>
                    <OptionGroup label="Semantics">
                        <TriCheckbox label="Tri-state" valueEmitter={model.formSemantics} />
                        <QuadCheckbox label="Quad-state" valueEmitter={model.formApproval} />
                    </OptionGroup>
                </OptionsPanel>
            </Sidebar>
            <Layout vertical allocation="flexible" className="gallery-main">
                <Panel island header="Record editor" scroll={false}>
                    <PanelToolbar>
                        <Toolbar label="Form actions">
                            <Button
                                label="Preview…"
                                onClick={() =>
                                    model.formDialogOpen.set(true, 'preview opened')}
                            />
                            <Button
                                label="Submit"
                                disabled={submitBlocked}
                                onClick={() => model.submitForm()}
                            />
                        </Toolbar>
                    </PanelToolbar>
                    <div class="gallery-form-grid">
                        <Textbox
                            label="Name"
                            valueEmitter={model.formName}
                            disabled={disabled}
                            required={required}
                            error={error}
                        />
                        <Dropdown
                            label="Owner"
                            valueEmitter={model.formOwner}
                            disabled={disabled}
                            options={serviceOwners.map((owner) => ({
                                value: owner,
                                label: owner,
                            }))}
                        />
                        <Toggle
                            label="Tier"
                            valueEmitter={model.formTier}
                            options={[
                                ['Critical', 'Critical'],
                                ['Standard', 'Standard'],
                                ['Experimental', 'Experimental'],
                            ]}
                        />
                        <RadioGroup
                            label="Status"
                            valueEmitter={model.formStatus}
                            options={[
                                ['Ready', 'Ready'],
                                ['Review', 'Review'],
                                ['Attention', 'Attention'],
                            ]}
                        />
                        <Checkbox
                            label="Active"
                            valueEmitter={model.formActive}
                            symbols={[['☐', 'inactive'], ['✓', 'active']]}
                            disabled={disabled}
                        />
                        <DatePicker
                            label="Launch"
                            valueEmitter={model.formDate}
                            disabled={disabled}
                            required={required}
                            min="2026-07-01"
                            max="2026-12-31"
                        />
                        <TimePicker
                            label="Window"
                            valueEmitter={model.formTime}
                            disabled={disabled}
                            step={30}
                        />
                        <DateTimePicker
                            label="Maintenance"
                            valueEmitter={model.formDateTime}
                            disabled={disabled}
                        />
                        <ProgressBar
                            label="Readiness"
                            value={progress}
                            valueText={`${progress}%`}
                        />
                        <Button label="−10%" onClick={() => model.adjustProgress(-10)} />
                        <Button label="+10%" onClick={() => model.adjustProgress(10)} />
                        <label>
                            <input type="checkbox" bind:checked={model.formCanSubmit} />
                            Ready to submit
                        </label>
                    </div>
                    <Dialog
                        title="Submission preview"
                        description="Review the record before submitting."
                        valueEmitter={model.formDialogOpen}
                    >
                        <DescriptionList label="Submission preview">
                            <DescriptionItem term="Name" value={this.read(model.formName)} />
                            <DescriptionItem term="Owner" value={this.read(model.formOwner)} />
                            <DescriptionItem term="Tier" value={this.read(model.formTier)} />
                            <DescriptionItem term="Status" value={this.read(model.formStatus)} />
                            <DescriptionItem
                                term="Active"
                                value={this.read(model.formActive)}
                            />
                            <DescriptionItem
                                term="Launch"
                                value={this.read(model.formDate) ?? 'unscheduled'}
                            />
                            <DescriptionItem
                                term="Readiness"
                                value={`${progress}%`}
                            />
                        </DescriptionList>
                        <DialogActions>
                            <Button
                                label="Submit"
                                disabled={submitBlocked}
                                onClick={() => {
                                    model.submitForm()
                                    model.formDialogOpen.set(false, 'submitted')
                                }}
                            />
                            <Button
                                label="Cancel"
                                onClick={() =>
                                    model.formDialogOpen.set(false, 'preview cancelled')}
                            />
                        </DialogActions>
                    </Dialog>
                </Panel>
                <Panel island header="Submissions" allocation="flexible">
                    <DataTable
                        dataSource={model.submissionsTable}
                        rowKey="id"
                        caption="Submitted records"
                        emptyMessage="No submissions yet"
                        columns={submissionColumns}
                    />
                </Panel>
            </Layout>
        </Layout>
    }

    static dependencies = [
        Layout,
        Sidebar,
        OptionsPanel,
        OptionGroup,
        Panel,
        PanelToolbar,
        Toolbar,
        Button,
        Textbox,
        Dropdown,
        Toggle,
        RadioGroup,
        Checkbox,
        TriCheckbox,
        QuadCheckbox,
        DatePicker,
        TimePicker,
        DateTimePicker,
        ProgressBar,
        Dialog,
        DialogActions,
        DescriptionList,
        DescriptionItem,
        DataTable,
    ]
}
