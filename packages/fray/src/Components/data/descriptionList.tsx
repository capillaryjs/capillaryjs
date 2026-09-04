import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {classNames, componentClass} from '../controlUtils.js'

export interface DescriptionItemProps extends ComponentProps {
    term: FrayChild
    value?: FrayChild
}

/** A term/value group with standards-valid `dl` children. */
export class DescriptionItem extends Component<DescriptionItemProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const {term, value, children = []} = this.props
        return <div
            className={componentClass(this.props) || undefined}
            data-fray-component="description-item"
        >
            <dt>{term}</dt>
            <dd>{value ?? children}</dd>
        </div>
    }

    static css = css`
        div:has(> dt + dd) {
            display: grid;
            grid-template-columns: minmax(7rem, 0.7fr) minmax(0, 1.3fr);
            gap: var(--spacing-small, 0.5rem);
            padding-block: var(--spacing-small, 0.5rem);
        }

        div:has(> dt + dd) > dd {
            min-width: 0;
            margin: 0;
            overflow-wrap: anywhere;
        }

        @media (max-width: 36rem) {
            div:has(> dt + dd) {
                grid-template-columns: minmax(0, 1fr);
                gap: 0.15rem;
            }
        }
    `
}

export interface DescriptionListProps extends ComponentProps {
    label?: string
}

/** Semantic description-list container for compact record summaries. */
export class DescriptionList extends Component<DescriptionListProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        return <dl
            className={classNames('datacomponentlike', componentClass(this.props))}
            data-fray-component="description-list"
            aria-label={this.props.label}
        >{this.props.children ?? []}</dl>
    }

    static dependencies = [DescriptionItem]

    static css = css`
        dl:has(> div > dt + dd) {
            display: grid;
            margin: 0;
        }
    `
}
