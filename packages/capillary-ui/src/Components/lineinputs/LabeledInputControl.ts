import {css} from '../component.js'
import type {ComponentProps} from '../component.js'
import {LineControl} from './LineControl.js'

/** Shared DOM and presentation contract for controls with a native label. */
export abstract class LabeledInputControl<
    TProps extends ComponentProps = ComponentProps,
> extends LineControl<TProps> {
    static override css = css`
        & {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            align-items: center;
            gap: .5em;
            color: var(--ui-text-color);
            user-select: none;
        }

        /* GroupBox owns the ordinary body layout. Labeled controls fill its
           direct body so their own grid/flex row keeps labels left and native
           input surfaces right; an explicitly nested Layout remains supported
           for non-standard arrangements. */
        cap-groupbox > cap-content > &,
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
