import {ColorPicker, Component, ThemePicker, live} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../model/MeridianModel.js'

interface AppHeaderProps extends ComponentProps {
    readonly model: MeridianModel
}

export class AppHeader extends Component<AppHeaderProps> {
    render(): FrayChild {
        const {model} = this.props
        return <header class="meridian-masthead island">
            <div>
                <p class="eyebrow">Meridian Change Office</p>
                <h1>Operational change management</h1>
                <p>Review and coordinate changes across the organisation.</p>
            </div>
            <fieldset class="appearance-controls">
                <legend>Appearance</legend>
                <ThemePicker
                    label="Theme"
                    valueEmitter={model.themeSelection}
                    disabled={live(model.forceDisabled)}
                    onChange={(theme) => model.note(`Theme → ${theme}`)}
                />
                <ColorPicker
                    label="Colour"
                    valueEmitter={model.colorSelection}
                    disabled={live(model.forceDisabled)}
                    onChange={(color) => model.note(`Colour → ${color}`)}
                />
            </fieldset>
        </header>
    }
}
