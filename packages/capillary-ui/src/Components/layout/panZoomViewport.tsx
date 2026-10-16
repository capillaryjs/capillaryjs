import {Emitter} from '@capillaryjs/capillary'
import {Component, css} from '../component.js'
import type {CapillaryUiChild, ComponentProps, Key, LivePropContract, Ref} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {Button} from '../menu/button.js'
import {MenuButton} from '../menu/menuButton.js'
import {DeclarativeRegion, readDeclarativeRegions} from './declarativeRegion.js'
import {createPointerDrag} from '../../interaction/pointerDrag.js'
import {panZoomClampCamera, panZoomClientToWorld, panZoomFitCamera, panZoomWorldToClient, panZoomZoomAt,
    readPanZoomCamera, readPanZoomLimits, readPanZoomSize} from '../../interaction/panZoomGeometry.js'
import type {PanZoomBounds, PanZoomCamera, PanZoomPoint, PanZoomSize} from '../../interaction/panZoomGeometry.js'

export interface PanZoomViewportProps extends ComponentProps, LivePropContract<'disabled'> {
    label: string
    id?: string
    worldWidth: number
    worldHeight: number
    /** Controlled scroll offsets in CSS pixels, plus zoom. Accept changes synchronously. */
    camera?: PanZoomCamera
    defaultCamera?: PanZoomCamera
    onCameraChange?: (camera: PanZoomCamera) => void
    minZoom?: number
    maxZoom?: number
    zoomStep?: number
    panStep?: number
    height?: string
    disabled?: boolean
    panEnabled?: boolean
    canStartPan?: (event: PointerEvent) => boolean
    interactionKey?: unknown
    fitRequest?: {readonly key: Key; readonly bounds: PanZoomBounds}
    /** Supply a direct PanZoomToolbar child. */
    toolbar?: never
    viewportRef?: Ref<HTMLElement>
    ariaDescribedBy?: string
    onResize?: (size: PanZoomSize) => void
}
const sameCamera = (a: PanZoomCamera, b: PanZoomCamera) => a.zoom === b.zoom && Math.abs(a.x - b.x) < .001 && Math.abs(a.y - b.y) < .001
/** Application-specific actions following the standard viewport controls. */
export class PanZoomToolbar extends DeclarativeRegion {}
/** A bounded coordinate plane, not a diagram editor or model store. */
export class PanZoomViewport extends Component<PanZoomViewportProps> {
    static override hostName = 'panzoomviewport'
    static override liveProps = ['disabled'] as const
    static override dependencies = [Button, MenuButton, PanZoomToolbar]
    readonly viewportId: string
    private readonly localCamera: Emitter<PanZoomCamera>
    private viewport: HTMLElement | null = null
    private observer: ResizeObserver | null = null
    private size: PanZoomSize = {width: 0, height: 0}
    private textDirection = 'ltr'
    private lastFit: Key | null = null
    private disposed = false
    private lastPan: PanZoomCamera | null = null
    private readonly pan = createPointerDrag<{camera: PanZoomCamera; key: unknown}>(this, {
        onMove: state => {
            if (state.context.key !== this.props.interactionKey) {this.pan.cancel('context-changed'); return}
            const next = this.clamp({...state.context.camera, x: state.context.camera.x - state.dx, y: state.context.camera.y - state.dy})
            this.lastPan = next; this.publish(next); this.update()
        },
        onCommit: () => {this.lastPan = null; this.update()},
        onCancel: (state, reason) => {
            const last = this.lastPan; this.lastPan = null
            if (this.disposed) return
            if (state.context.key === this.props.interactionKey && reason !== 'context-changed' && reason !== 'camera-replaced' && last && sameCamera(this.camera, last)) this.publish(state.context.camera)
            this.update()
        },
    })
    constructor(props: PanZoomViewportProps) {
        super(props)
        this.viewportId = controlId('viewport', props.id)
        const initial = props.defaultCamera ?? {x: 0, y: 0, zoom: 1}
        readPanZoomCamera(initial)
        this.localCamera = new Emitter(initial, {owner: this, purpose: 'viewport camera'})
    }
    get camera(): PanZoomCamera { return this.props.camera ?? this.localCamera.get() }
    private get world(): PanZoomSize { return {width: this.props.worldWidth, height: this.props.worldHeight} }
    private get ready(): boolean { return this.size.width > 0 && this.size.height > 0 }
    private get interactive(): boolean { return !this.props.disabled && (!this.props.camera || this.props.onCameraChange != null) }
    initialize(): void {this.watch(this.localCamera)}
    private assignRef(ref: Ref<HTMLElement> | undefined, value: HTMLElement | null): void {
        if (typeof ref === 'function') ref(value)
        else if (ref) ref.current = value
    }
    private readonly captureViewport = (element: HTMLElement | null) => {this.viewport = element; this.assignRef(this.props.viewportRef, element)}
    override setProps(props: PanZoomViewportProps): this {
        const changed = props.viewportRef !== this.props.viewportRef
        if (changed) this.assignRef(this.props.viewportRef, null)
        super.setProps(props)
        if (changed) this.assignRef(props.viewportRef, this.viewport)
        return this
    }
    render(): CapillaryUiChild {
        if (this.props.toolbar != null) throw new TypeError('Viewport toolbar must use a direct PanZoomToolbar child')
        const {content, regions} = readDeclarativeRegions('PanZoomViewport', this.props.children, {toolbar: PanZoomToolbar})
        if (typeof this.props.label !== 'string' || !this.props.label.trim()) throw new TypeError('PanZoomViewport requires a nonempty label')
        for (const callback of ['onCameraChange', 'canStartPan', 'onResize'] as const) {
            if (this.props[callback] != null && typeof this.props[callback] !== 'function') throw new TypeError(`Viewport ${callback} must be a function`)
        }
        readPanZoomCamera(this.camera); readPanZoomSize(this.world)
        const limits = readPanZoomLimits(this.props), scale = panZoomClampCamera(this.camera, this.world, {width: 0, height: 0}, limits).zoom
        for (const value of [this.props.zoomStep ?? .25, this.props.panStep ?? 80]) {
            if (!Number.isFinite(value) || value <= 0) throw new RangeError('Viewport control increments must be positive and finite')
        }
        const height = this.props.height ?? '32rem'
        if (typeof height !== 'string' || !height.trim()) throw new TypeError('Viewport height must be a nonempty CSS size')
        const unavailable = !this.interactive || !this.ready, step = this.props.panStep ?? 80, Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <div className="cap-viewport-toolbar" role="group" aria-label={this.capillaryUiMessage('panZoomControlsLabel')}>
                <Button icon="zoom-out" appearance="subtle" ariaLabel={this.capillaryUiMessage('panZoomOutLabel')} disabled={unavailable || scale <= limits.minZoom} onClick={() => this.zoomTo(scale - (this.props.zoomStep ?? .25))}/>
                <Button icon="reset" appearance="subtle" ariaLabel={this.capillaryUiMessage('panZoomResetLabel')} disabled={unavailable} onClick={() => this.reset()}/>
                <Button icon="zoom-in" appearance="subtle" ariaLabel={this.capillaryUiMessage('panZoomInLabel')} disabled={unavailable || scale >= limits.maxZoom} onClick={() => this.zoomTo(scale + (this.props.zoomStep ?? .25))}/>
                <output aria-label={this.capillaryUiMessage('panZoomLevelLabel')}>{Math.round(scale * 100)}%</output>
                <Button icon="fit" appearance="subtle" ariaLabel={this.capillaryUiMessage('panZoomFitLabel')} disabled={unavailable} onClick={() => this.fit()}/>
                <MenuButton icon="pan" appearance="subtle" ariaLabel={this.capillaryUiMessage('panZoomPanLabel')} disabled={unavailable} items={[
                    {id: 'left', label: this.capillaryUiMessage('panZoomLeftLabel'), icon: 'previous', onSelect: () => this.panBy(-step, 0)},
                    {id: 'right', label: this.capillaryUiMessage('panZoomRightLabel'), icon: 'next', onSelect: () => this.panBy(step, 0)},
                    {id: 'up', label: this.capillaryUiMessage('panZoomUpLabel'), icon: 'up', onSelect: () => this.panBy(0, -step)},
                    {id: 'down', label: this.capillaryUiMessage('panZoomDownLabel'), icon: 'down', onSelect: () => this.panBy(0, step)},
                ]}/>
                {regions.toolbar}
            </div>
            <div id={this.viewportId} className="cap-viewport" role="region" aria-label={this.props.label} tabIndex={0} dir="ltr"
                aria-describedby={[this.props.ariaDescribedBy, `${this.viewportId}-help`].filter(Boolean).join(' ')}
                style={{blockSize: height}} ref={this.captureViewport} data-panning={this.pan.dragging ? '' : null}
                data-pan-enabled={this.interactive && this.props.panEnabled !== false ? '' : null}
                onPointerDown={(event: PointerEvent) => this.beginPan(event)} onScroll={() => this.readScroll()}
                onKeyDown={(event: KeyboardEvent) => this.keyDown(event)}>
                <div className="cap-viewport-spacer" style={{width: `${this.props.worldWidth * scale}px`, height: `${this.props.worldHeight * scale}px`}}>
                    <div className="cap-viewport-world" dir={this.textDirection} style={{width: `${this.props.worldWidth}px`, height: `${this.props.worldHeight}px`, transform: `scale(${scale})`}}>{content}</div>
                </div>
            </div>
            <p id={`${this.viewportId}-help`} className="cap-viewport-help">{this.capillaryUiMessage('panZoomHelp')}</p>
        </Host>
    }
    afterMount(): void {
        const viewport = this.viewport
        if (!viewport) return
        this.listen(viewport, 'pointerdown', () => this.pan.cancel('replaced'), true)
        this.listen<MouseEvent>(viewport, 'click', event => {
            if (this.pan.consumeClick(event)) {event.preventDefault(); event.stopPropagation()}
        }, true)
        const view = viewport.ownerDocument.defaultView
        if (view?.ResizeObserver) {this.observer = new view.ResizeObserver(() => {this.measure(); this.sync()}); this.observer.observe(viewport)}
        else if (view) this.listen(view, 'resize', () => {this.measure(); this.sync()})
        this.measure(); this.sync()
    }
    afterUpdate(): void {this.measure(); this.sync()}
    private measure(): void {
        const viewport = this.viewport
        if (!viewport || this.disposed) return
        const size = {width: viewport.clientWidth, height: viewport.clientHeight}
        const direction = viewport.ownerDocument.defaultView?.getComputedStyle(this.dom as Element).direction || 'ltr'
        if (size.width !== this.size.width || size.height !== this.size.height || direction !== this.textDirection) {
            this.size = size; this.textDirection = direction
            this.pan.cancel('viewport-resized'); this.props.onResize?.(size); this.update()
        }
    }
    private sync(): void {
        const viewport = this.viewport
        if (!viewport || !this.ready || this.disposed) return
        const context = this.pan.context
        if (context && (!this.interactive || this.props.panEnabled === false || context.key !== this.props.interactionKey)) this.pan.cancel('context-changed')
        else if (context && this.lastPan && !sameCamera(this.camera, this.lastPan)) this.pan.cancel('camera-replaced')
        const camera = this.clamp(this.camera)
        if (!sameCamera(camera, this.camera) && this.interactive) this.publish(camera)
        viewport.scrollLeft = camera.x; viewport.scrollTop = camera.y
        const fit = this.props.fitRequest
        if (fit && fit.key !== this.lastFit && this.interactive) {this.lastFit = fit.key; this.fit(fit.bounds)}
    }
    private clamp(camera: PanZoomCamera): PanZoomCamera { return panZoomClampCamera(camera, this.world, this.size, this.props) }
    private publish(request: PanZoomCamera): void {
        if (this.disposed || !this.interactive) return
        const camera = this.clamp(request)
        if (sameCamera(camera, this.camera)) return
        if (this.props.camera) this.props.onCameraChange?.(camera)
        else {this.localCamera.set(camera, 'viewport camera'); this.props.onCameraChange?.(camera)}
    }
    private beginPan(event: PointerEvent): void {
        const viewport = this.viewport, target = event.target as Element
        if (!viewport || !this.ready || !this.interactive || this.props.panEnabled === false || event.pointerType === 'touch') return
        const interactive = target.closest('a,button,input,select,textarea,[contenteditable]:not([contenteditable="false"]),[tabindex],[role="button"],[role="slider"],[role="treeitem"],[data-cap-pan-exclude]')
        if (interactive && interactive !== viewport || this.props.canStartPan?.(event) === false) return
        const rect = viewport.getBoundingClientRect(), x = event.clientX - rect.left - viewport.clientLeft, y = event.clientY - rect.top - viewport.clientTop
        if (x < 0 || y < 0 || x >= viewport.clientWidth || y >= viewport.clientHeight) return
        viewport.focus({preventScroll: true}); this.lastPan = this.camera
        this.pan.begin(event, {camera: this.camera, key: this.props.interactionKey}, viewport)
    }
    private readScroll(): void {
        const viewport = this.viewport
        if (!viewport || !this.ready || this.disposed) return
        if (!this.interactive) {this.sync(); return}
        const next = {...this.camera, x: viewport.scrollLeft, y: viewport.scrollTop}
        if (sameCamera(next, this.camera)) return
        this.pan.cancel('camera-replaced'); this.publish(next)
        if (this.props.camera) this.sync()
    }
    zoomTo(zoom: number, anchor: PanZoomPoint = {x: this.size.width / 2, y: this.size.height / 2}): void {
        if (!this.ready || !this.interactive) return
        this.pan.cancel('zoom'); this.publish(panZoomZoomAt(this.camera, zoom, anchor, this.props))
    }
    panBy(x: number, y: number): void {
        if (!this.ready || !this.interactive) return
        this.pan.cancel('pan'); this.publish({...this.camera, x: this.camera.x + x, y: this.camera.y + y})
    }
    fit(bounds: PanZoomBounds = {x: 0, y: 0, ...this.world}): void {
        if (!this.ready || !this.interactive) return
        this.pan.cancel('fit')
        const limits = readPanZoomLimits(this.props)
        this.publish(panZoomFitCamera(bounds, this.size, {...limits, maxZoom: Math.max(limits.minZoom, Math.min(1, limits.maxZoom))}))
    }
    reset(): void {
        if (!this.ready || !this.interactive) return
        this.pan.cancel('reset'); this.publish(this.props.defaultCamera ?? {x: 0, y: 0, zoom: 1})
    }
    clientToWorld(point: PanZoomPoint): PanZoomPoint { return panZoomClientToWorld(point, this.origin(), this.renderedCamera()) }
    worldToClient(point: PanZoomPoint): PanZoomPoint { return panZoomWorldToClient(point, this.origin(), this.renderedCamera()) }
    private origin(): PanZoomPoint {
        if (!this.viewport) throw new Error('Viewport is not mounted')
        const rect = this.viewport.getBoundingClientRect()
        return {x: rect.left + this.viewport.clientLeft, y: rect.top + this.viewport.clientTop}
    }
    private renderedCamera(): PanZoomCamera {
        if (!this.viewport) throw new Error('Viewport is not mounted')
        return {...this.clamp(this.camera), x: this.viewport.scrollLeft, y: this.viewport.scrollTop}
    }
    private keyDown(event: KeyboardEvent): void {
        if (event.target !== this.viewport || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !this.interactive) return
        const step = (this.props.panStep ?? 80) * (event.shiftKey ? 3 : 1)
        const direction = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]}[event.key]
        if (direction) {event.preventDefault(); this.panBy(direction[0]!, direction[1]!)}
        else if (event.key === '+' || event.key === '=') {event.preventDefault(); this.zoomTo(this.camera.zoom + (this.props.zoomStep ?? .25))}
        else if (event.key === '-') {event.preventDefault(); this.zoomTo(this.camera.zoom - (this.props.zoomStep ?? .25))}
        else if (event.key === '0') {event.preventDefault(); this.reset()}
    }
    onDestroy(): void {
        this.disposed = true; this.pan.dispose(); this.observer?.disconnect(); this.observer = null; this.localCamera.dispose()
    }
    static override css = css`
        & { display: flex; flex-direction: column; min-inline-size: 0; min-block-size: 0; }
        & > .cap-viewport-toolbar { display: flex; flex: none; align-items: center; flex-wrap: wrap; gap: .25rem; }
        & > .cap-viewport { flex: 1 1 auto; min-inline-size: 0; min-block-size: 0; overflow: auto;
            border: var(--input-border, 1px solid); background: var(--panel-background); touch-action: pan-x pan-y; }
        & > .cap-viewport:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
        @media (hover: hover) { & > .cap-viewport[data-pan-enabled] { cursor: grab; } }
        & > .cap-viewport[data-panning] { cursor: grabbing; user-select: none; }
        & .cap-viewport-spacer { position: relative; overflow: hidden; }
        & .cap-viewport-world { position: absolute; inset: 0 auto auto 0; transform-origin: top left; }
        & > .cap-viewport-help { flex: none; margin-block: .3rem; font-size: .85em; }
    `
}
