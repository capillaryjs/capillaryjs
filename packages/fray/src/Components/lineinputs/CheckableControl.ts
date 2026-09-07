import {Component, css} from '../component.js'
import type {ComponentProps} from '../component.js'

/** Shared native-label and painted-shell contract for checkable inputs. */
export abstract class CheckableControl<
    TProps extends ComponentProps = ComponentProps,
> extends Component<TProps> {
    static override css = css`
        & {
            display: inline-flex;
            line-height: 1;
            height: 1.4em;
        }

        & > label {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            line-height: calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding));
            font-size: var(--ui-font-size);
            height: calc(var(--ui-font-size) + var(--ui-padding-h) + var(--ui-padding-h));
            color: var(--ui-text-color);
            border-radius: var(--ui-border-radius);
            box-sizing: border-box;
            align-items: center;
            gap: .3em;
            align-content: center;
            justify-content: center;
            justify-items: center;
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

        & > label > input + fray-checkshell {
            position: relative;
            display: grid;
            width: 1em;
            height: 1em;
            flex: 0 0 1em;
            box-sizing: border-box;
            text-align: center;
            line-height: 120%;
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

        & > label > input:checked + fray-checkshell {
            color: var(--checkbox-symbol-color, var(--selection-color, currentColor));
            background: var(--checkbox-box-background-checked,
                var(--selection-background, var(--ui-accent-color, Highlight)));
            box-shadow: var(--checkbox-box-shadow-checked);
        }

        & > label > input:focus-visible + fray-checkshell {
            outline: 2px solid var(--focus-color, var(--ui-accent-color, Highlight));
            outline-offset: 1px;
        }

        & > label > input:disabled + fray-checkshell {
            opacity: 0.6;
            filter: saturate(0.6);
        }
    `
}
