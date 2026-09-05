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

    static baseStyles = [
        ['&::after', ['after', 'working']],
    ]

    static css = css`
        & {
            display: block;
            min-width: 3rem;
            height: 1em;
            overflow: hidden;
            background: currentColor;
            border-radius: var(--ui-border-radius);
            opacity: 0.18;
            position: relative;
        }

        @keyframes fray-placeholder-progress {
            from { background-position: 0 0; }
            to { background-position: 2rem 0; }
        }
    `
}

function normalizeWidth(width: number | string): number {
    const numeric = Number(width)
    if (!Number.isFinite(numeric)) throw new TypeError('Placeholder width must be numeric')
    return Math.min(100, Math.max(10, numeric))
}
