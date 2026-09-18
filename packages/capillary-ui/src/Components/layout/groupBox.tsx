import {Component, css} from '../component.js'
import type {ComponentDependency, ComponentProps, CapillaryUiChild} from '../component.js'
import {classNames, componentClass, controlId} from '../controlUtils.js'
import {Header} from './header.js'

/** Structural role of a GroupBox within a nested form section. */
export type GroupBoxVariant = 'section' | 'column'

export interface GroupBoxBaseProps extends ComponentProps {
    id?: string | number | null
    /** Optional structural section or column presentation. */
    variant?: GroupBoxVariant
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
        const variantClass = groupBoxVariantClass(this.props.variant)
        return <Host
            id={this.panelId}
            role="group"
            className={classNames(componentClass(this.props), variantClass) || null}
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
            display: flex;
            flex-flow: column nowrap;
            justify-content: flex-start;
            align-content: flex-start;
            align-items: flex-start;
            gap: var(--groupbox-content-gap, .5rem);
            min-width: 0;
            min-height: 0;
            margin-left: var(--cap-groupbox-content-margin, .25em);
            flex: 1 1 auto;
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
            --cap-groupbox-flex: 0 1 auto;
            --cap-groupbox-padding-top: 1em;
            --cap-groupbox-header-position: absolute;
            --cap-groupbox-header-inset: calc(0px - var(--ui-font-size) / 2);
        }

        .cap-layout-horizontal > & {
            max-inline-size: max-content;
            min-inline-size: min-content;
        }

        &.cap-groupbox-section {
            display: grid;
            grid-template-columns: max-content minmax(0, 1fr);
            grid-template-rows: max-content minmax(max-content, 1fr);
            align-self: stretch;
            align-items: start;
            gap: 0;
            padding: 0;
            padding-top: 0;
            border: 0;
            border-radius: 0;
            min-inline-size: 0;
            max-inline-size: none;
            flex: 0 0 auto;
        }

        &.cap-groupbox-section::before {
            content: "";
            grid-column: 2;
            grid-row: 1;
            align-self: center;
            border-block-start: var(--groupbox-section-separator);
        }

        &.cap-groupbox-section > cap-header {
            position: static;
            grid-column: 1;
            grid-row: 1;
            display: block;
            width: auto;
            min-width: 0;
            min-height: 0;
            padding: 0 0.5rem 0 0;
            border-radius: 0;
            color: var(--groupbox-section-header-color);
            background: transparent;
            box-shadow: none;
            writing-mode: horizontal-tb;
            transform: none;
            font-size: var(--groupbox-section-font-size, 1.2em);
            font-weight: 600;
        }

        &.cap-groupbox-section > cap-content {
            grid-column: 1 / -1;
            grid-row: 2;
            flex-flow: row nowrap;
            margin-left: 0;
            padding-block: 0.75rem;
            min-width: 0;
        }

        .cap-layout-horizontal > &.cap-groupbox-section {
            grid-template-columns: max-content minmax(0, 1fr);
            grid-template-rows: max-content minmax(max-content, 1fr);
        }

        .cap-layout-horizontal > &.cap-groupbox-section::before {
            grid-column: 1;
            grid-row: 2;
            justify-self: stretch;
            align-self: stretch;
            border-block-start: 0;
            border-inline-end: var(--groupbox-section-separator);
        }

        .cap-layout-horizontal > &.cap-groupbox-section > cap-header {
            padding: 0 0.5rem 0.5rem 0;
        }

        .cap-layout-horizontal > &.cap-groupbox-section > cap-content {
            grid-column: 2;
            grid-row: 1 / -1;
            padding-block: 0;
            padding-inline: 0.75rem;
            min-block-size: 0;
        }

        &.cap-groupbox-column {
            gap: 0;
            padding: 0 1rem;
            padding-top: 0;
            border: 0;
            border-radius: 0;
            flex: 0 1 auto;
        }

        &.cap-groupbox-column > cap-header {
            position: static;
            display: block;
            width: auto;
            min-width: 0;
            min-height: 0;
            padding: 0;
            margin-block-end: 0.75rem;
            border-radius: 0;
            color: var(--groupbox-column-header-color);
            background: transparent;
            box-shadow: none;
            writing-mode: horizontal-tb;
            transform: none;
            font-size: var(--ui-font-size);
            font-weight: 600;
        }

        &.cap-groupbox-column > cap-content {
            margin-left: 0;
        }

        /* A section's own content body is the ordinary horizontal column row.
           Preserve the same stretch, edge padding, and separators formerly
           provided when an application inserted a Layout just for that row. */
        &.cap-groupbox-section > cap-content > cap-groupbox.cap-groupbox-column {
            align-self: stretch;
        }

        &.cap-groupbox-section > cap-content > cap-groupbox.cap-groupbox-column
            + cap-groupbox.cap-groupbox-column {
            border-inline-start: var(--groupbox-column-separator);
        }

        &.cap-groupbox-section > cap-content > cap-groupbox.cap-groupbox-column:first-child {
            padding-inline-start: 0;
        }

        &.cap-groupbox-section > cap-content > cap-groupbox.cap-groupbox-column:last-child {
            padding-inline-end: 0;
        }

        .cap-layout-horizontal > &.cap-groupbox-column,
        .cap-layout-vertical > &.cap-groupbox-column {
            align-self: stretch;
        }

        .cap-layout-horizontal > &.cap-groupbox-column + &.cap-groupbox-column {
            border-inline-start: var(--groupbox-column-separator);
        }

        .cap-layout-horizontal > &.cap-groupbox-column:first-child {
            padding-inline-start: 0;
        }

        .cap-layout-horizontal > &.cap-groupbox-column:last-child {
            padding-inline-end: 0;
        }

        .cap-layout-vertical > &.cap-groupbox-column {
            padding-inline: 0;
            padding-block: 1rem;
        }

        .cap-layout-vertical > &.cap-groupbox-column + &.cap-groupbox-column {
            border-block-start: var(--groupbox-column-separator);
        }

        .cap-layout-vertical > &.cap-groupbox-column:first-child {
            padding-block-start: 0;
        }

        .cap-layout-vertical > &.cap-groupbox-column:last-child {
            padding-block-end: 0;
        }
    `
}

function groupBoxVariantClass(variant: GroupBoxVariant | undefined): string | undefined {
    if (variant == null) return undefined
    if (variant === 'section' || variant === 'column') return `cap-groupbox-${variant}`
    throw new TypeError('GroupBox variant must be section or column')
}
