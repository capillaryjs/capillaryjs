import {Component, css} from '../component.js'
import type {ComponentProps, CapillaryUiChild} from '../component.js'
import type {CapillaryUiLayoutParticipantProps} from './layoutTraits.js'
import {Header} from './header.js'
import {DeclarativeRegion, readDeclarativeRegions} from './declarativeRegion.js'
import {controlId, layoutParticipantClass} from '../controlUtils.js'

/** Toolbar content rendered between a Sidebar heading and its scrolling body. */
export class SidebarToolbar extends DeclarativeRegion {}

export interface SidebarProps extends ComponentProps, CapillaryUiLayoutParticipantProps {
    id?: string | number | null
    header?: CapillaryUiChild
    /** @deprecated Supply `<SidebarToolbar>` as a direct child. */
    toolbar?: never
    ariaLabel?: string
}

/** Labelled side region whose content owns vertical scrolling. */
export class Sidebar extends Component<SidebarProps> {
    static override liveProps: readonly string[] = []
    readonly sidebarId: string
    readonly headerId: string

    constructor(props: SidebarProps = {}) {
        super(props)
        this.sidebarId = controlId('sidebar', props.id)
        this.headerId = `${this.sidebarId}-title`
    }

    render(): CapillaryUiChild {
        if (this.props.toolbar != null) {
            throw new Error('Sidebar toolbar content must use a direct SidebarToolbar child')
        }
        const {
            header = null,
            ariaLabel,
            children = [],
        } = this.props
        const {content, regions} = readDeclarativeRegions('Sidebar', children, {
            toolbar: SidebarToolbar,
        })
        const Host = this.Host
        const title = header == null
            ? null
            : <Header
                id={`${this.sidebarId}-header`}
                headingId={this.headerId}
            >{header}</Header>

        return <Host className={layoutParticipantClass(this.props) || null}>
            <aside
                id={this.sidebarId}
                aria-label={header == null ? ariaLabel : null}
                aria-labelledby={header == null ? null : this.headerId}
            >
                {title}
                {regions.toolbar == null ? null : <cap-toolbarcontent>{regions.toolbar}</cap-toolbarcontent>}
                <cap-content tabIndex={0}>{content}</cap-content>
            </aside>
        </Host>
    }

    static override hostName = 'sidebar'
    static override dependencies = [Header, SidebarToolbar]

    static css = css`
        & {
            display: flex;
            min-width: 0;
            min-height: 0;
        }

        & > aside {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
        }

        & > aside > cap-header,
        & > aside > cap-toolbarcontent {
            flex: none;
        }

        & > aside > cap-toolbarcontent {
            min-width: 0;
            overflow-x: auto;
        }

        & > aside > cap-content {
            flex: 1;
            min-height: 0;
            overflow: auto;
        }
    `
}
