import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../component.js'
import type {FrayLayoutParticipantProps} from './layoutTraits.js'
import type {FrayOptionalLayoutDirectionProps} from './layoutTraits.js'
import {layoutDirectionFromProps} from './layoutTraits.js'
import {Header} from './header.js'
import {Layout} from './layout.js'
import {DeclarativeRegion, readDeclarativeRegions} from './declarativeRegion.js'
import {controlId, layoutParticipantClass} from '../controlUtils.js'

const panelLiveProps = ['disabled'] as const

/** Toolbar content rendered between a Panel heading and its ordinary children. */
export class PanelToolbar extends DeclarativeRegion {}

export type PanelProps = ComponentProps
& FrayLayoutParticipantProps
& FrayOptionalLayoutDirectionProps
& LivePropContract<(typeof panelLiveProps)[number]>
& {
    id?: string | number | null
    header?: FrayChild
    /** @deprecated Supply `<PanelToolbar>` as a direct child. */
    toolbar?: never
    /** @deprecated Use the `horizontal` or `vertical` boolean modifier. */
    orientation?: 'horizontal' | 'vertical'
    /** Make the Panel body its overflow owner. Defaults to true for compatibility. */
    scroll?: boolean
    disabled?: boolean
}

export class Panel extends Component<PanelProps> {
    static override liveProps = panelLiveProps
    readonly panelId: string
    readonly headerId: string

    constructor(props: PanelProps = {}) {
        super(props)
        this.panelId = controlId('panel', props.id)
        this.headerId = `${this.panelId}-title`
    }

    render() {
        if (this.props.toolbar != null) {
            throw new Error('Panel toolbar content must use a direct PanelToolbar child')
        }
        const {
            header = null,
            children = [],
            orientation,
            scroll = true,
            disabled = false,
        } = this.props
        const {content, regions} = readDeclarativeRegions('Panel', children, {
            toolbar: PanelToolbar,
        })
        if (orientation != null && !['horizontal', 'vertical'].includes(orientation)) {
            throw new TypeError('Panel orientation must be horizontal or vertical')
        }
        if (orientation != null
            && ((this.props.horizontal && orientation !== 'horizontal')
                || (this.props.vertical && orientation !== 'vertical'))) {
            throw new TypeError('Panel direction modifier conflicts with orientation')
        }
        const direction = layoutDirectionFromProps(
            this.props,
            orientation ?? 'vertical',
            'Panel',
        )

        const Host = this.Host
        const title = header == null
            ? null
            : <Header
                id={`${this.panelId}-header`}
                headingId={this.headerId}
            >{header}</Header>

        return <Host
            id={this.panelId}
            role={header == null ? null : 'region'}
            className={layoutParticipantClass(this.props)}
            aria-disabled={disabled ? 'true' : null}
            aria-labelledby={header == null ? null : this.headerId}
        >
            {title}
            {regions.toolbar ?? null}
            <Layout
                {...(direction === 'horizontal' ? {horizontal: true} : {vertical: true})}
                scroll={scroll}
                className="panel-content"
            >{content}</Layout>
        </Host>
    }

    static override hostName = 'panel'
    static override dependencies = [Header, Layout, PanelToolbar]

    static css = css`
        & {
            background: var(--panel-background);
            border: var(--panel-border);
            border-radius: var(--panel-radius);
            box-shadow: var(--panel-shadow);
            color: var(--panel-color);
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            flex: 0 0 auto;
        }

        & > fray-layout.panel-content {
            flex: 1 1 auto;
            min-width: 0;
            min-height: 0;
            padding: var(--panel-padding, 0.75rem);
            gap: var(--spacing-medium, 1rem);
        }

        &[aria-disabled="true"] {
            opacity: .65;
        }
    `
}
