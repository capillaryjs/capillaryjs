import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
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
        const title = header == null
            ? null
            : <header>
                {typeof header === 'string' || typeof header === 'number'
                    ? <h2 id={this.headerId}>{header}</h2>
                    : <div id={this.headerId}>{header}</div>}
            </header>

        return <aside
            id={this.sidebarId}
            className={componentClass(this.props) || undefined}
            data-fray-component="sidebar"
            aria-label={header == null ? ariaLabel : null}
            aria-labelledby={header == null ? null : this.headerId}
        >
            {title}
            {toolbar == null ? null : <div data-part="toolbar">{toolbar}</div>}
            <div data-part="content" tabIndex={0}>{children}</div>
        </aside>
    }

    static css = css`
        aside {
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
        }

        aside > header,
        aside > [data-part="toolbar"] {
            flex: 0 0 auto;
        }

        aside > header h2 {
            margin: 0;
            font: inherit;
        }

        aside > [data-part="content"] {
            flex: 1 1 auto;
            min-width: 0;
            min-height: 0;
            overflow-x: hidden;
            overflow-y: auto;
        }
    `
}
