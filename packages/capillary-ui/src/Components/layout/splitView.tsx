import {Component, css, h, isVNode} from '../component.js'
import type {ComponentProps, CapillaryUiChild, VNode} from '../component.js'
import {classNames, componentClass, invoke} from '../controlUtils.js'
import {Layout} from './layout.js'
import type {LayoutContainerProps} from './layout.js'
import {
    layoutAllocationClassName,
    layoutDirectionFromProps,
} from './layoutTraits.js'
import type {
    CapillaryUiLayoutDirection,
    CapillaryUiOptionalLayoutDirectionProps,
    CapillaryUiLayoutParticipantProps,
} from './layoutTraits.js'

export type SplitPaneProps = Omit<LayoutContainerProps, 'allocation'> & {
    /** Pane allocation is owned by SplitView. */
    allocation?: never
    /** Accessible region name for this pane. */
    label?: string
}

abstract class SplitPane extends Layout<SplitPaneProps> {
    override render(): CapillaryUiChild {
        if ((this.props as LayoutContainerProps).allocation != null) {
            throw new TypeError('SplitView owns SplitPrimary and SplitSecondary allocation')
        }
        return super.render()
    }

    protected override defaultDirection(): CapillaryUiLayoutDirection {
        return 'vertical'
    }

    protected override defaultScroll(): boolean {
        return true
    }

    protected override hostAccessibilityProps(): {
        role: string | null
        'aria-label': string | null
        tabIndex: number | null
    } {
        const {label, scroll} = this.props
        const scrolls = scroll ?? this.defaultScroll()
        return {
            role: label == null ? null : 'region',
            'aria-label': label ?? null,
            tabIndex: scrolls ? 0 : null,
        }
    }
}

/** Named Layout pane whose size is controlled by its parent SplitView. */
export class SplitPrimary extends SplitPane {
    static override hostName = 'primary'
}

/** Named Layout pane that receives the SplitView's remaining space. */
export class SplitSecondary extends SplitPane {
    static override hostName = 'secondary'
}

export type SplitViewProps = ComponentProps
& CapillaryUiOptionalLayoutDirectionProps
& CapillaryUiLayoutParticipantProps
& {
    /** @deprecated Supply `<SplitPrimary>` as a direct child. */
    primary?: never
    /** @deprecated Supply `<SplitSecondary>` as a direct child. */
    secondary?: never
    /** @deprecated Use the `horizontal` or `vertical` boolean modifier. */
    direction?: 'horizontal' | 'vertical'
    /** Initial primary-pane size as a non-empty CSS size. */
    primarySize?: string
    /** @deprecated Put `label` on `<SplitPrimary>`. */
    primaryLabel?: string
    /** @deprecated Put `label` on `<SplitSecondary>`. */
    secondaryLabel?: string
    /** Minimum primary-pane size in CSS pixels. */
    primaryMinSize?: number
    /** Minimum secondary-pane size in CSS pixels. */
    secondaryMinSize?: number
    /** Keyboard resize increment in CSS pixels. */
    resizeStep?: number
    /** Accessible name for the resize separator. */
    separatorLabel?: string
    /** Enable separator interaction. Defaults to true. */
    resizable?: boolean
    /** Receives the current primary-pane pixel size after an interaction. */
    onResize?: (primarySize: string, event: PointerEvent | KeyboardEvent) => void
}

interface PointerResize {
    pointerId: number
    startCoordinate: number
    startSize: number
}

/** Resizable two-pane layout with named Layout children and an accessible separator. */
export class SplitView extends Component<SplitViewProps> {
    static override liveProps: readonly string[] = []
    private pointerResize: PointerResize | null = null
    private primarySizeOverride: string | null = null

    override setProps(nextProps: SplitViewProps): this {
        if (nextProps.primarySize !== this.props.primarySize) this.primarySizeOverride = null
        return super.setProps(nextProps)
    }

