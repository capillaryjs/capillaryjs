import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../component.js'
import {componentClass} from '../controlUtils.js'

const labelLiveProps = ['text'] as const

export interface LabelProps extends ComponentProps,
    LivePropContract<(typeof labelLiveProps)[number]> {
    id?: string | number | null
    text?: FrayChild
    htmlFor?: string
}

export class Label extends Component<LabelProps> {
    static override liveProps = labelLiveProps

    render(): FrayChild {
        const {text, htmlFor, children} = this.props
        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            for={htmlFor ?? null}
        >
            {text ?? children}
        </Host>
    }

    static override hostName = 'form-label'
    static override standaloneHostName = 'form-label'

    static css = css`
        & {
            display: block;
        }
    `
}
