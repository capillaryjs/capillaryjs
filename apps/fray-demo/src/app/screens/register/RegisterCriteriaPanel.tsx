import {Component, Panel, QuadCheckbox, live} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface RegisterCriteriaPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class RegisterCriteriaPanel extends Component<RegisterCriteriaPanelProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel island className="register-criteria" header="Register criteria">
            <div class="criteria-list" aria-label="Register semantic criteria">
                <div class="criteria-row">
                    <QuadCheckbox
                        label="Needs approval"
                        valueEmitter={model.registerApprovalFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <span>Prioritise or require changes that still need approval.</span>
                </div>
                <div class="criteria-row">
                    <QuadCheckbox
                        label="High or critical risk"
                        valueEmitter={model.registerHighRiskFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <span>Apply one semantic policy to the two highest risk levels.</span>
                </div>
                <div class="criteria-row">
                    <QuadCheckbox
                        label="External supplier"
                        valueEmitter={model.registerSupplierFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <span>Include, prioritise, require, or exclude supplier involvement.</span>
                </div>
                <div class="criteria-row">
                    <QuadCheckbox
                        label="Already completed"
                        valueEmitter={model.registerCompletedFocus}
                        disabled={live(model.forceDisabled)}
                        required={live(model.forceRequired)}
                    />
                    <span>Control how completed records participate in Register.</span>
                </div>
            </div>
        </Panel>
    }
}
