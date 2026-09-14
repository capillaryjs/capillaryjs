import {Component, css} from '../component.js'
import type {ComponentProps} from '../component.js'

/** Shared native-label and painted-shell contract for checkable inputs. */
export abstract class CheckableControl<
    TProps extends ComponentProps = ComponentProps,
> extends Component<TProps> {
    static override css = css`
        & {
            display: inline-flex;
            position: relative;
            flex-flow: row wrap;
            align-items: center;
            align-content: center;
            font-family: inherit;
            font-size: var(--ui-font-size);
            line-height: 1.2;
        }

        & > label {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            min-height: 1.2em;
            margin: 0;
            color: var(--ui-text-color);
            border-radius: var(--ui-border-radius);
            box-sizing: border-box;
            align-items: center;
            gap: .3em;
            cursor: pointer;
            user-select: none;
        }

        & > label:has(> input:disabled) {
            color: var(--checkable-label-color-disabled);
            cursor: not-allowed;
        }

        & > label > input {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
            border: 0;
            font: inherit;
            font-size: var(--ui-font-size, inherit);
        }

        & > label > input + cap-checkshell {
            position: relative;
            display: grid;
            width: 1em;
            height: 1em;
            flex: 0 0 1em;
            box-sizing: border-box;
            text-align: center;
            line-height: 1;
            color: var(--input-color, var(--ui-text-color, currentColor));
            background: var(--checkbox-box-background, var(--ui-input-bg, transparent));
            border: var(--checkbox-box-border, var(--cbx-o-border, 1px solid currentColor));
            border-radius: var(--cbx-border-radius, var(--radius-sm, 0.2rem));
            box-shadow: var(--checkbox-box-shadow);
            font-family: inherit;
            font-size: 1em;
            user-select: none;
            place-items: center;
        }

        & > label > input:checked + cap-checkshell {
            color: var(--checkbox-symbol-color, var(--selection-color, currentColor));
            background: var(--checkbox-box-background-checked,
                var(--selection-background, var(--ui-accent-color, Highlight)));
            box-shadow: var(--checkbox-box-shadow-checked);
        }

        & > label > input:focus-visible + cap-checkshell {
            outline: 2px solid var(--focus-color, var(--ui-accent-color, Highlight));
            outline-offset: 1px;
        }

        & > label > input:disabled + cap-checkshell {
            opacity: 0.6;
            filter: saturate(0.6);
        }

        & > label > input[aria-busy="true"]:not([aria-invalid="true"]) + cap-checkshell {
            background: var(--working-background-image), var(--checkbox-box-background,
                var(--ui-input-bg, transparent));
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
            animation: cap-working-progress .55s linear infinite;
        }

        & > label:has(> input[aria-invalid="true"]) {
            color: var(--error-color);
        }

        & > label > input[aria-invalid="true"] + cap-checkshell {
            border-color: var(--error-color);
        }

        @media (prefers-reduced-motion: reduce) {
            & > label > input[aria-busy="true"] + cap-checkshell {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > label > input[aria-invalid="true"] + cap-checkshell {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `
}
