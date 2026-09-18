import {Component, css} from '../component.js'
import type {ComponentProps} from '../component.js'

/** Shared row allocation, independent of each control's painted body. */
export abstract class LineControl<
    TProps extends ComponentProps = ComponentProps,
> extends Component<TProps> {
    static override css = css`
        & {
            --_cap-control-row-min: var(--_cap-control-compact-min,
                max(var(--control-min-height, 2em), var(--control-row-min-height, 0px)));
            min-height: calc(var(--_cap-control-row-min)
                + 2 * var(--control-row-padding-block, .25em));
            padding-block: var(--control-row-padding-block, .25em);
            box-sizing: border-box;
            font-family: inherit;
            font-size: var(--ui-font-size);
            line-height: 1.2;
        }
    `
}
