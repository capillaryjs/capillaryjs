import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass} from '../controlUtils.js'

export interface DescriptionItemProps extends ComponentProps {
    term: FrayChild
    value?: FrayChild
}

/** A term/value group with standards-valid `dl` children. */
export class DescriptionItem extends Component<DescriptionItemProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const {term, value, children = []} = this.props
        return [
            <dt>{term}</dt>,
            <dd>{value ?? children}</dd>,
        ]
    }
}

export interface DescriptionListProps extends ComponentProps {
    label?: string
}

/** Semantic description-list container for compact record summaries. */
export class DescriptionList extends Component<DescriptionListProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <dl aria-label={this.props.label}>{this.props.children ?? []}</dl>
        </Host>
    }

    static override hostName = 'descriptionlist'

    static dependencies = [DescriptionItem]

    static css = css`
        & {
            display: block;
            user-select: none;
        }

        & > dl {
            display: grid;
            margin: 0;
        }
    `
}
