import {Component, Panel, PanelToolbar, Toolbar} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {LineGraph} from '@capillaryjs/capillary-viz'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface ChangeHistoryProps extends ComponentProps {
    readonly model: MeridianModel
}

export class ChangeHistory extends Component<ChangeHistoryProps> {
    render(): CapillaryUiChild {
        const {model} = this.props
        return <Panel
            island
            className="history-panel"
            header="Change history"
        >
            <PanelToolbar><Toolbar label="Chart presentation" className="history-options">
                <label>
                    <input type="checkbox" bind:checked={model.historyStacked} />
                    Stacked areas
                </label>
                <label>
                    <input type="checkbox" bind:checked={model.historySmooth} />
                    Smooth curves
                </label>
            </Toolbar></PanelToolbar>
            <LineGraph
                shapes$={model.historyShapes}
                stacked$={model.historyStacked}
                smooth$={model.historySmooth}
                range$={model.historyRange}
                label="Changes in flight by risk"
                formatValue={(value) => `${value} change${value === 1 ? '' : 's'}`}
            />
        </Panel>
    }
}
