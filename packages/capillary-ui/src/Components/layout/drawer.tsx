import {Component, css} from '../component.js'
import type {CapillaryUiChild} from '../component.js'
import {componentClass, controlId, createValueEmitter, invoke} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {Button} from '../menu/button.js'
import {readContentMountPolicy} from './routedSelection.js'
import type {ContentMountPolicy} from './routedSelection.js'

export type DrawerEdge = 'inline-start' | 'inline-end' | 'block-start' | 'block-end'
export interface DrawerProps extends ValueControlProps<boolean> {
    label: string
    id?: string
    edge?: DrawerEdge
    size?: string
    mountPolicy?: ContentMountPolicy
    /** The drawer body owns scrolling by default; false delegates to its content. */
    scroll?: boolean
    closeLabel?: string
    initialFocusRef?: {current: HTMLElement | null}
    returnFocusRef?: {current: HTMLElement | null}
    onClose?: () => void
}

/** Inline nonmodal edge region. Parent layout, breakpoints and persistence are app-owned. */
export class Drawer extends Component<DrawerProps> {
    static override hostName = 'drawer'
    static override dependencies = [Button]
    readonly openEmitter: ValueEmitter<boolean>
    readonly drawerId: string
    private wasOpen = false
    private openedOnce = false
    private opener: HTMLElement | null = null
    private entering = false
    private closing = false
    private restoreFocus = false
    private closeActivatedInside = false
    constructor(props: DrawerProps) {
        super(props)
        this.openEmitter = createValueEmitter(this, props, false, 'drawer open state')
        this.drawerId = controlId('drawer', props.id)
    }
    initialize(): void { this.watch(this.openEmitter) }
    render(): CapillaryUiChild {
        const {label, edge = 'inline-end', size = '20rem', scroll = true} = this.props
        if (typeof label !== 'string' || !label.trim()) throw new TypeError('Drawer requires a nonempty label')
        if (!['inline-start', 'inline-end', 'block-start', 'block-end'].includes(edge)) throw new TypeError('Unknown Drawer edge')
        if (typeof size !== 'string' || !size.trim()) throw new TypeError('Drawer size must be a nonempty CSS size')
        const policy = readContentMountPolicy(this.props.mountPolicy, 'Drawer')
        const open = this.openEmitter.get(), host = this.dom as HTMLElement | null
        if (open !== this.wasOpen) {
            if (open) {
                this.opener = (host?.ownerDocument ?? globalThis.document)?.activeElement as HTMLElement | null
                this.entering = true
            } else {
                this.closing = true
                this.restoreFocus = this.closeActivatedInside || (host?.contains(host.ownerDocument.activeElement) ?? false)
                this.closeActivatedInside = false
            }
            this.wasOpen = open
        }
        if (open) this.openedOnce = true
        const mounted = open || policy === 'eager' || policy === 'lazy' && this.openedOnce
        const Host = this.Host
        return <Host id={this.drawerId} role="region" aria-label={label} tabIndex={-1} hidden={!open}
            className={componentClass(this.props) || null} data-edge={edge} style={{'--drawer-size': size}}
            onKeyDown={(event: KeyboardEvent) => {
                if (open && event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); this.close()}
            }}>
            <header><strong>{label}</strong><Button icon="close" appearance="subtle"
                ariaLabel={this.props.closeLabel ?? this.capillaryUiMessage('drawerCloseLabel')}
                onClick={() => {
                    if (!this.openEmitter.get()) return
                    // Some platforms blur the input without focusing the clicked
                    // close button. Its explicit activation still belongs here.
                    this.closeActivatedInside = true; this.close()
                }}/></header>
            <div className="cap-drawer-body" data-scroll={scroll ? 'true' : 'false'}>{mounted ? this.props.children : null}</div>
        </Host>
    }
    close(): void { this.openEmitter.set(false, 'drawer close requested') }
    afterMount(): void { this.syncFocus() }
    afterUpdate(): void { this.syncFocus() }
    private syncFocus(): void {
        const entering = this.entering, closing = this.closing, restore = this.restoreFocus
        this.entering = false; this.closing = false; this.restoreFocus = false
        if (entering && this.openEmitter.get()) {
            const target = this.props.initialFocusRef?.current
            if (target?.isConnected && this.dom?.contains(target)) target.focus({preventScroll: true})
        }
        if (closing) {
            if (restore) this.restoreOpener()
            invoke(this.props.onClose)
        }
    }
    private restoreOpener(): void {
        const target = this.props.returnFocusRef?.current ?? this.opener
        if (target?.isConnected && !this.dom?.contains(target)) target.focus({preventScroll: true})
    }
    onDestroy(): void {
        const host = this.dom as HTMLElement | null
        if (host?.contains(host.ownerDocument.activeElement)) this.restoreOpener()
        if (!this.props.valueEmitter) (this.openEmitter as {dispose?: () => void}).dispose?.()
        this.opener = null
    }
    static override css = css`
        & { display: flex; flex: 0 1 auto; flex-direction: column; min-inline-size: 0; min-block-size: 0;
            max-inline-size: 100%; max-block-size: 100%; box-sizing: border-box;
            color: var(--panel-color); background: var(--panel-background); border: var(--panel-border); border-radius: var(--panel-radius); }
        &[hidden] { display: none; }
        &[data-edge="inline-start"], &[data-edge="block-start"] { order: -1; }
        &[data-edge="inline-end"], &[data-edge="block-end"] { order: 1; }
        &[data-edge="inline-start"], &[data-edge="inline-end"] { inline-size: var(--drawer-size); }
        &[data-edge="block-start"], &[data-edge="block-end"] { block-size: var(--drawer-size); }
        & > header { display: flex; flex: none; align-items: center; gap: .5rem; padding: .25rem .5rem; }
        & > header > strong { flex: 1; }
        & > .cap-drawer-body { display: flex; flex: 1 1 auto; flex-direction: column; min-block-size: 0; min-inline-size: 0; overflow: hidden; }
        & > .cap-drawer-body[data-scroll="true"] { overflow: auto; }
    `
}
