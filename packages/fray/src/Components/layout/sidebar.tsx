import {Component, css, h} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {Header} from './header.js'
import {componentClass, controlId} from '../controlUtils.js'

export interface SidebarProps extends ComponentProps {
    id?: string | number | null
    header?: FrayChild
    toolbar?: FrayChild
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

    render(): FrayChild {
        const {
            header = null,
            toolbar = null,
            ariaLabel,
            children = [],
        } = this.props
        const Host = this.Host
        const title = header == null
            ? null
            : <Header
                id={`${this.sidebarId}-header`}
                headingId={this.headerId}
            >{header}</Header>

        return <Host className={componentClass(this.props) || null}>
            <aside
                id={this.sidebarId}
                aria-label={header == null ? ariaLabel : null}
                aria-labelledby={header == null ? null : this.headerId}
            >
                {title}
                {toolbar == null ? null : h('fray-toolbarcontent', null, toolbar)}
                {h('fray-content', {tabIndex: 0}, children)}
            </aside>
        </Host>
    }

    static override hostName = 'sidebar'
    static override dependencies = [Header]

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

        & > aside > fray-header,
        & > aside > fray-toolbarcontent {
            flex: none;
        }

        & > aside > fray-content {
            flex: 1;
            min-height: 0;
            overflow: auto;
        }
    `
}
