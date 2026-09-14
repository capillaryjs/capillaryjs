import {Component, routeTarget} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {Layout, NavigationBar} from '@capillaryjs/capillary-ui'

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
    render(): CapillaryUiChild {
        const model = this.props.model
        return <header class="gallery-masthead island">
            <Layout horizontal className="gallery-masthead-row">
                <h1>Capillary UI component gallery</h1>
                <NavigationBar
                    label="Gallery pages"
                    items={galleryPages.map((page) => ({
                        id: page.id,
                        label: page.label,
                        to: routeTarget(page.route),
                        exact: true,
                    }))}
                />
            </Layout>
            <GalleryToolbar model={model} />
        </header>
    }

    static dependencies = [Layout, NavigationBar, GalleryToolbar]
}
