import {
    Button,
    Component,
    ListView,
    Panel,
    ProgressBar,
    RadioGroup,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {Change} from '../../model/types.js'
import {FeaturePlaceholder, ScreenHeading} from '../../components/shared.js'

interface PortfolioScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

const horizonOptions = [
    ['30', '30 days'],
    ['90', '90 days'],
    ['365', '1 year'],
] as const

export class PortfolioScreen extends Component<PortfolioScreenProps> {
    render(): FrayChild {
        const {model} = this.props
        const visible = this.read(model.visibleChanges)
        const selected = this.read(model.selectedChange)
        const completed = visible.filter((change) => change.statusFocus === 'completed').length
        const critical = visible.filter((change) => change.risk === 'Critical').length
        const completionMaximum = Math.max(visible.length, 1)
        const completionText = visible.length === 0
            ? 'No changes in scope'
            : `${completed} of ${visible.length} completed`

        return <div class="work-area portfolio-area">
            <ScreenHeading
                eyebrow="Portfolio"
                title="Current change portfolio"
                summary="Aggregate progress and attention for the shared organisational scope."
            />
            <div class="portfolio-summary-grid">
                <Panel header="Portfolio summary" disabled={live(model.panelDisabled)}>
                    <div class="metric-row">
                        <p><strong>{visible.length}</strong><span>Changes in scope</span></p>
                        <p><strong>{critical}</strong><span>Critical</span></p>
                        <p><strong>{completed}</strong><span>Completed</span></p>
                    </div>
                    <ProgressBar
                        label={`Completed changes: ${completionText}`}
                        value={completed}
                        max={completionMaximum}
                        valueText={completionText}
                    />
                </Panel>
                <Panel header="Planning horizon">
                    <RadioGroup
                        label="Include planned starts within"
                        valueEmitter={model.planningHorizon}
                        options={horizonOptions}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                        onChange={(days) => model.note(`Planning horizon → ${days} days`)}
                    />
                    <p class="supporting-copy">
                        The horizon changes Portfolio, Register, Change, and Analysis together.
                    </p>
                </Panel>
            </div>
            <div class="portfolio-detail-grid">
                <Panel
                    header="Attention queue"
                    toolbar={<Button
                        label="Refresh data"
                        busy={live(model.refreshing)}
                        busyLabel="Refreshing…"
                        onClick={() => model.refreshData()}
                    />}
                >
                    <ListView
                        className="attention-list"
                        label="Changes needing attention"
                        items={model.attentionChanges}
                        itemKey="id"
                        selectedItemEmitter={model.selectedChange}
                        placeholderCount={4}
                        renderItem={(change: Change) => <span class="attention-item">
                            <strong>{change.id}</strong>
                            <span>{change.title}</span>
                            <small>{change.risk}</small>
                        </span>}
                    />
                </Panel>
                <Panel header="Current selection">
                    {selected == null
                        ? <p>No change matches the current portfolio scope.</p>
                        : <div class="selected-change-callout">
                            <p class="eyebrow">{selected.id}</p>
                            <h3>{selected.title}</h3>
                            <p>{selected.status}</p>
                            <ProgressBar
                                label={`${selected.title}: ${selected.progress}% complete`}
                                value={selected.progress}
                                valueText={`${selected.progress}%`}
                            />
                        </div>}
                    <FeaturePlaceholder
                        compact={true}
                        feature="BlockGraph"
                        purpose="A compact portfolio distribution will appear here after approval."
                    />
                </Panel>
            </div>
        </div>
    }
}
