import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'

import type {GalleryModel} from '../model/GalleryModel.js'

export interface GalleryFooterProps extends ComponentProps {
    model: GalleryModel
}

/** Island footer: live status line. */
export class GalleryFooter extends Component<GalleryFooterProps> {
    render(): FrayChild {
        const model = this.props.model
        return <footer class="gallery-footer island">
            <p class="gallery-status">{this.read(model.lastAction)}</p>
        </footer>
    }
}
