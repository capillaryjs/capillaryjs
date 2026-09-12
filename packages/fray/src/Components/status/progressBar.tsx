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
        const percentage = value == null ? null : value / max * 100
        const valueText = this.props.valueText ?? (value == null
            ? 'In progress'
            : `${Math.round(value / max * 100)}%`)
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <label htmlFor={this.progressId}>{this.props.label}</label>
            <progress
                id={this.progressId}
                value={value == null ? undefined : value}
                max={max}
                aria-valuetext={valueText}
            >{valueText}</progress>
            <fray-content aria-hidden="true">
                <fray-progress
                    style={percentage == null ? undefined : {
                        '--progress-width': `${percentage}%`,
                        '--progress-inverse-width': `${10000 / Math.max(percentage, 1)}%`,
                    }}
                ><fray-inverse>{this.props.label}</fray-inverse></fray-progress>
                <fray-label>{this.props.label}</fray-label>
            </fray-content>
        </Host>
    }

    static override hostName = 'progress-bar'

    static css = css`
        & {
            display: block;
        }

        & > label,
        & > progress {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
            border: 0;
        }

        & > fray-content {
            position: relative;
            display: block;
            width: 100%;
            min-height: var(--control-min-height);
            border-radius: var(--ui-border-radius);
            overflow: hidden;
            background: var(--progress-track-background);
            box-shadow: var(--progress-track-shadow);
            color: var(--progress-track-color);
            text-align: center;
            line-height: var(--control-min-height);
            box-sizing: border-box;
            user-select: none;
        }

        & > fray-content > fray-progress {
            position: absolute;
            z-index: 1;
            top: 0;
            left: 0;
            display: block;
            width: var(--progress-width, 0%);
            height: 100%;
            border-radius: inherit;
            overflow: hidden;
            background: var(--progress-value-background);
            box-shadow: var(--progress-value-shadow);
        }

        & > fray-content > fray-progress > fray-inverse {
            position: absolute;
            top: 0;
            left: 0;
            display: block;
            width: var(--progress-inverse-width, 10000%);
            height: 100%;
            color: var(--progress-value-color);
            text-align: center;
            white-space: nowrap;
        }

        & > fray-content > fray-label {
            position: relative;
            z-index: 0;
            display: block;
            height: 100%;
            white-space: nowrap;
        }

        &:has(> progress:indeterminate) > fray-content > fray-progress {
            display: none;
        }

        &:has(> progress:indeterminate) > fray-content > fray-label {
            z-index: 2;
        }

        &:has(> progress:indeterminate) > fray-content::after {
            position: absolute;
            z-index: 1;
            inset: 1px;
            content: "";
            border-radius: inherit;
            background-image: var(--working-background-image);
            background-repeat: repeat;
            background-size: 2rem 2rem;
            animation: fray-progressbar-indeterminate 0.55s linear infinite;
            opacity: .5;
        }

        @keyframes fray-progressbar-indeterminate {
            from { background-position: 0 0; }
            to { background-position: 2rem 0; }
        }

        @media (forced-colors: active) {
            & > fray-content {
                border: 1px solid CanvasText;
                background: Canvas;
                box-shadow: none;
                color: CanvasText;
            }

            & > fray-content > fray-progress {
                background: Highlight;
                box-shadow: none;
            }

            & > fray-content > fray-progress > fray-inverse {
                color: HighlightText;
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
