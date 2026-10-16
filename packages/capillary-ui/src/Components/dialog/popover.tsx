import {Component, css} from '../component.js'
import type {CapillaryUiChild, Ref} from '../component.js'
import {componentClass, controlId, createValueEmitter, invoke} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'

export interface PopoverProps extends ValueControlProps<boolean> {
    label: string
    anchor: HTMLElement | null
    id?: string
    initialFocusRef?: Ref<HTMLElement>
    onClose?: () => void
}

/** Anchored, nonmodal native top-layer surface; callers own its content/state. */
export class Popover<TProps extends PopoverProps = PopoverProps> extends Component<TProps> {
    readonly openEmitter: ValueEmitter<boolean>
    readonly panelId: string
    protected panel: HTMLElement | null = null
    private synchronizedOpen = false
    private restoreFocusTo: HTMLElement | null = null
    private lightDismiss = false
    private detachViewport: Array<() => void> = []
    private resizeObserver: ResizeObserver | null = null

    constructor(props: TProps) {
        super(props)
        if (!props.label?.trim()) throw new TypeError('Popover requires an accessible label')
        this.openEmitter = createValueEmitter(this, props, false, 'popover open state')
        this.panelId = controlId('popover', props.id)
    }

    initialize(): void { this.watch(this.openEmitter) }

    render(): CapillaryUiChild {
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <div id={this.panelId} popover="auto" role={this.surfaceRole} aria-label={this.props.label}
                tabIndex={-1} ref={(element: HTMLElement | null) => this.panel = element}>
                {this.renderSurfaceContent()}
            </div>
        </Host>
    }

    /** Specialized widgets retain their own semantics and keyboard model. */
    protected get surfaceRole(): 'dialog' | 'menu' { return 'dialog' }
    protected renderSurfaceContent(): CapillaryUiChild { return this.props.children }
    protected focusOnOpen(panel: HTMLElement): void {
        const ref = this.props.initialFocusRef
        const initial = ref != null && typeof ref !== 'function' ? ref.current : null
        ;(initial ?? panel.querySelector<HTMLElement>(
            '[autofocus], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? panel).focus({preventScroll: true})
    }
    protected onSurfaceKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            this.lightDismiss = false
            this.close()
        }
    }

    afterMount(): void {
        const panel = this.panel
        if (!panel) return
        const onToggle = () => {
            if (this.synchronizedOpen && !panel.matches(':popover-open')) this.close()
        }
        // Toggle is a browser lifecycle notification, not a second user
        // interaction for a show/hide already caused by a traced click/key.
        panel.addEventListener('toggle', onToggle)
        this.onCleanup(() => panel.removeEventListener('toggle', onToggle))
        this.syncOpen()
        // Nested components are constructed before their parent's DOM is
        // inserted. Native top-layer APIs require a connected element.
        if (!panel.isConnected) queueMicrotask(() => this.syncOpen())
    }

    afterUpdate(): void { this.syncOpen() }
    close(): void {
        if (this.openEmitter.get()) this.openEmitter.set(false, 'popover close requested')
    }
    onDestroy(): void { this.finishClose() }

    private syncOpen(): void {
        const panel = this.panel
        if (!panel?.isConnected) return
        if (this.openEmitter.get()) {
            const anchor = this.props.anchor
            if (!anchor?.isConnected) { this.close(); return }
            if (!this.synchronizedOpen) {
                if (typeof panel.showPopover !== 'function') {
                    throw new Error('Popover requires the native popover API')
                }
                this.restoreFocusTo = anchor
                this.lightDismiss = false
                panel.showPopover()
                this.synchronizedOpen = true
                const doc = panel.ownerDocument
                const view = doc.defaultView
                this.detachViewport.push(this.listenWhile(doc, 'scroll', () => this.position(), true))
                this.detachViewport.push(this.listenWhile<PointerEvent>(doc, 'pointerdown', event => {
                    const target = event.target as Node | null
                    this.lightDismiss = !panel.contains(target) && !anchor.contains(target)
                }, true))
                this.detachViewport.push(this.listenWhile<MouseEvent>(doc, 'click', event => {
                    const target = event.target as Node | null
                    if (!panel.contains(target) && !anchor.contains(target)) {
                        this.lightDismiss = true
                        this.close()
                    }
                }))
                this.detachViewport.push(this.listenWhile<KeyboardEvent>(panel, 'keydown', event => this.onSurfaceKeyDown(event)))
                if (view) {
                    this.detachViewport.push(this.listenWhile(view, 'resize', () => this.position()))
                    if (view.visualViewport) {
                        this.detachViewport.push(this.listenWhile(view.visualViewport, 'resize', () => this.position()))
                        this.detachViewport.push(this.listenWhile(view.visualViewport, 'scroll', () => this.position()))
                    }
                    if (typeof view.ResizeObserver === 'function') {
                        this.resizeObserver = new view.ResizeObserver(() => this.position())
                        this.resizeObserver.observe(anchor)
                        this.resizeObserver.observe(panel)
                    }
                }
                this.position()
                this.focusOnOpen(panel)
            } else this.position()
        } else if (this.synchronizedOpen) {
            if (panel.matches(':popover-open')) panel.hidePopover()
            this.finishClose()
        }
    }

    private position(): void {
        const panel = this.panel, anchor = this.props.anchor
        if (!panel || !anchor?.isConnected) { this.close(); return }
        const view = panel.ownerDocument.defaultView
        if (!view) return
        const viewport = view.visualViewport
        const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
        const width = viewport?.width ?? view.innerWidth, height = viewport?.height ?? view.innerHeight
        const margin = 8, gap = 6
        panel.style.maxWidth = `${Math.max(0, width - margin * 2)}px`
        panel.style.maxHeight = `${Math.max(0, height - margin * 2)}px`
        const rect = anchor.getBoundingClientRect(), size = panel.getBoundingClientRect()
        const below = rect.bottom + gap
        const y = below + size.height > top + height - margin && rect.top - top > top + height - rect.bottom
            ? rect.top - gap - size.height : below
        panel.style.left = `${Math.max(left + margin, Math.min(rect.left, left + width - size.width - margin))}px`
        panel.style.top = `${Math.max(top + margin, Math.min(y, top + height - size.height - margin))}px`
    }

    private finishClose(): void {
        for (const detach of this.detachViewport.splice(0)) detach()
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
        if (!this.synchronizedOpen) return
        this.synchronizedOpen = false
        const restore = this.restoreFocusTo
        this.restoreFocusTo = null
        // Light dismissal must not steal focus from an outside control clicked
        // by the user. Escape/cancel returns focus to the initiating control.
        if (restore?.isConnected && !this.lightDismiss) {
            restore.focus({preventScroll: true})
        }
        invoke(this.props.onClose)
    }

    static override hostName = 'popover'
    static override css = css`
        & { display: contents; }
        & > [popover] {
            position: fixed;
            inset: auto;
            margin: 0;
            inline-size: max-content;
            max-inline-size: min(28rem, calc(100vw - 1rem));
            box-sizing: border-box;
            overflow: auto;
            padding: var(--panel-padding, .75rem);
            color: var(--panel-color, inherit);
            background: var(--panel-background, Canvas);
            border: var(--panel-border, 1px solid CanvasText);
            border-radius: var(--panel-radius, .4rem);
            box-shadow: var(--dialog-shadow);
            font: inherit;
        }
        & > [popover]::backdrop { background: transparent; }
        @media (forced-colors: active) { & > [popover] { border: 1px solid CanvasText; } }
    `
}
