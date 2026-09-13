import {Component} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import type {MeridianModel} from '../../model/MeridianModel.js'
import {AttentionProfilePanel} from './AttentionProfilePanel.js'
import {AttentionQueuePanel} from './AttentionQueuePanel.js'
import {CurrentSelectionPanel} from './CurrentSelectionPanel.js'
import {PortfolioSummaryPanel} from './PortfolioSummaryPanel.js'

interface PortfolioScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

export class PortfolioScreen extends Component<PortfolioScreenProps> {
    render(): CapillaryUiChild {
        const {model} = this.props
        return <div class="work-area portfolio-area">
            <PortfolioSummaryPanel key="summary" model={model} />
            <div class="portfolio-content-grid">
                <div class="attention-column">
                    <AttentionQueuePanel key="queue" model={model} />
                    <AttentionProfilePanel key="profile" model={model} />
                </div>
                <CurrentSelectionPanel key="selection" model={model} />
            </div>
        </div>
    }
}