    render(): CapillaryUiChild {
        if (this.props.primary != null || this.props.secondary != null) {
            throw new Error('SplitView pane content must use direct SplitPrimary and SplitSecondary children')
        }
        const {
            direction,
            primarySize,
            primaryLabel,
            secondaryLabel,
            primaryMinSize = 96,
            secondaryMinSize = 96,
            resizeStep = 16,
            separatorLabel = this.capillaryUiMessage('splitViewSeparatorLabel'),
            resizable = true,
        } = this.props
        if (direction != null && !['horizontal', 'vertical'].includes(direction)) {
            throw new TypeError('SplitView direction must be horizontal or vertical')
        }
        if (direction != null
            && ((this.props.horizontal && direction !== 'horizontal')
                || (this.props.vertical && direction !== 'vertical'))) {
            throw new TypeError('SplitView direction modifier conflicts with direction')
        }
        const axis = layoutDirectionFromProps(this.props, direction ?? 'horizontal', 'SplitView')
        validateCSSSize(primarySize, 'primarySize')
        validateNonNegativeNumber(primaryMinSize, 'primaryMinSize')
        validateNonNegativeNumber(secondaryMinSize, 'secondaryMinSize')
        validatePositiveNumber(resizeStep, 'resizeStep')

        const {primary, secondary} = readSplitPanes(this.props.children)
        const Host = this.Host
        return <Host
            className={classNames(
                componentClass(this.props),
                layoutAllocationClassName(this.props.allocation),
                axis,
            ) || null}
            style={{
                '--split-primary-size': this.primarySizeOverride ?? primarySize ?? '40%',
                '--split-primary-min-size': `${primaryMinSize}px`,
                '--split-secondary-min-size': `${secondaryMinSize}px`,
            }}
            data-resizable={resizable ? 'true' : 'false'}
        >
            {withFallbackLabel(primary, primaryLabel)}
            <cap-separator
                role="separator"
                aria-label={separatorLabel}
                aria-orientation={axis === 'horizontal' ? 'vertical' : 'horizontal'}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="40"
                aria-disabled={resizable ? null : 'true'}
                tabIndex={resizable ? 0 : null}
                {...(resizable ? {
                    onPointerDown: this.handlePointerDown,
                    onPointerMove: this.handlePointerMove,
                    onPointerUp: this.handlePointerEnd,
                    onPointerCancel: this.handlePointerEnd,
                    onKeyDown: this.handleKeyDown,
                } : {})}
            />
            {withFallbackLabel(secondary, secondaryLabel)}
        </Host>
    }

    override afterMount(): void {
        this.updateSeparatorValue()
    }

    override afterUpdate(): void {
        this.updateSeparatorValue()
    }

    private readonly handlePointerDown = (event: PointerEvent & {currentTarget: HTMLElement}): void => {
        if (event.button !== 0) return
        const primary = this.primaryElement()
        if (primary == null) return
        const axis = this.axis()
        this.pointerResize = {
            pointerId: event.pointerId,
            startCoordinate: axis === 'horizontal' ? event.clientX : event.clientY,
            startSize: this.primaryExtent(primary),
        }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        event.preventDefault()
    }

    private readonly handlePointerMove = (
        event: PointerEvent & {currentTarget: HTMLElement},
    ): void => {
        const resize = this.pointerResize
        if (resize == null || resize.pointerId !== event.pointerId) return
        const coordinate = this.axis() === 'horizontal' ? event.clientX : event.clientY
        this.resizeTo(resize.startSize + (coordinate - resize.startCoordinate) * this.axisSign(), event)
        event.preventDefault()
    }

    private readonly handlePointerEnd = (event: PointerEvent & {currentTarget: HTMLElement}): void => {
        if (this.pointerResize?.pointerId !== event.pointerId) return
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        this.pointerResize = null
    }

