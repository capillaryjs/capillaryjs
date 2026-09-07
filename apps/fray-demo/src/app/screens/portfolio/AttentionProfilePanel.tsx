import {
    Component,
    Panel,
    QuadCheckbox,
    TriCheckbox,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface AttentionProfilePanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class AttentionProfilePanel extends Component<AttentionProfilePanelProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel island header="Attention profile">
            <div class="criteria-list" aria-label="Attention queue policy">
                <div class="criteria-row">
                    <TriCheckbox
                        label="Completed changes"
                        valueEmitter={model.attentionCompletedFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <span>Include, prioritise, or exclude completed changes.</span>
                </div>
                <div class="criteria-row">
                    <TriCheckbox
                        label="External supplier"
                        valueEmitter={model.attentionSupplierFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <span>Prioritise changes involving external suppliers.</span>
                </div>
                <div class="criteria-row">
                    <QuadCheckbox
                        label="Safety-related changes"
                        valueEmitter={model.attentionSafetyFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <span>Apply explicit safety-impact attention policy.</span>
                </div>
            </div>
        </Panel>
    }
}
