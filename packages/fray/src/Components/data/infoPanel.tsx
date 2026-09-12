import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {Header} from '../layout/header.js'

export interface InfoFieldProps extends ComponentProps {
    label: FrayChild
    value?: FrayChild
}

/** A labeled key-value field rendered as native `dt`/`dd` pair. */
export class InfoField extends Component<InfoFieldProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const {label, value, children = []} = this.props
        return [
            <dt>{label}</dt>,
            <dd>{value ?? children}</dd>,
        ]
    }
}

export interface InfoPanelProps extends ComponentProps {
    id?: string | number | null
    title?: FrayChild
    label?: string
}

/** Bordered info panel with an optional heading and key-value field content. */
export class InfoPanel extends Component<InfoPanelProps> {
    static override liveProps: readonly string[] = []
    readonly panelId: string
    readonly headerId: string

    constructor(props: InfoPanelProps = {}) {
        super(props)
        this.panelId = controlId('info-panel', props.id)
        this.headerId = `${this.panelId}-title`
    }

    render(): FrayChild {
        const {title = null, label, children = []} = this.props
        const Host = this.Host
        const header = title == null
            ? null
            : <Header
                id={`${this.panelId}-header`}
                headingId={this.headerId}
            >{title}</Header>

        return <Host
            id={this.panelId}
            role={title == null ? null : 'region'}
            className={componentClass(this.props) || null}
            aria-labelledby={title == null ? null : this.headerId}
        >
            {header}
            <dl aria-label={label ?? null}>{children}</dl>
        </Host>
    }

    static override hostName = 'infopanel'
    static override dependencies = [Header, InfoField]

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
            user-select: none;
        }

        & > dl {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: var(--space-sm, 0.375rem) var(--space-md, 1rem);
            margin: 0;
            padding: var(--panel-padding, 0.75rem);
        }

        & > dl > dt {
            font-weight: 600;
            color: var(--info-panel-label-color, var(--ui-muted-text-color));
        }

        & > dl > dd {
            margin: 0;
        }
    `
}
