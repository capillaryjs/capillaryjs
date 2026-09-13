import {Component} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'

import type {GalleryModel} from '../model/GalleryModel.js'

export interface GalleryFooterProps extends ComponentProps {
    model: GalleryModel
}

/** Island footer: live status line. */
export class GalleryFooter extends Component<GalleryFooterProps> {
    render(): CapillaryUiChild {
        const model = this.props.model
        return <footer class="gallery-footer island">
            <p class="gallery-status">{this.read(model.lastAction)}</p>
        </footer>
    }
}
