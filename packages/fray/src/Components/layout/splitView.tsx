import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {classNames, componentClass} from '../controlUtils.js'
import {DeclarativeRegion, readDeclarativeRegions} from './declarativeRegion.js'

/** Content rendered in the fixed-size pane of a SplitView. */
export class SplitPrimary extends DeclarativeRegion {}

/** Content rendered in the flexible pane of a SplitView. */
export class SplitSecondary extends DeclarativeRegion {}

export interface SplitViewProps extends ComponentProps {
    /** @deprecated Supply `<SplitPrimary>` as a direct child. */
    primary?: never
    /** @deprecated Supply `<SplitSecondary>` as a direct child. */
    secondary?: never
    direction?: 'horizontal' | 'vertical'
    primarySize?: string
    primaryLabel?: string
    secondaryLabel?: string
}

/** Two-pane layout with explicit overflow ownership and no resizing behavior. */
export class SplitView extends Component<SplitViewProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        if (this.props.primary != null || this.props.secondary != null) {
            throw new Error('SplitView pane content must use direct SplitPrimary and SplitSecondary children')
        }
        const {
            direction = 'horizontal',
            primarySize,
            primaryLabel,
            secondaryLabel,
        } = this.props
        const {regions} = readDeclarativeRegions(
            'SplitView',
            this.props.children,
            {primary: SplitPrimary, secondary: SplitSecondary},
            {allowContent: false},
        )
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
            <fray-primary
                role={primaryLabel == null ? null : 'region'}
                aria-label={primaryLabel}
                tabIndex={0}
            >{regions.primary ?? null}</fray-primary>
            <fray-secondary
                role={secondaryLabel == null ? null : 'region'}
                aria-label={secondaryLabel}
                tabIndex={0}
            >{regions.secondary ?? null}</fray-secondary>
        </Host>
    }

    static override hostName = 'split-view'
    static override dependencies = [SplitPrimary, SplitSecondary]

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

        & > fray-primary {
            flex: 0 1 var(--split-primary-size, 40%);
        }

        & > fray-secondary {
            flex: 1;
        }

        & > fray-primary,
        & > fray-secondary {
            min-width: 0;
            min-height: 0;
            overflow: auto;
        }

        &.horizontal > fray-primary {
            border-inline-end: 1px solid var(--ui-border-color);
        }

        &.vertical > fray-primary {
            border-block-end: 1px solid var(--ui-border-color);
        }
    `
}
