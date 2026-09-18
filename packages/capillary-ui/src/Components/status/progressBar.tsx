import type {ReadableEmitter} from '@capillaryjs/capillary'
import {FetchState} from '@capillaryjs/capillary'

import {css} from '../component.js'
import {LineControl} from '../lineinputs/LineControl.js'
import type {ComponentProps, CapillaryUiChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {StatusPresentation} from './statusPresentation.js'

export interface ProgressBarProps extends ComponentProps {
    id?: string | number | null
    label: CapillaryUiChild
    value?: number | null
    valueEmitter?: ReadableEmitter<number | null, unknown>
    max?: number
    valueText?: string
}

/** Labelled native progress indicator with determinate and indeterminate modes. */
export class ProgressBar extends LineControl<ProgressBarProps> {
    static override liveProps: readonly string[] = []
    static override dependencies = [StatusPresentation]
    readonly progressId: string

    constructor(props: ProgressBarProps) {
        super(props)
        this.progressId = controlId('progress', props.id)
        if (props.valueEmitter != null && !isReadableEmitter(props.valueEmitter)) {
            throw new TypeError('ProgressBar valueEmitter must be a readable emitter')
        }
    }

    render(): CapillaryUiChild {
        const max = this.props.max ?? 100
        if (!Number.isFinite(max) || max <= 0) {
            throw new RangeError('ProgressBar max must be a positive finite number')
        }
        const valueEmitter = this.props.valueEmitter
        const sourceValue = valueEmitter == null
            ? (this.props.value ?? null)
            : this.read(valueEmitter)
        const busy = valueEmitter != null && valueEmitter.getFetchState() === FetchState.Loading
        if (sourceValue != null && (!Number.isFinite(sourceValue) || sourceValue < 0)) {
            throw new RangeError('ProgressBar value must be null or a non-negative finite number')
        }
        const value = sourceValue == null ? null : Math.min(sourceValue, max)
        const percentage = value == null ? null : value / max * 100
        const valueText = this.props.valueText ?? (value == null
            ? this.capillaryUiMessage('progressInProgress')
            : `${Math.round(value / max * 100)}%`)
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <label htmlFor={this.progressId}>{this.props.label}</label>
            <progress
                id={this.progressId}
                value={value == null ? undefined : value}
                max={max}
                aria-busy={busy ? 'true' : null}
                aria-valuetext={valueText}
            >{valueText}</progress>
            <cap-content aria-hidden="true">
                <cap-progress
                    style={percentage == null ? undefined : {
                        '--progress-width': `${percentage}%`,
                        '--progress-inverse-width': `${10000 / Math.max(percentage, 1)}%`,
                    }}
                ><cap-inverse>{this.props.label}</cap-inverse></cap-progress>
                <cap-label>{this.props.label}</cap-label>
            </cap-content>
        </Host>
    }

    static override hostName = 'progress-bar'

    static css = css`
        & {
            display: flex;
            align-items: center;
            width: 100%;
            min-width: 0;
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

        & > cap-content {
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

        & > cap-content > cap-progress {
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

        & > cap-content > cap-progress > cap-inverse {
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

        & > cap-content > cap-label {
            position: relative;
            z-index: 0;
            display: block;
            height: 100%;
            white-space: nowrap;
        }

        &:has(> progress:indeterminate[aria-busy="true"]) > cap-content > cap-progress {
            display: none;
        }

        &:has(> progress:indeterminate[aria-busy="true"]) > cap-content > cap-label {
            z-index: 2;
        }

        &:has(> progress[aria-busy="true"]) > cap-content::after {
            position: absolute;
            z-index: 2;
            inset: 1px;
            content: "";
            border-radius: inherit;
            background-image: var(--working-background-image);
            background-repeat: repeat;
            background-size: 2rem 2rem;
            animation: cap-working-progress .55s linear infinite;
            opacity: .5;
            pointer-events: none;
        }

        &:has(> progress[aria-busy="true"]) > cap-content > cap-label {
            z-index: 3;
        }

        @media (prefers-reduced-motion: reduce) {
            &:has(> progress[aria-busy="true"]) > cap-content::after {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > cap-content {
                border: 1px solid CanvasText;
                background: Canvas;
                box-shadow: none;
                color: CanvasText;
            }

            & > cap-content > cap-progress {
                background: Highlight;
                box-shadow: none;
            }

            & > cap-content > cap-progress > cap-inverse {
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
