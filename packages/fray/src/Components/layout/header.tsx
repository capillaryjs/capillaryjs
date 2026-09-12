import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import type {FrayLayoutParticipantProps} from './layoutTraits.js'
import {controlId, layoutParticipantClass} from '../controlUtils.js'

export type HeaderLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeaderProps extends ComponentProps, FrayLayoutParticipantProps {
    id?: string | number | null
    headingId?: string | number | null
    level?: HeaderLevel
}

/** Styled heading surface with an explicit native heading level. */
export class Header extends Component<HeaderProps> {
    static override liveProps: readonly string[] = []
    readonly headerId: string
    readonly headingId: string

    constructor(props: HeaderProps = {}) {
        super(props)
        this.headerId = controlId('header', props.id)
        this.headingId = controlId('header-title', props.headingId ?? `${this.headerId}-title`)
    }

    render(): FrayChild {
        const {level = 2, children = []} = this.props
        if (!Number.isInteger(level) || level < 1 || level > 6) {
            throw new TypeError('Header level must be an integer from 1 to 6')
        }

        const Host = this.Host
        return <Host
            id={this.headerId}
            className={layoutParticipantClass(this.props) || null}
        >
            {(() => {
                const Heading = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
                return <Heading id={this.headingId}>{children}</Heading>
            })()}
        </Host>
    }

    static override hostName = 'header'

    static css = css`
        & {
            display: block;
            color: var(--section-header-color);
            border-radius: var(--ui-border-radius) var(--ui-border-radius) 0 0;
            padding: .25em;
            background: var(--section-header-background);
            box-shadow: var(--section-header-shadow);
            z-index: 1;
            user-select: none;
        }

        & > h1,
        & > h2,
        & > h3,
        & > h4,
        & > h5,
        & > h6 {
            margin: 0;
            font: inherit;
        }
    `
}
