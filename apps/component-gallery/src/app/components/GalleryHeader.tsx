import {Component, routeTarget} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {Breadcrumb, NavigationBar, Toggle} from '@sylwellsoftware/fray'

import type {GalleryModel} from '../model/GalleryModel.js'
import {galleryPages} from '../routing.js'

export interface GalleryHeaderProps extends ComponentProps {
    model: GalleryModel
}

/** Island header: brand, routed page navbar, layout-variant toggle, breadcrumb. */
export class GalleryHeader extends Component<GalleryHeaderProps> {
    render(): FrayChild {
        const model = this.props.model
        const activeId = this.read(model.activePage)
        const activePage = galleryPages.find((page) => page.id === activeId)
            ?? galleryPages[0]!
        return <header class="gallery-masthead island">
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
            <Toggle
                label="Layout"
                valueEmitter={model.layoutVariant}
                options={[['shell', 'App shell'], ['website', 'Website']]}
            />
            <Breadcrumb
                items={[
                    {id: 'gallery', label: 'Gallery', to: routeTarget(galleryPages[0]!.route)},
                    {id: 'page', label: activePage.label},
                ]}
            />
        </header>
    }

    static dependencies = [NavigationBar, Toggle, Breadcrumb]
}
