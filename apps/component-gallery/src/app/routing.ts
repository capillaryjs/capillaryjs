import {defineRoute} from '@sylwellsoftware/fray'
import type {LiteralRouteDescriptor} from '@sylwellsoftware/fray'

export interface GalleryPageDefinition {
    readonly id: string
    readonly label: string
    readonly route: LiteralRouteDescriptor
}

/** Ordered gallery page registry shared by the navbar, outlet, and breadcrumb. */
export const galleryPages: readonly GalleryPageDefinition[] = Object.freeze([
    {id: 'data-grid', label: 'Data grid', route: defineRoute('data-grid')},
    {id: 'explorer', label: 'Explorer', route: defineRoute('explorer')},
    {id: 'directory', label: 'Directory', route: defineRoute('directory')},
    {id: 'analytics', label: 'Analytics', route: defineRoute('analytics')},
    {id: 'forms', label: 'Forms', route: defineRoute('forms')},
])
