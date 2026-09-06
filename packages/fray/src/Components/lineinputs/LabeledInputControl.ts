import {Component, css} from '../component.js'
import type {ComponentProps} from '../component.js'

/** Shared DOM and presentation contract for controls with a label and native input. */
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

        & > input,
        & > textarea {
            min-height: var(--control-min-height, 2rem);
            width: var(--input-width, 15rem);
            padding: var(--space-xs) var(--space-sm);
            color: var(--input-color);
            background: var(--input-background);
            border: var(--input-border);
            border-radius: var(--radius-md);
            box-shadow: var(--input-shadow);
            box-sizing: border-box;
            font: inherit;
            pointer-events: all;
            user-select: text;
            white-space: nowrap;
        }

        & > input:disabled,
        & > textarea:disabled {
            color: var(--input-color-disabled);
            background: var(--input-background-disabled);
            border-color: var(--ui-input-border-disabled);
            cursor: not-allowed;
        }

        & > input:focus-visible,
        & > textarea:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }
    `
}
