import {Component} from '@sylwellsoftware/fray'
import type {FrayChild} from '@sylwellsoftware/fray'
import {
    Breadcrumb,
    FrayApp,
    NavigationBar,
    RouteOutlet,
    Toggle,
} from '@sylwellsoftware/fray'

import {GalleryFooter} from './components/GalleryFooter.js'
import {GalleryHeader} from './components/GalleryHeader.js'
import {GalleryModel} from './model/GalleryModel.js'
import {AnalyticsPage} from './pages/AnalyticsPage.js'
import {DataGridPage} from './pages/DataGridPage.js'
import {DirectoryPage} from './pages/DirectoryPage.js'
import {ExplorerPage} from './pages/ExplorerPage.js'
import {FormsPage} from './pages/FormsPage.js'
import {galleryPages} from './routing.js'

/**
 * Gallery root: an island header with the page navbar, a routed page body, and
 * an island footer. The header toggle switches FrayApp between the viewport
 * application shell and the embedded, document-scrolling website variant.
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
            case 'explorer':
                return <ExplorerPage model={this.model} />
            case 'directory':
                return <DirectoryPage model={this.model} />
            case 'analytics':
                return <AnalyticsPage model={this.model} />
            case 'forms':
                return <FormsPage model={this.model} />
            default:
                return <DataGridPage model={this.model} />
        }
    }

    override onDestroy(): void {
        this.model.dispose()
    }

    static dependencies = [
        FrayApp,
        NavigationBar,
        RouteOutlet,
        Breadcrumb,
        Toggle,
        GalleryHeader,
        GalleryFooter,
        DataGridPage,
        ExplorerPage,
        DirectoryPage,
        AnalyticsPage,
        FormsPage,
    ]
}
