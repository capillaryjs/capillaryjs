import {Component, css} from '../component.js'
import type {ComponentProps, CapillaryUiChild} from '../component.js'
import {componentClass} from '../controlUtils.js'

// Small geometric, font-independent vocabulary. Names describe intent, not a
// particular theme. SVG is used as a CSS mask, not as renderer-owned SVG DOM.
const paths = {
    add: 'M12 5v14M5 12h14',
    remove: 'M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    delete: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7',
    grip: 'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01',
    pan: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
    'zoom-in': 'M16 16l5 5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M7 10h6M10 7v6',
    'zoom-out': 'M16 16l5 5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M7 10h6',
    fit: 'M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5',
    reset: 'M4 10a8 8 0 1 1 1 7M4 4v6h6',
    refresh: 'M4 10a8 8 0 0 1 14-4l2 3M20 4v5h-5M20 14a8 8 0 0 1-14 4l-2-3M4 20v-5h5',
    undo: 'M9 5l-5 5 5 5M4 10h9a6 6 0 0 1 6 6v3',
    redo: 'M15 5l5 5-5 5M20 10h-9a6 6 0 0 0-6 6v3',
    pin: 'M8 3h8M9 3v6l-3 4v2h12v-2l-3-4V3M12 15v6',
    connect: 'M4 12h16M15 7l5 5-5 5M4 9v6',
    download: 'M12 3v12M7 10l5 5 5-5M4 16v4h16v-4',
    play: 'M7 4l13 8-13 8Z',
    pause: 'M8 4v16M16 4v16',
    first: 'M5 4v16M19 5l-9 7 9 7Z',
    previous: 'M16 5l-9 7 9 7',
    next: 'M8 5l9 7-9 7',
    last: 'M19 4v16M5 5l9 7-9 7Z',
} as const

export type IconName = keyof typeof paths

export interface IconProps extends ComponentProps {
    name: IconName
}

/** Decorative icon. The enclosing action/widget owns its accessible name. */
export class Icon extends Component<IconProps> {
    render(): CapillaryUiChild {
        if (!Object.hasOwn(paths, this.props.name)) throw new TypeError(`Unknown icon: ${this.props.name}`)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${paths[this.props.name]}" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        const Host = this.Host
        return <Host aria-hidden="true" className={componentClass(this.props) || null}
            style={{'--_cap-icon-mask': `url("data:image/svg+xml,${encodeURIComponent(svg)}")`}} />
    }

    static override hostName = 'icon'
    static override css = css`
        & {
            display: inline-block;
            flex: 0 0 auto;
            inline-size: 1.15em;
            block-size: 1.15em;
            vertical-align: -.15em;
            background: currentColor;
            mask: var(--_cap-icon-mask) center / contain no-repeat;
            pointer-events: none;
        }
        @media (forced-colors: active) { & { background: ButtonText; } }
    `
}
