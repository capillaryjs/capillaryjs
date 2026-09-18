import {css} from '../component.js'
import type {ComponentProps} from '../component.js'
import {LineControl} from './LineControl.js'
import {requiredControlInvalidSelector, requiredPresentationCss} from './requiredPresentation.js'

/** Shared native-label and painted-shell contract for checkable inputs. */
export abstract class CheckableControl<
    TProps extends ComponentProps = ComponentProps,
> extends LineControl<TProps> {
    static override css = css`
        & {
            display: inline-flex;
            position: relative;
            flex-flow: row wrap;
            align-items: center;
            align-content: center;
            --_cap-checkable-label-color: var(--ui-text-color);
            --_cap-checkable-cursor: pointer;
            --_cap-checkable-box-background: var(--checkbox-box-background,
                var(--ui-input-bg, transparent));
            --_cap-checkable-box-border: var(--checkbox-box-border,
                var(--cbx-o-border, 1px solid currentColor));
            --_cap-checkable-box-shadow: var(--checkbox-box-shadow);
            --_cap-checkable-box-filter: none;
        }

        & > label {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            min-height: var(--_cap-control-row-min);
            margin: 0;
            color: var(--_cap-checkable-label-color);
            border-radius: var(--ui-border-radius);
            box-sizing: border-box;
            align-items: center;
            gap: .3em;
            cursor: var(--_cap-checkable-cursor);
            user-select: none;
        }

        & > label:has(> input:disabled) {
            color: var(--checkable-label-color-disabled);
            cursor: not-allowed;
        }

        & > label:has(> input[aria-readonly="true"]:not(:disabled)) {
            --_cap-checkable-label-color: var(--checkable-label-color-readonly);
            --_cap-checkable-cursor: default;
            --_cap-checkable-box-background: var(--checkbox-box-background-readonly);
            --_cap-checkable-box-border: var(--checkbox-box-border-readonly);
            --_cap-checkable-box-shadow: var(--checkbox-box-shadow-readonly);
            --_cap-checkable-box-filter: saturate(.78);
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
            display: flex;
            align-items: center;
            justify-content: center;
            width: var(--checkbox-box-size, 1em);
            height: var(--checkbox-box-size, 1em);
            flex: 0 0 var(--checkbox-box-size, 1em);
            box-sizing: border-box;
            text-align: center;
            line-height: 1;
            color: var(--input-color, var(--ui-text-color, currentColor));
            background: var(--_cap-checkable-box-background);
            border: var(--_cap-checkable-box-border);
            border-radius: var(--checkbox-box-radius,
                var(--cbx-border-radius, var(--radius-sm, 0.2rem)));
            box-shadow: var(--_cap-checkable-box-shadow);
            filter: var(--_cap-checkable-box-filter);
            font-family: inherit;
            font-size: 1em;
            user-select: none;
        }

        & > label > input:checked + cap-checkshell {
            color: var(--checkbox-symbol-color, var(--selection-color, currentColor));
            background: var(--checkbox-box-background-checked,
                var(--selection-background, var(--ui-accent-color, Highlight)));
            border: var(--checkbox-box-border-checked, var(--checkbox-box-border,
                var(--cbx-o-border, 1px solid currentColor)));
            box-shadow: var(--checkbox-box-shadow-checked);
        }

${requiredPresentationCss({
            outlineSelector: `& > label:has(> input${requiredControlInvalidSelector})`,
            indicatorSelector: `& > label:has(> input${requiredControlInvalidSelector})`,
            indicatorZIndex: 1,
            indicatorInsetBlockStart: '-.5em',
            indicatorInsetInlineEnd: '-1em',
            outlineInlineEndExtension: '1em',
        })}
        & > label:has(> input[aria-invalid="true"]) {
            box-shadow: var(--error-control-shadow);
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

        & > label > input[aria-invalid="true"] + cap-checkshell {
            border-color: var(--error-control-border);
            box-shadow: none;
        }

        @media (prefers-reduced-motion: reduce) {
            & > label > input[aria-busy="true"] + cap-checkshell {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > label:has(> input[aria-invalid="true"]) {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `
}
