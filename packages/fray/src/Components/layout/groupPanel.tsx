import {Component, css} from '../component.js'
import type {ComponentDependency, ComponentProps, FrayChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {Header} from './header.js'

export interface GroupPanelBaseProps extends ComponentProps {
    id?: string | number | null
}

export interface GroupPanelProps extends GroupPanelBaseProps {
    header: FrayChild
}

/** Bordered control group with a full-height vertical section header. */
export class GroupPanel<
    TProps extends GroupPanelBaseProps = GroupPanelProps,
> extends Component<TProps> {
    static override liveProps: readonly string[] = []
    readonly panelId: string
    readonly headerId: string

    constructor(props: TProps) {
        super(props)
        this.panelId = controlId('group-panel', props.id)
        this.headerId = `${this.panelId}-title`
    }

    render(): FrayChild {
        const {header, children = []} = this.props as TProps & GroupPanelProps
        return this.renderGroupPanel(header, children)
    }

    protected renderGroupPanel(header: FrayChild, content: FrayChild): FrayChild {
        const Host = this.Host
        return <Host
            id={this.panelId}
            role="group"
            className={componentClass(this.props) || null}
            aria-labelledby={this.headerId}
        >
            <Header
                id={`${this.panelId}-header`}
                headingId={this.headerId}
            >{header}</Header>
            <fray-content>{content}</fray-content>
        </Host>
    }

    static override hostName = 'group-panel'
    static override dependencies: ComponentDependency[] = [Header]

    static css = css`
        & {
            display: grid;
            grid-template-columns: 1.5rem minmax(0, 1fr);
            align-items: stretch;
            box-sizing: border-box;
            min-width: 0;
            min-height: 0;
            column-gap: 0.35rem;
            row-gap: 0;
            padding-block: 0.125rem;
            padding-inline: 0.125rem 0.35rem;
            border: 1px solid var(--ui-border-color);
            border-radius: var(--ui-border-radius);
        }

        & > fray-header {
            display: grid;
            place-items: center;
            box-sizing: border-box;
            width: 100%;
            min-width: 0;
            min-height: 0;
            padding: 0.125em;
            border-radius: var(--ui-border-radius);
        }

        & > fray-header > h1,
        & > fray-header > h2,
        & > fray-header > h3,
        & > fray-header > h4,
        & > fray-header > h5,
        & > fray-header > h6 {
            font-weight: 650;
            white-space: nowrap;
            writing-mode: vertical-rl;
            transform: rotate(180deg);
        }

        & > fray-content {
            display: block;
            min-width: 0;
            min-height: 0;
        }
    `
}
