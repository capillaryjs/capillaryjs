import {Component, css} from '../component.js'
import type {ComponentDependency, ComponentProps, CapillaryUiChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {Header} from './header.js'

export interface GroupBoxBaseProps extends ComponentProps {
    id?: string | number | null
}

export interface GroupBoxProps extends GroupBoxBaseProps {
    header: CapillaryUiChild
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

    render(): CapillaryUiChild {
        const {header, children = []} = this.props as TProps & GroupBoxProps
        return this.renderGroupBox(header, children)
    }

    protected renderGroupBox(header: CapillaryUiChild, content: CapillaryUiChild): CapillaryUiChild {
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
            <cap-content>{content}</cap-content>
        </Host>
    }

    static override hostName = 'group-box'
    static override dependencies: ComponentDependency[] = [Header]

    static css = css`
        & {
            display: flex;
            flex-flow: var(--cap-groupbox-flow, row nowrap);
            align-items: stretch;
            box-sizing: border-box;
            gap: var(--cap-groupbox-gap, 0 0.35rem);
            padding: var(--cap-groupbox-padding, 0.125rem 0.35rem 0.125rem 0.125rem);
            padding-top: var(--cap-groupbox-padding-top, .125rem);
            border: var(--cap-groupbox-border, 1px solid var(--ui-border-color));
            border-radius: var(--ui-border-radius);
            position: relative;
            min-width: 0;
            min-height: 0;
            flex: var(--cap-groupbox-flex, 0 1 auto);
        }

        & > cap-header {
            position: var(--cap-groupbox-header-position, static);
            left: var(--cap-groupbox-header-inset, auto);
            top: var(--cap-groupbox-header-inset, auto);
            display: grid;
            place-items: var(--cap-groupbox-header-align, center);
            box-sizing: border-box;
            width: var(--cap-groupbox-header-width, 1.7em);
            padding: var(--cap-groupbox-header-padding, 0.125em);
            border-radius: var(--ui-border-radius);
            color: var(--cap-groupbox-header-color, var(--section-header-color));
            background: var(--cap-groupbox-header-background, var(--section-header-background));
            box-shadow: var(--cap-groupbox-header-shadow, var(--section-header-shadow));
            writing-mode: var(--cap-groupbox-header-writing, vertical-rl);
            transform: var(--cap-groupbox-header-transform, rotate(180deg));
            font-weight: normal;
            font-size: var(--ui-font-size);
            min-width: 0;
            min-height: 0;
        }

        & > cap-content {
            display: block;
            min-width: 0;
            min-height: 0;
            margin-left: var(--cap-groupbox-content-margin, .25em);
            flex: 1 1 auto;
        }

        & > cap-content > cap-layout {
            gap: .5rem;
            justify-content: flex-start;
            align-content: flex-start;
            justify-items: flex-start;
            align-items: flex-start;
        }

        /* Presentation contexts: each marker sets the complete context-sensitive
           property set, so the nearest marked ancestor wins through ordinary
           custom-property inheritance. Unmarked containers keep the control
           defaults declared as var() fallbacks above. */
        [data-cap-context='control'] {
            --cap-groupbox-flow: row nowrap;
            --cap-groupbox-gap: 0 0.35rem;
            --cap-groupbox-padding: 0.125rem 0.35rem 0.125rem 0.125rem;
            --cap-groupbox-border: 1px solid var(--ui-border-color);
            --cap-groupbox-header-align: center;
            --cap-groupbox-header-width: 1.7em;
            --cap-groupbox-header-padding: 0.125em;
            --cap-groupbox-header-color: var(--section-header-color);
            --cap-groupbox-header-background: var(--section-header-background);
            --cap-groupbox-header-shadow: var(--section-header-shadow);
            --cap-groupbox-header-writing: vertical-rl;
            --cap-groupbox-header-transform: rotate(180deg);
            --cap-groupbox-content-margin: .25em;
            --cap-groupbox-flex: 0 1 auto;
            --cap-groupbox-grow-preference: 0;
            --cap-groupbox-inline-chrome: 0px;
            --cap-groupbox-padding-top: .125rem;
            --cap-groupbox-header-position: static;
            --cap-groupbox-header-inset: auto;
        }

        [data-cap-context='form'] {
            --cap-groupbox-flow: column nowrap;
            --cap-groupbox-gap: 0.25rem 0;
            --cap-groupbox-padding: 0.5rem;
            --cap-groupbox-border: 1px solid var(--ui-border-color);
            --cap-groupbox-header-align: center start;
            --cap-groupbox-header-width: auto;
            --cap-groupbox-header-padding: 2px 5px;
            --cap-groupbox-header-color: var(--text-color);
            --cap-groupbox-header-background: var(--panel-background);
            --cap-groupbox-header-shadow: none;
            --cap-groupbox-header-writing: horizontal-tb;
            --cap-groupbox-header-transform: none;
            --cap-groupbox-content-margin: 0;
            --cap-groupbox-flex: 1 1 min-content;
            --cap-groupbox-grow-preference: 1;
            --cap-groupbox-inline-chrome: calc(1rem + 2px);
            --cap-groupbox-padding-top: 1em;
            --cap-groupbox-header-position: absolute;
            --cap-groupbox-header-inset: calc(0px - var(--ui-font-size) / 2);
        }

        .cap-layout-horizontal > & {
            max-inline-size: max-content;
            min-inline-size: min-content;
        }

        /* Restore shrinkable fields before distributing decorative spare room
           to short groups. The intrinsic ceiling still freezes each group at
           its preferred content size; floors still determine line wrapping. */
        .cap-layout-horizontal > &:has(input:not([type='checkbox'], [type='radio'], [type='hidden']), select, textarea) {
            flex-grow: calc(var(--cap-groupbox-grow-preference, 0) * 10000);
        }

        /* An empty grid contributes zero to min-content and the soft preference
           to max-content. Real content may exceed it. No row height or runtime
           measurement is involved; field floors determine wrapping. */
        .cap-layout-horizontal > & > cap-content::after {
            content: "";
            display: grid;
            grid-template-columns: minmax(0, max(0px, calc(
                (var(--groupbox-preferred-width, 15rem) - var(--cap-groupbox-inline-chrome, 0px))
                * var(--cap-groupbox-grow-preference, 0)
            )));
            block-size: 0;
        }
    `
}
