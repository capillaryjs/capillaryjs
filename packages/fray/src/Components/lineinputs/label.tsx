import {Component} from '../component.js'
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
        return <label
            className={componentClass(this.props) || undefined}
            htmlFor={htmlFor}
            data-fray-component="label"
        >
            {text ?? children}
        </label>
    }
}
