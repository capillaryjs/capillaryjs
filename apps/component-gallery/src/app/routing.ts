import {defineRoute} from '@capillaryjs/capillary-ui'
import type {LiteralRouteDescriptor} from '@capillaryjs/capillary-ui'

export interface GalleryPageDefinition {
    readonly id: string
    readonly label: string
    readonly route: LiteralRouteDescriptor
}

/** Ordered gallery page registry shared by the navbar and the route outlet. */
export const galleryPages: readonly GalleryPageDefinition[] = Object.freeze([
    {id: 'line-inputs', label: 'Line inputs', route: defineRoute('line-inputs')},
    {id: 'data-components', label: 'Data components', route: defineRoute('data-components')},
])
