import {
    Component,
    Panel,
    RadioGroup,
    Toggle,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../model/MeridianModel.js'

interface ViewPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

const statusOptions = [
    ['all', 'All'],
    ['planned', 'Planned'],
    ['active', 'Active'],
    ['completed', 'Completed'],
] as const

const horizonOptions = [
    ['30', '30 days'],
    ['90', '90 days'],
    ['365', '1 year'],
] as const

export class ViewPanel extends Component<ViewPanelProps> {
    render(): FrayChild {
        const {model} = this.props
        return <Panel island className="meridian-view" header="View">
            <Toggle
                label="Status focus"
                valueEmitter={model.statusFocus}
                options={statusOptions}
                disabled={live(model.forceDisabled)}
                required={live(model.forceRequired)}
                error={live(model.statusFocusError)}
                onChange={(status) => model.note(`Status focus → ${status}`)}
            />
            <RadioGroup
                label="Planning horizon"
                valueEmitter={model.planningHorizon}
                options={horizonOptions}
                disabled={live(model.forceDisabled)}
                required={live(model.forceRequired)}
                onChange={(days) => model.note(`Planning horizon → ${days} days`)}
            />
        </Panel>
    }
}
