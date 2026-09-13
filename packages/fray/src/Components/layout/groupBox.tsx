import {Component, css} from '../component.js'
import type {ComponentDependency, ComponentProps, FrayChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {Header} from './header.js'

export interface GroupBoxBaseProps extends ComponentProps {
    id?: string | number | null
}

export interface GroupBoxProps extends GroupBoxBaseProps {
    header: FrayChild
}

/** Bordered control group with a full-height vertical section header. */
export class GroupBox<
    TProps extends GroupBoxBaseProps = GroupBoxProps,
> extends Component<TProps> {
    static override liveProps: readonly string[] = []
    readonly panelId: string
    readonly headerId: string

    constructor(props: TProps) {
        super(props)
        this.panelId = controlId('group-box', props.id)
        this.headerId = `${this.panelId}-title`
    }

    render(): FrayChild {
        const {header, children = []} = this.props as TProps & GroupBoxProps
        return this.renderGroupBox(header, children)
    }

    protected renderGroupBox(header: FrayChild, content: FrayChild): FrayChild {
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

    static override hostName = 'group-box'
    static override dependencies: ComponentDependency[] = [Header]

    static css = css`
        & {
            display: flex;
            flex-flow: var(--fray-groupbox-flow, row nowrap);
            align-items: stretch;
            box-sizing: border-box;
            min-width: 0;
            min-height: 0;
            gap: var(--fray-groupbox-gap, 0 0.35rem);
            padding: var(--fray-groupbox-padding, 0.125rem 0.35rem 0.125rem 0.125rem);
            border: var(--fray-groupbox-border, 1px solid var(--ui-border-color));
            border-radius: var(--ui-border-radius);
        }

        & > fray-header {
            display: grid;
            place-items: var(--fray-groupbox-header-align, center);
            box-sizing: border-box;
            width: var(--fray-groupbox-header-width, 1.7em);
            min-width: 0;
            min-height: 0;
            padding: var(--fray-groupbox-header-padding, 0.125em);
            border-radius: var(--ui-border-radius);
            background: var(--fray-groupbox-header-background, var(--section-header-background));
            box-shadow: var(--fray-groupbox-header-shadow, var(--section-header-shadow));
            writing-mode: var(--fray-groupbox-header-writing, vertical-rl);
            transform: var(--fray-groupbox-header-transform, rotate(180deg));
            font-weight: normal;
            font-size: var(--ui-font-size);
        }

        & > fray-content {
            display: block;
            min-width: 0;
            min-height: 0;
            margin-left: var(--fray-groupbox-content-margin, .25em);
        }

        /* Presentation contexts: each marker sets the complete context-sensitive
           property set, so the nearest marked ancestor wins through ordinary
           custom-property inheritance. Unmarked containers keep the control
           defaults declared as var() fallbacks above. */
        [data-fray-context='control'] {
            --fray-groupbox-flow: row nowrap;
            --fray-groupbox-gap: 0 0.35rem;
            --fray-groupbox-padding: 0.125rem 0.35rem 0.125rem 0.125rem;
            --fray-groupbox-border: 1px solid var(--ui-border-color);
            --fray-groupbox-header-align: center;
            --fray-groupbox-header-width: 1.7em;
            --fray-groupbox-header-padding: 0.125em;
            --fray-groupbox-header-background: var(--section-header-background);
            --fray-groupbox-header-shadow: var(--section-header-shadow);
            --fray-groupbox-header-writing: vertical-rl;
            --fray-groupbox-header-transform: rotate(180deg);
            --fray-groupbox-content-margin: .25em;
        }

        [data-fray-context='form'] {
            --fray-groupbox-flow: column nowrap;
            --fray-groupbox-gap: 0.25rem 0;
            --fray-groupbox-padding: 0;
            --fray-groupbox-border: none;
            --fray-groupbox-header-align: center start;
            --fray-groupbox-header-width: auto;
            --fray-groupbox-header-padding: 0;
            --fray-groupbox-header-background: none;
            --fray-groupbox-header-shadow: none;
            --fray-groupbox-header-writing: horizontal-tb;
            --fray-groupbox-header-transform: none;
            --fray-groupbox-content-margin: 0;
        }
    `
}
