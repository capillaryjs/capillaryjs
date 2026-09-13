import {Component, routeTarget} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {NavigationBar} from '@sylwellsoftware/fray'

import type {GalleryModel} from '../model/GalleryModel.js'
import {galleryPages} from '../routing.js'
import {GalleryToolbar} from './GalleryToolbar.js'

export interface GalleryHeaderProps extends ComponentProps {
    model: GalleryModel
}

/**
 * Island header: brand and routed page navbar on the first row, and the
 * gallery control toolbar (layout, theme, data state, component state) on the
 * second row.
 */
export class GalleryHeader extends Component<GalleryHeaderProps> {
    render(): FrayChild {
        const model = this.props.model
        return <header class="gallery-masthead island">
            <div class="gallery-masthead-row">
                <h1>Fray component gallery</h1>
                <NavigationBar
                    label="Gallery pages"
                    items={galleryPages.map((page) => ({
                        id: page.id,
                        label: page.label,
                        to: routeTarget(page.route),
                        exact: true,
                    }))}
                />
            </div>
            <GalleryToolbar model={model} />
        </header>
    }

    static dependencies = [NavigationBar, GalleryToolbar]
}