    private readonly handleKeyDown = (
        event: KeyboardEvent & {currentTarget: HTMLElement},
    ): void => {
        const axis = this.axis()
        const reversed = this.axisSign() < 0
        const decreaseKey = axis === 'horizontal' ? (reversed ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp'
        const increaseKey = axis === 'horizontal' ? (reversed ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown'
        const primary = this.primaryElement()
        if (primary == null) return
        let next: number
        if (event.key === decreaseKey) {
            next = this.primaryExtent(primary) - this.resizeIncrement(event)
        } else if (event.key === increaseKey) {
            next = this.primaryExtent(primary) + this.resizeIncrement(event)
        } else if (event.key === 'Home') {
            next = this.props.primaryMinSize ?? 96
        } else if (event.key === 'End') {
            next = Number.POSITIVE_INFINITY
        } else {
            return
        }
        this.resizeTo(next, event)
        event.preventDefault()
    }

    private resizeTo(requestedSize: number, event: PointerEvent | KeyboardEvent): void {
        const host = this.hostElement()
        const separator = this.separatorElement()
        if (host == null || separator == null) return
        const horizontal = this.axis() === 'horizontal'
        const extent = this.contentExtent(host)
        const separatorBounds = separator.getBoundingClientRect()
        const separatorExtent = horizontal ? separatorBounds.width : separatorBounds.height
        const primaryMin = this.props.primaryMinSize ?? 96
        const secondaryMin = this.props.secondaryMinSize ?? 96
        const maximum = Math.max(primaryMin, extent - separatorExtent - secondaryMin)
        const size = Math.min(Math.max(requestedSize, primaryMin), maximum)
        const value = `${Math.round(size * 100) / 100}px`
        this.primarySizeOverride = value
        host.style.setProperty('--split-primary-size', value)
        this.updateSeparatorValue()
        invoke(this.props.onResize, value, event)
    }

    private resizeIncrement(event: KeyboardEvent): number {
        return (this.props.resizeStep ?? 16) * (event.shiftKey ? 4 : 1)
    }

    private primaryExtent(primary: HTMLElement): number {
        const bounds = primary.getBoundingClientRect()
        const style = primary.ownerDocument.defaultView?.getComputedStyle(primary)
        // Scrollports can extend into a managed gutter. Resize the allocated
        // pane, excluding that paint space, rather than its expanded clip box.
        return this.axis() === 'horizontal'
            ? bounds.width + (parseFloat(style?.marginLeft ?? '') || 0) + (parseFloat(style?.marginRight ?? '') || 0)
            : bounds.height + (parseFloat(style?.marginTop ?? '') || 0) + (parseFloat(style?.marginBottom ?? '') || 0)
    }

    private updateSeparatorValue(): void {
        const host = this.hostElement()
        const primary = this.primaryElement()
        const separator = this.separatorElement()
        if (host == null || primary == null || separator == null) return
        const horizontal = this.axis() === 'horizontal'
        const separatorBounds = separator.getBoundingClientRect()
        const total = this.contentExtent(host)
            - (horizontal ? separatorBounds.width : separatorBounds.height)
        if (total <= 0) return
        const percentage = Math.round((this.primaryExtent(primary) / total) * 100)
        separator.setAttribute('aria-valuenow', String(percentage))
        separator.setAttribute('aria-valuetext', `${percentage}% primary pane`)
    }

    private axis(): CapillaryUiLayoutDirection {
        return layoutDirectionFromProps(
            this.props,
            this.props.direction ?? 'horizontal',
            'SplitView',
        )
    }

    private axisSign(): number {
        const host = this.hostElement()
        return this.axis() === 'horizontal' && host != null
            && host.ownerDocument.defaultView?.getComputedStyle(host).direction === 'rtl' ? -1 : 1
    }

    private contentExtent(host: HTMLElement): number {
        const style = host.ownerDocument.defaultView?.getComputedStyle(host)
        return this.axis() === 'horizontal'
            ? host.clientWidth - (parseFloat(style?.paddingLeft ?? '') || 0) - (parseFloat(style?.paddingRight ?? '') || 0)
            : host.clientHeight - (parseFloat(style?.paddingTop ?? '') || 0) - (parseFloat(style?.paddingBottom ?? '') || 0)
    }

    private hostElement(): HTMLElement | null {
        return this.dom instanceof HTMLElement ? this.dom : null
    }

    private primaryElement(): HTMLElement | null {
        return this.hostElement()?.querySelector(':scope > cap-primary') ?? null
    }

    private separatorElement(): HTMLElement | null {
        return this.hostElement()?.querySelector(':scope > cap-separator') ?? null
    }

    static override hostName = 'split-view'
    static override dependencies = [SplitPrimary, SplitSecondary]

    static css = css`
        & {
            display: flex;
            flex: 1 1 auto;
            min-width: 0;
            min-height: 0;
        }

        & > * {
            --_cap-island-gutter: calc(var(--_cap-island-flow, 0) * var(--island-gap, 0px) / 2);
        }

        &.horizontal {
            flex-direction: row;
        }

        &.vertical {
            flex-direction: column;
        }

        & > cap-primary {
            flex: 0 0 var(--split-primary-size, 40%);
        }

        & > cap-secondary {
            flex: 1 1 0;
        }

        /* Pane sizes describe content allocation. The compensated scrollport
         * padding must stay outside that size, even on an explicit islands scope. */
        & > cap-primary.cap-scroll:not(.island),
        & > cap-secondary.cap-scroll:not(.island) {
            box-sizing: content-box;
        }

        &.horizontal > cap-primary {
            min-inline-size: var(--split-primary-min-size, 96px);
        }

        &.horizontal > cap-secondary {
            min-inline-size: var(--split-secondary-min-size, 96px);
        }

        &.vertical > cap-primary {
            min-block-size: var(--split-primary-min-size, 96px);
        }

        &.vertical > cap-secondary {
            min-block-size: var(--split-secondary-min-size, 96px);
        }

        & > cap-separator {
            position: relative;
            flex: none;
            box-sizing: border-box;
            background: var(--_cap-island-separator-background, var(--ui-border-color));
            touch-action: none;
            user-select: none;
            z-index: 1;
        }

        /* Keep a pointer target even when a flush theme gives the track zero
         * size. This area overlaps pane edges and never changes allocation. */
        & > cap-separator::before {
            content: '';
            position: absolute;
        }

        & > cap-separator::after {
            content: '';
            position: absolute;
            border-radius: 999px;
            background: currentColor;
            opacity: 0;
        }

        & > cap-separator:hover::after,
        & > cap-separator:focus-visible::after {
            opacity: .45;
        }

        &.horizontal > cap-separator {
            inline-size: calc((1 - var(--_cap-island-flow, 0)) * .45rem
                + var(--_cap-island-flow, 0) * var(--island-gap, 0px));
            cursor: col-resize;
        }

        &.horizontal > cap-separator::before {
            inset-block: 0;
            left: 50%;
            width: max(100%, .45rem);
            transform: translateX(-50%);
        }

        &.horizontal > cap-separator::after {
            inset-block: 35%;
            left: 50%;
            width: 3px;
            transform: translateX(-50%);
        }

        &.vertical > cap-separator {
            block-size: calc((1 - var(--_cap-island-flow, 0)) * .45rem
                + var(--_cap-island-flow, 0) * var(--island-gap, 0px));
            cursor: row-resize;
        }

        &.vertical > cap-separator::before {
            inset-inline: 0;
            top: 50%;
            height: max(100%, .45rem);
            transform: translateY(-50%);
        }

        &.vertical > cap-separator::after {
            inset-inline: 35%;
            top: 50%;
            height: 3px;
            transform: translateY(-50%);
        }

        &[data-resizable="false"] > cap-separator {
            cursor: default;
        }
    `
}

function readSplitPanes(children: ComponentProps['children']): {
    primary: VNode<SplitPaneProps>
    secondary: VNode<SplitPaneProps>
} {
    let primary: VNode<SplitPaneProps> | null = null
    let secondary: VNode<SplitPaneProps> | null = null
    const values = flattenChildren(children)
    for (const child of values) {
        if (!isVNode(child)) {
            throw new Error('SplitView accepts only direct SplitPrimary and SplitSecondary children')
        }
        if (child.type === SplitPrimary) {
            if (primary != null) throw new Error('SplitView received duplicate SplitPrimary')
            primary = child as VNode<SplitPaneProps>
        } else if (child.type === SplitSecondary) {
            if (secondary != null) throw new Error('SplitView received duplicate SplitSecondary')
            secondary = child as VNode<SplitPaneProps>
        } else {
            throw new Error('SplitView accepts only direct SplitPrimary and SplitSecondary children')
        }
    }
    if (primary == null) throw new Error('SplitView requires SplitPrimary')
    if (secondary == null) throw new Error('SplitView requires SplitSecondary')
    return {primary, secondary}
}

function flattenChildren(children: ComponentProps['children']): CapillaryUiChild[] {
    const flattened: CapillaryUiChild[] = []
    const visit = (value: CapillaryUiChild | readonly CapillaryUiChild[]): void => {
        if (Array.isArray(value)) {
            for (const child of value) visit(child)
        } else if (value != null && value !== false && value !== true) {
            flattened.push(value)
        }
    }
    visit(children ?? [])
    return flattened
}

function withFallbackLabel(
    pane: VNode<SplitPaneProps>,
    fallback: string | undefined,
): VNode<SplitPaneProps> {
    if (fallback == null || pane.props.label != null) return pane
    const {children, ...props} = pane.props
    return h(pane.type as typeof SplitPrimary, {
        ...props,
        key: pane.key,
        label: fallback,
    }, children) as VNode<SplitPaneProps>
}

function validateCSSSize(value: string | undefined, name: string): void {
    if (value != null && (typeof value !== 'string' || value.length === 0)) {
        throw new TypeError(`SplitView ${name} must be a non-empty CSS size`)
    }
}

function validateNonNegativeNumber(value: number, name: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`SplitView ${name} must be a finite non-negative number`)
    }
}

function validatePositiveNumber(value: number, name: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new TypeError(`SplitView ${name} must be a finite positive number`)
    }
}
