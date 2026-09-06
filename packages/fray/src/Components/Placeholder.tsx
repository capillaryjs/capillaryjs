import {Component, css} from './component.js'
import type {ComponentProps} from './component.js'

export interface PlaceholderProps extends ComponentProps {
    width?: number | string
}

/** Deterministic loading placeholder for data components. */
export class Placeholder extends Component<PlaceholderProps> {
    static override liveProps: readonly string[] = []
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
            animation: fray-placeholder-progress 0.55s linear infinite;
            background-repeat: repeat;
            background-size: 2rem 2rem;
            background-image: var(--working-background-image);
            border: 0 solid transparent;
            border-radius: inherit;
            box-sizing: border-box;
            pointer-events: none;
        }

        @keyframes fray-placeholder-progress {
            from { background-position: 0rem 0; }
            to { background-position: 2rem 0; }
        }

        @media (prefers-reduced-motion: reduce) {
            &::after {
                animation: none;
            }
        }
    `
}

function normalizeWidth(width: number | string): number {
    const numeric = Number(width)
    if (!Number.isFinite(numeric)) throw new TypeError('Placeholder width must be numeric')
    return Math.min(100, Math.max(10, numeric))
}
