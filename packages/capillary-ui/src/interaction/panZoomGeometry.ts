export interface PanZoomPoint {readonly x: number; readonly y: number}
export interface PanZoomSize {readonly width: number; readonly height: number}
export interface PanZoomCamera extends PanZoomPoint {readonly zoom: number}
export interface PanZoomBounds extends PanZoomPoint, PanZoomSize {}
export interface PanZoomLimits {readonly minZoom: number; readonly maxZoom: number}

function finite(value: number, label: string): void {
    if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}
function point(x: number, y: number): PanZoomPoint {
    finite(x, 'Result x'); finite(y, 'Result y')
    return {x, y}
}
export function readPanZoomCamera(camera: PanZoomCamera): void {
    if (!camera) throw new TypeError('Pan/zoom camera is required')
    finite(camera.x, 'Camera x'); finite(camera.y, 'Camera y'); finite(camera.zoom, 'Camera zoom')
    if (camera.zoom <= 0) throw new RangeError('Camera zoom must be positive')
}
export function readPanZoomSize(size: PanZoomSize): void {
    finite(size.width, 'Width'); finite(size.height, 'Height')
    if (size.width < 0 || size.height < 0) throw new RangeError('Dimensions must be nonnegative')
}
export function readPanZoomLimits(limits: Partial<PanZoomLimits> = {}): PanZoomLimits {
    const minZoom = limits.minZoom ?? .25, maxZoom = limits.maxZoom ?? 2
    if (![minZoom, maxZoom].every(Number.isFinite) || minZoom <= 0 || maxZoom < minZoom) throw new RangeError('Invalid pan/zoom limits')
    return {minZoom, maxZoom}
}
export function panZoomClampCamera(camera: PanZoomCamera, world: PanZoomSize, viewport: PanZoomSize,
    limits: Partial<PanZoomLimits> = {}): PanZoomCamera {
    readPanZoomCamera(camera); readPanZoomSize(world); readPanZoomSize(viewport)
    const {minZoom, maxZoom} = readPanZoomLimits(limits), zoom = Math.min(maxZoom, Math.max(minZoom, camera.zoom))
    const width = world.width * zoom, height = world.height * zoom
    finite(width, 'Scaled world width'); finite(height, 'Scaled world height')
    return {x: Math.max(0, Math.min(camera.x, width - viewport.width)),
        y: Math.max(0, Math.min(camera.y, height - viewport.height)), zoom}
}
/** Anchor is measured in CSS pixels from the viewport's inner top-left corner. */
export function panZoomZoomAt(camera: PanZoomCamera, requestedZoom: number, anchor: PanZoomPoint,
    limits: Partial<PanZoomLimits> = {}): PanZoomCamera {
    readPanZoomCamera(camera); finite(requestedZoom, 'Requested zoom'); finite(anchor.x, 'Anchor x'); finite(anchor.y, 'Anchor y')
    const {minZoom, maxZoom} = readPanZoomLimits(limits), zoom = Math.min(maxZoom, Math.max(minZoom, requestedZoom))
    return {...point((camera.x + anchor.x) / camera.zoom * zoom - anchor.x,
        (camera.y + anchor.y) / camera.zoom * zoom - anchor.y), zoom}
}
export function panZoomFitCamera(bounds: PanZoomBounds, viewport: PanZoomSize,
    limits: Partial<PanZoomLimits> = {}, padding = 30): PanZoomCamera {
    readPanZoomSize(bounds); readPanZoomSize(viewport)
    finite(bounds.x, 'Bounds x'); finite(bounds.y, 'Bounds y'); finite(bounds.x + bounds.width, 'Bounds right'); finite(bounds.y + bounds.height, 'Bounds bottom')
    finite(padding, 'Fit padding')
    if (padding < 0 || viewport.width <= 0 || viewport.height <= 0) throw new RangeError('Fit requires positive viewport dimensions and nonnegative padding')
    const {minZoom, maxZoom} = readPanZoomLimits(limits)
    const zoom = Math.max(minZoom, Math.min(maxZoom, Math.max(1, viewport.width - padding * 2) / Math.max(1, bounds.width),
        Math.max(1, viewport.height - padding * 2) / Math.max(1, bounds.height)))
    return {...point((bounds.x + bounds.width / 2) * zoom - viewport.width / 2,
        (bounds.y + bounds.height / 2) * zoom - viewport.height / 2), zoom}
}
/** Origin is the viewport's client-space inner corner, including its border. */
export function panZoomClientToWorld(point: PanZoomPoint, origin: PanZoomPoint, camera: PanZoomCamera): PanZoomPoint {
    readPanZoomCamera(camera)
    for (const value of [point.x, point.y, origin.x, origin.y]) finite(value, 'Coordinate')
    const x = (point.x - origin.x + camera.x) / camera.zoom, y = (point.y - origin.y + camera.y) / camera.zoom
    finite(x, 'Result x'); finite(y, 'Result y')
    return {x, y}
}
export function panZoomWorldToClient(point: PanZoomPoint, origin: PanZoomPoint, camera: PanZoomCamera): PanZoomPoint {
    readPanZoomCamera(camera)
    for (const value of [point.x, point.y, origin.x, origin.y]) finite(value, 'Coordinate')
    const x = origin.x + point.x * camera.zoom - camera.x, y = origin.y + point.y * camera.zoom - camera.y
    finite(x, 'Result x'); finite(y, 'Result y')
    return {x, y}
}
