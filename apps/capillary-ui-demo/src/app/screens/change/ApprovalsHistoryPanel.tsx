import {Component, Panel} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {FeaturePlaceholder} from '../../components/shared.js'

interface ApprovalsHistoryPanelProps extends ComponentProps {
    readonly changeId: string
}

export class ApprovalsHistoryPanel extends Component<ApprovalsHistoryPanelProps> {
    render(): CapillaryUiChild {
        const {changeId} = this.props
        return <Panel island className="approvals-history-panel" header="Approvals and history">
            <section aria-labelledby="approvals-heading">
                <h3 id="approvals-heading">Approvals</h3>
                <FeaturePlaceholder
                    compact
                    feature="Approval workflow"
                    purpose={`Approval records for ${changeId} require a future data contract.`}
                />
            </section>
            <section aria-labelledby="change-history-heading">
                <h3 id="change-history-heading">Change history</h3>
                <FeaturePlaceholder
                    compact
                    feature="History table"
                    purpose={`Audit history for ${changeId} requires a future data contract.`}
                />
            </section>
        </Panel>
    }
}
