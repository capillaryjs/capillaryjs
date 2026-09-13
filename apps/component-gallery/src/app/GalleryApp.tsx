import {Component} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
import {FrayApp, NavigationBar, RouteOutlet, Toggle} from '@sylwellsoftware/fray'

import {GalleryFooter} from './components/GalleryFooter.js'
import {GalleryHeader} from './components/GalleryHeader.js'
import {GalleryToolbar} from './components/GalleryToolbar.js'
import {GalleryModel} from './model/GalleryModel.js'
import {LineInputsPage} from './pages/LineInputsPage.js'
import {galleryPages} from './routing.js'

/**
 * Gallery root: an island header with the page navbar and the gallery control
 * toolbar, a routed page body, and an island footer. The toolbar's layout
 * toggle switches FrayApp between the viewport application shell and the
 * embedded, document-scrolling website variant.
 */
export class GalleryApp extends Component {
    private readonly model = new GalleryModel()

    render(): FrayChild {
        const variant = this.read(this.model.layoutVariant)
        return <FrayApp
            sizing={variant === 'shell' ? 'viewport' : 'embedded'}
            layout="vertical"
            className={`gallery-root gallery-${variant}`}
            data-variant={variant}
        >
            <GalleryHeader model={this.model} />
            <RouteOutlet
                id="gallery-pages"
                activeViewEmitter={this.model.activePage}
                mountPolicy="lazy"
                views={galleryPages.map((page) => ({
                    id: page.id,
                    route: page.route,
                    content: this.renderPage(page.id),
                }))}
            />
            <GalleryFooter model={this.model} />
        </FrayApp>
    }

    private renderPage(id: string): FrayChild {
        switch (id) {
            default:
                return <LineInputsPage model={this.model} />
        }
    }

    override onDestroy(): void {
        this.model.dispose()
    }

    static dependencies = [
        FrayApp,
        NavigationBar,
        RouteOutlet,
        Toggle,
        GalleryHeader,
        GalleryToolbar,
        GalleryFooter,
        LineInputsPage,
    ]
}
