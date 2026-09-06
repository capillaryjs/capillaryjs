import {Component, TabPanel} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import type {MeridianModel} from '../model/MeridianModel.js'
import {meridianRoutes} from '../routing.js'
import {AnalysisScreen} from '../screens/analysis/AnalysisScreen.js'
import {ChangeScreen} from '../screens/change/ChangeScreen.js'
import {PortfolioScreen} from '../screens/portfolio/PortfolioScreen.js'
import {RegisterScreen} from '../screens/register/RegisterScreen.js'

interface WorkAreaProps extends ComponentProps {
    readonly model: MeridianModel
}

export class WorkArea extends Component<WorkAreaProps> {
    render(): FrayChild {
        const {model} = this.props
        return <section class="meridian-workspace" aria-label="Change management work area">
            <TabPanel
                id="meridian-work-area"
                label="Change management work areas"
                valueEmitter={model.activeArea}
                onChange={(area) => model.note(`Work area → ${String(area)}`)}
                tabs={[
                    {
                        id: 'portfolio',
                        label: 'Portfolio',
                        route: meridianRoutes.portfolio,
                        content: <PortfolioScreen key="portfolio" model={model} />,
                    },
                    {
                        id: 'register',
                        label: 'Register',
                        route: meridianRoutes.register,
                        content: <RegisterScreen key="register" model={model} />,
                    },
                    {
                        id: 'change',
                        label: 'Change',
                        route: meridianRoutes.change,
                        content: <ChangeScreen key="change" model={model} />,
                    },
                    {
                        id: 'analysis',
                        label: 'Analysis',
                        route: meridianRoutes.analysis,
                        content: <AnalysisScreen key="analysis" model={model} />,
                    },
                ]}
            />
        </section>
    }
}
