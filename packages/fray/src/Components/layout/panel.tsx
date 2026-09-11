import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../component.js'
import type {FrayLayoutParticipantProps} from './layoutTraits.js'
import {Header} from './header.js'
import {DeclarativeRegion, readDeclarativeRegions} from './declarativeRegion.js'
import {controlId, layoutParticipantClass} from '../controlUtils.js'

const panelLiveProps = ['disabled'] as const

/** Toolbar content rendered between a Panel heading and its ordinary children. */
export class PanelToolbar extends DeclarativeRegion {}

export interface PanelProps extends ComponentProps,
    FrayLayoutParticipantProps,
    LivePropContract<(typeof panelLiveProps)[number]> {
    id?: string | number | null
    header?: FrayChild
    /** @deprecated Supply `<PanelToolbar>` as a direct child. */
    toolbar?: never
    orientation?: 'horizontal' | 'vertical'
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
            orientation = 'vertical',
            disabled = false,
        } = this.props
        const {content, regions} = readDeclarativeRegions('Panel', children, {
            toolbar: PanelToolbar,
        })
        if (!['horizontal', 'vertical'].includes(orientation)) {
            throw new TypeError('Panel orientation must be horizontal or vertical')
        }

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
            <fray-content className={orientation}>{content}</fray-content>
        </Host>
    }

    static override hostName = 'panel'
    static override dependencies = [Header, PanelToolbar]

    static css = css`
        & {
            background: var(--panel-background);
            border: var(--panel-border);
            border-radius: var(--panel-radius);
            box-shadow: var(--panel-shadow);
            color: var(--panel-color);
            display: flex;
            flex-direction: column;
            overflow: auto;
            flex: 0 0 auto;
        }

        & > fray-content {
            display: flex;
            flex: 1;
            overflow: auto;
            padding: var(--panel-padding, 0.75rem);
            gap: var(--spacing-medium, 1rem);
        }

        & > fray-content.horizontal {
            flex-direction: row;
        }

        & > fray-content.vertical {
            flex-direction: column;
        }

        &[aria-disabled="true"] {
            opacity: .65;
        }
    `
}
