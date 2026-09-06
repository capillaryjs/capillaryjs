import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {classNames, componentClass} from '../controlUtils.js'

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
            className={classNames(componentClass(this.props), direction)}
            style={primarySize == null ? undefined : {'--split-primary-size': primarySize}}
        >
            <div
                className="primary"
                role={primaryLabel == null ? null : 'region'}
                aria-label={primaryLabel}
                tabIndex={0}
            >{primary}</div>
            <div
                className="secondary"
                role={secondaryLabel == null ? null : 'region'}
                aria-label={secondaryLabel}
                tabIndex={0}
            >{secondary ?? this.props.children ?? []}</div>
        </Host>
    }

    static override hostName = 'split-view'

    static css = css`
        & {
            display: flex;
            flex: 1 1 auto;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
        }

        &.horizontal {
            flex-direction: row;
        }

        &.vertical {
            flex-direction: column;
        }

        & > .primary {
            flex: 0 1 var(--split-primary-size, 40%);
        }

        & > .secondary {
            flex: 1;
        }

        & > .primary,
        & > .secondary {
            min-width: 0;
            min-height: 0;
            overflow: auto;
        }

        &.horizontal > .primary {
            border-inline-end: 1px solid var(--ui-border-color);
        }

        &.vertical > .primary {
            border-block-end: 1px solid var(--ui-border-color);
        }
    `
}
