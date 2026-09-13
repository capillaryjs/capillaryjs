import {Component} from '@capillaryjs/capillary-ui'
import type {CapillaryUiChild} from '@capillaryjs/capillary-ui'
import {CapillaryUiApp, NavigationBar, RouteOutlet, Toggle} from '@capillaryjs/capillary-ui'

import {GalleryFooter} from './components/GalleryFooter.js'
import {GalleryHeader} from './components/GalleryHeader.js'
import {GalleryToolbar} from './components/GalleryToolbar.js'
import {GalleryModel} from './model/GalleryModel.js'
import {DataComponentsPage} from './pages/DataComponentsPage.js'
import {LineInputsPage} from './pages/LineInputsPage.js'
import {galleryPages} from './routing.js'

/**
 * Gallery root: an island header with the page navbar and the gallery control
 * toolbar, a routed page body, and an island footer. The toolbar's layout
 * toggle switches CapillaryUiApp between the viewport application shell and the
 * embedded, document-scrolling website variant.
 */
export class GalleryApp extends Component {
    private readonly model = new GalleryModel()

    render(): CapillaryUiChild {
        const variant = this.read(this.model.layoutVariant)
        return <CapillaryUiApp
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
        </CapillaryUiApp>
    }

    private renderPage(id: string): CapillaryUiChild {
        switch (id) {
            case 'data-components':
                return <DataComponentsPage model={this.model} />
            default:
                return <LineInputsPage model={this.model} />
        }
    }

    override onDestroy(): void {
        this.model.dispose()
    }

    static dependencies = [
        CapillaryUiApp,
        NavigationBar,
        RouteOutlet,
        Toggle,
        GalleryHeader,
        GalleryToolbar,
        GalleryFooter,
        DataComponentsPage,
        LineInputsPage,
    ]
}
