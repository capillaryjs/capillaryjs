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

    `
}
