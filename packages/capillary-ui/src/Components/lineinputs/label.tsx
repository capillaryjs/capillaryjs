import {Component} from '../component.js'
import type {ComponentProps, CapillaryUiChild, LivePropContract} from '../component.js'
import {componentClass} from '../controlUtils.js'

const labelLiveProps = ['text'] as const

export interface LabelProps extends ComponentProps,
    LivePropContract<(typeof labelLiveProps)[number]> {
    id?: string | number | null
    text?: CapillaryUiChild
    htmlFor?: string
}

export class Label extends Component<LabelProps> {
    static override liveProps = labelLiveProps

    render(): CapillaryUiChild {
        const {text, htmlFor, children} = this.props
        return <label
            className={componentClass(this.props) || undefined}
            htmlFor={htmlFor}
            data-cap-component="label"
        >
            {text ?? children}
        </label>
    }
}
