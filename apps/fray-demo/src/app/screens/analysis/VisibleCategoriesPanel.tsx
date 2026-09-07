import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {CategoryHidePanel} from '@sylwellsoftware/fray-visualization'
import type {MeridianModel} from '../../model/MeridianModel.js'

interface VisibleCategoriesPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class VisibleCategoriesPanel extends Component<VisibleCategoriesPanelProps> {
    render(): FrayChild {
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
