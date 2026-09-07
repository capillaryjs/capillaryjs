import {Component, SplitView} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../../model/MeridianModel.js'
import {ChangeRegisterPanel} from './ChangeRegisterPanel.js'
import {RegisterControlsPanel} from './RegisterControlsPanel.js'
import {RegisterCriteriaPanel} from './RegisterCriteriaPanel.js'
import {SelectedChangePanel} from './SelectedChangePanel.js'

interface RegisterScreenProps extends ComponentProps {
    readonly model: MeridianModel
}

export class RegisterScreen extends Component<RegisterScreenProps> {
    render(): FrayChild {
        const {model} = this.props
        return <div class="work-area register-area">
            <RegisterControlsPanel key="controls" model={model} />
            <RegisterCriteriaPanel key="criteria" model={model} />
            <SplitView
                key="results"
                className="register-results-split"
                primarySize="68%"
                primary={<ChangeRegisterPanel key="register" model={model} />}
                secondary={<SelectedChangePanel key="selection" model={model} />}
            />
        </div>
    }
}
