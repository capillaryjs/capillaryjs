import {Component, css} from './component.js'
import type {ComponentProps} from './component.js'
import {StatusPresentation} from './status/statusPresentation.js'

export interface PlaceholderProps extends ComponentProps {
    width?: number | string
}

/** Deterministic loading placeholder for data components. */
export class Placeholder extends Component<PlaceholderProps> {
    static override liveProps: readonly string[] = []
    static override dependencies = [StatusPresentation]
    render() {
        const width = normalizeWidth(this.props.width ?? 65)
        const Host = this.Host
        return <Host style={{width: `${width}%`}} aria-hidden="true" />
    }

    static override hostName = 'placeholder'

    static override css = css`
        & {
            display: block;
            width: 5em;
            height: 1em;
            background: #ccc;
            border-radius: var(--ui-border-radius);
            position: relative;
        }

        &::after {
            content: "";
            display: block;
            position: absolute;
            z-index: 1;
            inset: 0;
            margin: auto;
            animation: cap-working-progress .55s linear infinite;
            background-repeat: repeat;
            background-size: 2rem 2rem;
            background-image: var(--working-background-image);
            border: 0 solid transparent;
            border-radius: inherit;
            box-sizing: border-box;
            pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
            &::after {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & {
                background: CanvasText;
                forced-color-adjust: none;
            }

            &::after {
                display: none;
            }
        }
    `
}

function normalizeWidth(width: number | string): number {
    const numeric = Number(width)
    if (!Number.isFinite(numeric)) throw new TypeError('Placeholder width must be numeric')
    return Math.min(100, Math.max(10, numeric))
}
