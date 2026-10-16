import type {Component} from '../Components/component.js'

export interface PointerDragSnapshot<TContext> {
    readonly context: TContext
    readonly element: HTMLElement
    readonly start: {readonly x: number; readonly y: number}
    readonly point: {readonly x: number; readonly y: number}
    readonly dx: number
    readonly dy: number
    readonly event: PointerEvent
}
export interface PointerDragOptions<TContext> {
    /** Euclidean distance in CSS pixels; default 3. */
    threshold?: number
    preventDefault?: boolean
    onStart?: (state: PointerDragSnapshot<TContext>) => void
    onMove?: (state: PointerDragSnapshot<TContext>) => void
    onCommit?: (state: PointerDragSnapshot<TContext>) => void
    onCancel?: (state: PointerDragSnapshot<TContext>, reason: string) => void
}
export interface PointerDrag<TContext> {
    readonly active: boolean
    readonly dragging: boolean
    readonly context: TContext | null
    begin(event: PointerEvent, context: TContext, captureElement?: HTMLElement): boolean
    cancel(reason?: string): boolean
    /** Consume the immediate pointer-generated click after dragging, never a keyboard click. */
    consumeClick(event: MouseEvent): boolean
    dispose(): void
}
type DragOwner = Pick<Component, 'onCleanup' | 'listenWhile'>
interface Gesture<TContext> {
    context: TContext
    element: HTMLElement
    pointerId: number
    start: {x: number; y: number}
    event: PointerEvent
    started: boolean
    detach: Array<() => void>
}

/** Pointer lifecycle only. The owner supplies semantic, keyboard and transaction policy. */
export function createPointerDrag<TContext>(owner: DragOwner, options: PointerDragOptions<TContext>): PointerDrag<TContext> {
    return new OwnedPointerDrag(owner, options)
}

class OwnedPointerDrag<TContext> implements PointerDrag<TContext> {
    private gesture: Gesture<TContext> | null = null
    private disposed = false
    private unregister: () => void = () => {}
    private suppress: {element: HTMLElement; until: number} | null = null
    constructor(private readonly owner: DragOwner, private readonly options: PointerDragOptions<TContext>) {
        if (!owner || typeof owner.onCleanup !== 'function' || typeof owner.listenWhile !== 'function') throw new TypeError('Pointer dragging requires a Component owner')
        if (!options || typeof options !== 'object') throw new TypeError('Pointer drag options must be an object')
        for (const callback of ['onStart', 'onMove', 'onCommit', 'onCancel'] as const) {
            if (options[callback] != null && typeof options[callback] !== 'function') throw new TypeError(`Pointer drag ${callback} must be a function`)
        }
        const threshold = options.threshold ?? 3
        if (!Number.isFinite(threshold) || threshold < 0) throw new RangeError('Pointer drag threshold must be nonnegative and finite')
        this.unregister = owner.onCleanup(() => this.dispose())
    }
    get active(): boolean { return this.gesture != null }
    get dragging(): boolean { return this.gesture?.started ?? false }
    get context(): TContext | null { return this.gesture?.context ?? null }
    begin(event: PointerEvent, context: TContext, captureElement = event.currentTarget as HTMLElement): boolean {
        if (this.disposed || event.button !== 0 || event.isPrimary === false || !captureElement?.isConnected) return false
        if (typeof captureElement.setPointerCapture !== 'function') throw new TypeError('Pointer dragging requires native pointer capture')
        this.cancel('replaced')
        if (this.disposed || this.gesture) return false
        this.suppress = null
        const gesture: Gesture<TContext> = {context, element: captureElement, pointerId: event.pointerId,
            start: {x: event.clientX, y: event.clientY}, event, started: false, detach: []}
        this.gesture = gesture
        const doc = captureElement.ownerDocument
        gesture.detach.push(
            this.owner.listenWhile<PointerEvent>(doc, 'pointermove', native => this.move(native), true),
            this.owner.listenWhile<PointerEvent>(doc, 'pointerup', native => this.end(native), true),
            this.owner.listenWhile<PointerEvent>(doc, 'pointercancel', native => {if (native.pointerId === gesture.pointerId) this.cancel('pointercancel')}, true),
            this.owner.listenWhile<PointerEvent>(captureElement, 'lostpointercapture', native => {if (native.pointerId === gesture.pointerId) this.cancel('lostcapture')}),
            this.owner.listenWhile<KeyboardEvent>(doc, 'keydown', native => {
                if (native.key !== 'Escape' || native.defaultPrevented) return
                native.preventDefault(); native.stopPropagation(); this.cancel('escape')
            }, true),
        )
        if (doc.defaultView) gesture.detach.push(this.owner.listenWhile(doc.defaultView, 'blur', () => this.cancel('blur')))
        try { captureElement.setPointerCapture(event.pointerId) }
        catch { this.cancel('capturefailed'); return false }
        if (this.options.preventDefault !== false) event.preventDefault()
        return true
    }
    private snapshot(gesture: Gesture<TContext>): PointerDragSnapshot<TContext> {
        const {clientX: x, clientY: y} = gesture.event
        return {context: gesture.context, element: gesture.element, start: gesture.start, point: {x, y},
            dx: x - gesture.start.x, dy: y - gesture.start.y, event: gesture.event}
    }
    private move(event: PointerEvent): void {
        const gesture = this.gesture
        if (!gesture || event.pointerId !== gesture.pointerId) return
        gesture.event = event
        const state = this.snapshot(gesture)
        if (!gesture.started && Math.hypot(state.dx, state.dy) <= (this.options.threshold ?? 3)) return
        try {
            if (!gesture.started) {gesture.started = true; this.options.onStart?.(state)}
            if (this.gesture !== gesture) return
            if (this.options.preventDefault !== false) event.preventDefault()
            this.options.onMove?.(state)
        } catch (error) { this.cancel('error'); throw error }
    }
    private end(event: PointerEvent): void {
        const gesture = this.gesture
        if (!gesture || event.pointerId !== gesture.pointerId) return
        if (!gesture.started) {
            this.move(event)
            if (this.gesture !== gesture) return
        }
        gesture.event = event
        const state = this.snapshot(gesture)
        this.finish(gesture)
        if (gesture.started) this.options.onCommit?.(state)
    }
    cancel(reason = 'cancelled'): boolean {
        const gesture = this.gesture
        if (!gesture) return false
        const state = this.snapshot(gesture)
        this.finish(gesture)
        this.options.onCancel?.(state, reason)
        return true
    }
    private finish(gesture: Gesture<TContext>): void {
        this.gesture = null
        if (gesture.started) this.suppress = {element: gesture.element, until: Date.now() + 1000}
        for (const detach of gesture.detach.splice(0)) detach()
        if (gesture.element.hasPointerCapture?.(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId)
    }
    consumeClick(event: MouseEvent): boolean {
        const suppress = this.suppress
        if (!suppress || event.detail === 0) return false
        if (Date.now() > suppress.until) {this.suppress = null; return false}
        if (!suppress.element.contains(event.target as Node | null)) return false
        this.suppress = null
        return true
    }
    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        try { this.cancel('disposed') }
        finally {this.suppress = null; this.unregister()}
    }
}
