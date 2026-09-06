import {Component, css} from '../component.js'
import type {ComponentProps} from '../component.js'

/** Shared DOM and presentation contract for controls with a native label. */
export abstract class LabeledInputControl<
    TProps extends ComponentProps = ComponentProps,
> extends Component<TProps> {
    static override css = css`
        & {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            align-items: center;
            gap: .5em;
            min-height: var(--control-min-height, 2rem);
            color: var(--ui-text-color);
            font-size: var(--ui-font-size);
            line-height: calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding));
            box-sizing: border-box;
            user-select: none;
        }

        & > label {
            user-select: none;
            white-space: nowrap;
        }

    `
}
