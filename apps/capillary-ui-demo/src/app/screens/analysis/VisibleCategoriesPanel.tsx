import {Component} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {CategoryHidePanel} from '@capillaryjs/capillary-viz'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface VisibleCategoriesPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class VisibleCategoriesPanel extends Component<VisibleCategoriesPanelProps> {
    render(): CapillaryUiChild {
        const {model} = this.props
        return <CategoryHidePanel
            island
            className="visible-categories-panel"
            items$={model.scopedChanges}
            criteria={model.groupingCriteria}
            label="Visible categories"
            description="Hide a category from both analytical views. Counts remain unfiltered."
        />
    }
}
