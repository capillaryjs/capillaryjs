import {Component, routeTarget} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {ColorPicker, Layout, NavigationBar, ThemePicker} from '@capillaryjs/capillary-ui'

import type {GalleryModel} from '../model/GalleryModel.js'
import {galleryPages} from '../routing.js'
import {GalleryToolbar} from './GalleryToolbar.js'

export interface GalleryHeaderProps extends ComponentProps {
    model: GalleryModel
}

/**
 * Island header: brand, routed page navbar, a dedicated appearance-control
 * area in the upper-right corner, and the gallery interaction toolbar.
 */
export class GalleryHeader extends Component<GalleryHeaderProps> {
    render(): CapillaryUiChild {
        const model = this.props.model
        return <header class="gallery-masthead island">
            <Layout horizontal className="gallery-masthead-row">
                <h1>Capillary UI component gallery</h1>
            </Layout>
            {/* This precedes the navbar in DOM order so the navbar and toolbar
                remain adjacent for theme sibling selectors. It is positioned
                independently on wide headers. */}
            <div class="gallery-appearance-controls" aria-label="Appearance controls">
                <ThemePicker label="Theme" valueEmitter={model.themeSelection} />
                <ColorPicker label="Colors" valueEmitter={model.colorSelection} />
            </div>
            <NavigationBar
                label="Gallery pages"
                items={galleryPages.map((page) => ({
                    id: page.id,
                    label: page.label,
                    to: routeTarget(page.route),
                    exact: true,
                }))}
            />
            <GalleryToolbar model={model} />
        </header>
    }

    static dependencies = [Layout, NavigationBar, ThemePicker, ColorPicker, GalleryToolbar]
}
