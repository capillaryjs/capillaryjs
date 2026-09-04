import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass} from '../controlUtils.js'

export interface SplitViewProps extends ComponentProps {
    primary?: FrayChild
    secondary?: FrayChild
    direction?: 'horizontal' | 'vertical'
    primarySize?: string
    primaryLabel?: string
    secondaryLabel?: string
}

/** Two-pane layout with explicit overflow ownership and no resizing behavior. */
export class SplitView extends Component<SplitViewProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const {
            primary = null,
            secondary = null,
            direction = 'horizontal',
            primarySize,
            primaryLabel,
            secondaryLabel,
        } = this.props
        if (direction !== 'horizontal' && direction !== 'vertical') {
            throw new TypeError('SplitView direction must be horizontal or vertical')
        }
        if (primarySize != null && (typeof primarySize !== 'string' || primarySize.length === 0)) {
            throw new TypeError('SplitView primarySize must be a non-empty CSS size')
        }
        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            data-direction={direction}
            style={primarySize == null ? undefined : {'--split-primary-size': primarySize}}
        >
            <div
                data-part="primary"
                role={primaryLabel == null ? null : 'region'}
                aria-label={primaryLabel}
            >{primary}</div>
            <div
                data-part="secondary"
                role={secondaryLabel == null ? null : 'region'}
                aria-label={secondaryLabel}
            >{secondary ?? this.props.children ?? []}</div>
        </Host>
    }

    static override hostName = 'split-view'
    static override standaloneHostName = 'split-view'

    static css = css`
        & {
            display: grid;
            flex: 1 1 auto;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
        }

        &[data-direction="horizontal"] {
            grid-template-columns:
                var(--split-primary-size, minmax(16rem, 0.8fr))
                minmax(0, 1.2fr);
        }

        &[data-direction="vertical"] {
            grid-template-rows:
                var(--split-primary-size, minmax(12rem, 0.8fr))
                minmax(0, 1.2fr);
        }

        & > [data-part] {
            min-width: 0;
            min-height: 0;
            overflow: auto;
        }

        &[data-direction="horizontal"] > [data-part="primary"] {
            border-inline-end: 1px solid var(--ui-border-color);
        }

        &[data-direction="vertical"] > [data-part="primary"] {
            border-block-end: 1px solid var(--ui-border-color);
        }
    `
}
