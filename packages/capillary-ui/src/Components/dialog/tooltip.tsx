import {Emitter} from '@capillaryjs/capillary'
import {Component, css} from '../component.js'
import type {CapillaryUiChild, ComponentProps} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {Popover} from './popover.js'
import type {PopoverProps} from './popover.js'

export interface TooltipTriggerProps {
    ariaDescribedBy: string
    triggerRef: (element: HTMLElement | null) => void
}
export interface TooltipProps extends ComponentProps {
    text: string
    trigger: (props: TooltipTriggerProps) => CapillaryUiChild
    /** Supplemental text appears after this delay on hover or focus. Default 350 ms. */
    delayMs?: number
    id?: string
    children?: never
}
interface TooltipSurfaceProps extends PopoverProps {
    text: string
    enter: () => void
    leave: () => void
}
class TooltipSurface extends Popover<TooltipSurfaceProps> {
    static override hostName = 'tooltipsurface'
    protected override get surfaceRole(): 'tooltip' { return 'tooltip' }
    protected override get popoverMode(): 'manual' { return 'manual' }
    protected override get surfaceLabel(): null { return null }
    protected override get restoreFocusOnClose(): boolean { return false }
    protected override focusOnOpen(): void { /* Supplemental text never receives focus. */ }
    protected override renderSurfaceContent(): CapillaryUiChild { return this.props.text }
    override afterMount(): void {
        super.afterMount()
        if (this.panel) {
            this.listen(this.panel, 'pointerenter', () => this.props.enter())
            this.listen(this.panel, 'pointerleave', () => this.props.leave())
        }
    }
    static override css = css`
        & > [popover] { max-inline-size: min(22rem, calc(100vw - 1rem)); padding: .4rem .6rem; }
    `
}

/** Noninteractive supplemental text; the trigger retains its own accessible name. */
export class Tooltip extends Component<TooltipProps> {
    static override hostName = 'tooltip'
    static override dependencies = [TooltipSurface]
    readonly tooltipId: string
    private readonly open = new Emitter(false, {owner: this, purpose: 'tooltip visibility'})
    private triggerElement: HTMLElement | null = null
    private detachTrigger: Array<() => void> = []
    private hover = false
    private focus = false
    private overTip = false
    private dismissed = false
    private disposed = false
    private detachEscape: (() => void) | null = null
    private showTimer: ReturnType<typeof setTimeout> | null = null
    private closeTimer: ReturnType<typeof setTimeout> | null = null
    constructor(props: TooltipProps) {
        super(props)
        this.tooltipId = controlId('tooltip', props.id)
        this.validate()
    }
    initialize(): void { this.watch(this.open) }
    private validate(): void {
        if (typeof this.props.text !== 'string' || !this.props.text.trim()) throw new TypeError('Tooltip requires nonempty plain text')
        if (typeof this.props.trigger !== 'function') throw new TypeError('Tooltip requires a trigger factory')
        const delay = this.props.delayMs ?? 350
        if (!Number.isFinite(delay) || delay < 0) throw new RangeError('Tooltip delayMs must be non-negative and finite')
    }
    private readonly captureTrigger = (element: HTMLElement | null): void => {
        if (element === this.triggerElement) return
        this.clearTimers()
        for (const detach of this.detachTrigger.splice(0)) detach()
        this.triggerElement = element
        this.hover = false; this.overTip = false; this.focus = false; this.dismissed = false
        this.open.set(false)
        if (!element || this.disposed) return
        this.focus = element.contains(element.ownerDocument.activeElement)
        this.detachTrigger.push(
            this.listenWhile(element, 'pointerenter', () => {this.hover = true; this.reconcile()}),
            this.listenWhile(element, 'pointerleave', () => {this.hover = false; this.reconcile()}),
            this.listenWhile(element, 'focusin', () => {this.focus = true; this.reconcile()}),
            this.listenWhile<FocusEvent>(element, 'focusout', event => {
                if (element.contains(event.relatedTarget as Node | null)) return
                this.focus = false; this.reconcile()
            }),
        )
        queueMicrotask(() => {if (!this.disposed && this.triggerElement === element) {this.update(); this.reconcile()}})
    }
    render(): CapillaryUiChild {
        this.validate()
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            {this.props.trigger({ariaDescribedBy: this.tooltipId, triggerRef: this.captureTrigger})}
            <TooltipSurface id={this.tooltipId} label={this.props.text} text={this.props.text}
                anchor={this.triggerElement} valueEmitter={this.open}
                enter={() => {this.overTip = true; this.reconcile()}}
                leave={() => {this.overTip = false; this.reconcile()}}
                onClose={() => {if (!this.disposed && (this.hover || this.focus)) this.dismissed = true}}/>
        </Host>
    }
    afterMount(): void { this.syncEscape() }
    afterUpdate(): void { this.syncEscape() }
    private syncEscape(): void {
        if (!this.open.get()) {this.detachEscape?.(); this.detachEscape = null; return}
        const doc = this.triggerElement?.ownerDocument
        if (doc && !this.detachEscape) this.detachEscape = this.listenWhile<KeyboardEvent>(doc, 'keydown', event => {
            if (event.key !== 'Escape' || !this.open.get() || event.defaultPrevented) return
            event.preventDefault(); event.stopPropagation()
            this.dismissed = true; this.clearTimers(); this.open.set(false)
        }, true)
    }
    private reconcile(): void {
        const interested = this.hover || this.focus || this.overTip
        if (!interested) this.dismissed = false
        if (interested && !this.dismissed && this.triggerElement?.isConnected) {
            if (this.closeTimer != null) clearTimeout(this.closeTimer)
            this.closeTimer = null
            if (this.open.get() || this.showTimer != null) return
            this.showTimer = setTimeout(() => {
                this.showTimer = null
                if (!this.disposed && this.triggerElement?.isConnected && !this.dismissed && (this.hover || this.focus || this.overTip)) this.open.set(true)
            }, this.props.delayMs ?? 350)
        } else {
            if (this.showTimer != null) clearTimeout(this.showTimer)
            this.showTimer = null
            if (this.closeTimer == null && this.open.get()) this.closeTimer = setTimeout(() => {
                this.closeTimer = null
                if (!this.disposed) this.open.set(false)
            }, 120)
        }
    }
    private clearTimers(): void {
        if (this.showTimer != null) clearTimeout(this.showTimer)
        if (this.closeTimer != null) clearTimeout(this.closeTimer)
        this.showTimer = null; this.closeTimer = null
    }
    onDestroy(): void {
        this.disposed = true
        this.clearTimers()
        for (const detach of this.detachTrigger.splice(0)) detach()
        this.triggerElement = null; this.open.dispose()
    }
    static override css = css`& { display: contents; }`
}
