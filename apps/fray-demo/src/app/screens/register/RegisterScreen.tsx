import {
    Button,
    Checkbox,
    Component,
    DataTable,
    Dropdown,
    FilterMode,
    FilterPanel,
    Panel,
    QuadCheckbox,
    SplitView,
    Textbox,
    Toolbar,
    TriCheckbox,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {AttentionFilter, Change} from '../../model/types.js'
import {ScreenHeading} from '../../components/shared.js'

interface RegisterScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

const advancedRiskModes = [
    ['☐', FilterMode.Neutral],
    ['✓', FilterMode.Prefer],
    ['+', FilterMode.Require],
    ['×', FilterMode.Deny],
] as const

const attentionSymbols: readonly [FrayChild, AttentionFilter][] = [
    ['☐', 'all'],
    ['✓', 'attention'],
]

export class RegisterScreen extends Component<RegisterScreenProps> {
    render(): FrayChild {
        const {model} = this.props
        const selected = this.read(model.selectedChange)
        const advancedOpen = this.read(model.advancedRiskFiltersOpen)
        const advancedFilters = this.read(model.advancedRiskFilters)
        return <div class="work-area register-area">
            <ScreenHeading
                eyebrow="Register"
                title="Change register"
                summary="Search, prioritise, filter, sort, and select the operational record set."
            />
            <Panel
                island
                className="register-controls"
                header="Register controls"
                toolbar={<Toolbar label="Register actions">
                    <Button
                        label="Reset filters"
                        disabled={live(model.forceDisabled)}
                        onClick={() => model.clearRegisterFilters()}
                    />
                    <Button
                        label="Select next critical"
                        disabled={live(model.forceDisabled)}
                        onClick={() => model.selectNextCritical()}
                    />
                    <Button
                        label="Refresh data"
                        busy={live(model.refreshing)}
                        busyLabel="Refreshing…"
                        onClick={() => model.refreshData()}
                    />
                </Toolbar>}
            >
                <div class="register-filter-grid">
                    <Textbox
                        label="Search changes"
                        type="search"
                        placeholder="ID, title, summary, or owner"
                        autoComplete="off"
                        inputMode="search"
                        valueEmitter={model.registerSearch}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                        onInput={(value) => model.note(`Search → ${value || 'empty'}`)}
                    />
                    <Dropdown
                        label="Risk focus"
                        valueEmitter={model.riskFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                        options={[
                            {value: 'all', label: 'All risks'},
                            {value: 'Critical', label: 'Critical'},
                            {value: 'High', label: 'High'},
                            {value: 'Medium', label: 'Medium'},
                            {value: 'Low', label: 'Low'},
                        ]}
                        onChange={(risk) => model.note(`Risk focus → ${risk}`)}
                    />
                    <Checkbox
                        label="Needs attention only"
                        valueEmitter={model.attentionOnly}
                        symbols={attentionSymbols}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                        onChange={(value) => model.note(`Attention filter → ${value}`)}
                    />
                </div>
                <div class="semantic-filter-row" aria-label="Semantic preferences">
                    <TriCheckbox
                        label="External supplier"
                        valueEmitter={model.supplierFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <TriCheckbox
                        label="Completed changes"
                        valueEmitter={model.completedFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <QuadCheckbox
                        label="Safety impact"
                        valueEmitter={model.safetyFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <section class="advanced-risk-filter" aria-label="Advanced risk filters">
                        <Button
                            label="Advanced risk"
                            pressed={advancedOpen}
                            disabled={live(model.forceDisabled)}
                            onClick={() => model.advancedRiskFiltersOpen.set(
                                !advancedOpen,
                                'advanced risk filters toggled',
                            )}
                        />
                        {advancedOpen
                            ? <FilterPanel
                                label="Advanced risk filters"
                                options={['Low', 'Medium', 'High', 'Critical']}
                                filters={advancedFilters}
                                filterModes={advancedRiskModes}
                                onChange={(filters) =>
                                    model.replaceAdvancedRiskFilters(filters)}
                            />
                            : null}
                    </section>
                </div>
            </Panel>
            <SplitView
                island
                className="meridian-register"
                primarySize="68%"
                primaryLabel="Change register table"
                secondaryLabel="Selected change preview"
                primary={<DataTable
                    dataSource={model.changeTable}
                    rowKey="id"
                    caption="Changes in selected scope"
                    emptyMessage="No changes match the current filters."
                    selectedItemEmitter={model.selectedChange}
                    columns={[
                        {field: 'id', label: 'ID', sortable: true},
                        {field: 'title', label: 'Change', sortable: true},
                        {field: 'site', label: 'Site', sortable: true},
                        {
                            field: 'risk',
                            label: 'Risk',
                            sortable: true,
                            filterOptions: ['Low', 'Medium', 'High', 'Critical'],
                        },
                        {field: 'status', label: 'Status', sortable: true},
                        {field: 'progress', label: 'Progress', sortable: true},
                    ]}
                />}
                secondary={<Panel header="Selected change preview">
                    {selected == null ? <p>No change selected.</p> : <>
                        <p class="eyebrow">{selected.id}</p>
                        <h3>{selected.title}</h3>
                        <p>{selected.summary}</p>
                        <dl class="compact-facts">
                            <div><dt>Risk</dt><dd>{selected.risk}</dd></div>
                            <div><dt>Status</dt><dd>{selected.status}</dd></div>
                            <div><dt>Owner</dt><dd>{selected.owner}</dd></div>
                        </dl>
                    </>}
                </Panel>}
            />
        </div>
    }
}
