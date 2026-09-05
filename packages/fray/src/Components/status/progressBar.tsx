import type {ReadableEmitter} from '@sylwellsoftware/glue'

import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'

export interface ProgressBarProps extends ComponentProps {
    id?: string | number | null
    label: FrayChild
    value?: number | null
    valueEmitter?: ReadableEmitter<number | null, unknown>
    max?: number
    valueText?: string
}

/** Labelled native progress indicator with determinate and indeterminate modes. */
export class ProgressBar extends Component<ProgressBarProps> {
    static override liveProps: readonly string[] = []
    readonly progressId: string

    constructor(props: ProgressBarProps) {
        super(props)
        this.progressId = controlId('progress', props.id)
        if (props.valueEmitter != null && !isReadableEmitter(props.valueEmitter)) {
            throw new TypeError('ProgressBar valueEmitter must be a readable emitter')
        }
    }

    render(): FrayChild {
        const max = this.props.max ?? 100
        if (!Number.isFinite(max) || max <= 0) {
            throw new RangeError('ProgressBar max must be a positive finite number')
        }
        const sourceValue = this.props.valueEmitter == null
            ? (this.props.value ?? null)
            : this.read(this.props.valueEmitter)
        if (sourceValue != null && (!Number.isFinite(sourceValue) || sourceValue < 0)) {
            throw new RangeError('ProgressBar value must be null or a non-negative finite number')
        }
        const value = sourceValue == null ? null : Math.min(sourceValue, max)
        const valueText = this.props.valueText ?? (value == null
            ? 'In progress'
            : `${Math.round(value / max * 100)}%`)
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <div data-part="label-line">
                <label htmlFor={this.progressId}>{this.props.label}</label>
                <output>{valueText}</output>
            </div>
            <progress
                id={this.progressId}
                value={value == null ? undefined : value}
                max={max}
                aria-valuetext={valueText}
            >{valueText}</progress>
        </Host>
    }

    static override hostName = 'progress-bar'

    static css = css`
        & {
            display: grid;
            gap: var(--spacing-small, 0.5rem);
        }

        & > [data-part="label-line"] {
            display: flex;
            justify-content: space-between;
            gap: var(--spacing-medium, 1rem);
        }

        & > progress {
            width: 100%;
            min-height: 0.8rem;
        }

        @media (forced-colors: active) {
            & > progress {
                forced-color-adjust: auto;
            }
        }
    `
}

function isReadableEmitter(value: unknown): value is ReadableEmitter<number | null, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}
