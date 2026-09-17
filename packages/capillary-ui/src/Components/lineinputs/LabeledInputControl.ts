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
            min-height: var(--control-min-height, 2em);
            color: var(--ui-text-color);
            font-family: inherit;
            font-size: var(--ui-font-size);
            line-height: 1.2;
            box-sizing: border-box;
            user-select: none;
        }

        cap-groupbox > cap-content > cap-layout > & {
            align-self: stretch;
        }

        & > label {
            align-self: center;
            user-select: none;
            white-space: nowrap;
        }

        &:has(> input:required:invalid:not(:disabled):not([readonly]):not([aria-invalid="true"]))::after {
            content: "!";
            position: absolute;
            z-index: 3;
            inset-block-start: -.5em;
            inset-inline-end: -.5em;
            display: grid;
            inline-size: 1em;
            block-size: 1em;
            place-items: center;
            color: var(--required-indicator-color);
            background: var(--required-indicator-background);
            border-radius: 50%;
            font-size: .75em;
            font-weight: 700;
            line-height: 1;
            pointer-events: none;
        }

    `
}
