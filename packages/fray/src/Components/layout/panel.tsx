import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'

export interface PanelProps extends ComponentProps {
    id?: string | number | null
    header?: FrayChild
    toolbar?: FrayChild
    orientation?: 'horizontal' | 'vertical'
    disabled?: boolean
}

export class Panel extends Component<PanelProps> {
    readonly panelId: string
    readonly headerId: string

    constructor(props: PanelProps = {}) {
        super(props)
        this.panelId = controlId('panel', props.id)
        this.headerId = `${this.panelId}-title`
    }

    render() {
        const {
            header = null,
            toolbar = null,
            children = [],
            orientation = 'vertical',
            disabled = false,
        } = this.props
        if (!['horizontal', 'vertical'].includes(orientation)) {
            throw new TypeError('Panel orientation must be horizontal or vertical')
        }

        const Host = this.Host
        const title = header == null
            ? null
            : <header data-part="header">
                {typeof header === 'string' || typeof header === 'number'
                    ? <h2 id={this.headerId}>{header}</h2>
                    : <div id={this.headerId}>{header}</div>}
            </header>

        return <Host
            id={this.panelId}
            role={header == null ? null : 'region'}
            className={componentClass(this.props) || null}
            data-orientation={orientation}
            data-disabled={disabled ? '' : null}
            aria-disabled={disabled ? 'true' : null}
            aria-labelledby={header == null ? null : this.headerId}
        >
            {title}
            {toolbar}
            <div data-part="content" data-orientation={orientation}>{children}</div>
        </Host>
    }

    static override hostName = 'panel'
    static override standaloneHostName = 'layout-panel'

    static baseStyles = [
        ['&', ['panel']],
        ['& > [data-part="header"]', ['sectionheader']],
    ]

    static css = css`
        & {
            display: flex;
            flex-direction: column;
            overflow: auto;
            flex: 0 0 auto;
        }

        & > [data-part="header"] h2 {
            margin: 0;
            font: inherit;
        }

        & > [data-part="content"] {
            display: flex;
            flex: 1;
            overflow: auto;
            padding: var(--panel-padding, 0.75rem);
            gap: var(--spacing-medium, 1rem);
        }

        & > [data-part="content"][data-orientation="horizontal"] {
            flex-direction: row;
        }

        & > [data-part="content"][data-orientation="vertical"] {
            flex-direction: column;
        }
    `
}
