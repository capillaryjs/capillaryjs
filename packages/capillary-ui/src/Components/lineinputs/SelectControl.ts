import {css} from '../component.js'
import type {ComponentProps} from '../component.js'
import {LabeledInputControl} from './LabeledInputControl.js'

/** Shared select-shell contract for labeled controls that render a native select. */
export abstract class SelectControl<
    TProps extends ComponentProps = ComponentProps,
> extends LabeledInputControl<TProps> {
    static override css = css`
        & {
            display: grid;
            grid-template-columns: minmax(var(--input-min-width, 6rem), 1fr);
            min-width: 0;
        }

        &:has(> label) {
            grid-template-columns: max-content minmax(var(--input-min-width, 6rem), 1fr);
        }

        & > cap-selectshell {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            isolation: isolate;
            min-height: var(--control-min-height, 2em);
            width: var(--input-width, 15rem);
            max-width: 100%;
            min-width: var(--input-min-width, 6rem);
            box-sizing: border-box;
            margin-left: auto;
        }

        & > cap-selectshell > select {
            position: relative;
            z-index: 1;
            min-height: var(--control-min-height, 2em);
            width: var(--input-width, 15rem);
            max-width: 100%;
            min-width: var(--input-min-width, 6rem);
            margin: 0;
            padding: var(--ui-control-padding);
            padding-inline-end: var(--dropdown-padding-inline-end);
            color: var(--input-color);
            background: var(--dropdown-select-background);
            border: var(--dropdown-select-border);
            border-radius: var(--ui-border-radius);
            box-shadow: var(--dropdown-select-shadow);
            box-sizing: border-box;
            font: inherit;
            appearance: var(--dropdown-appearance);
            pointer-events: all;
            user-select: none;
            white-space: nowrap;
        }

        & > cap-selectshell::after {
            content: var(--dropdown-underlay-content);
            position: absolute;
            z-index: 0;
            inset: 0;
            background: var(--dropdown-underlay-background);
            border: var(--dropdown-underlay-border);
            border-radius: 0;
            border-start-start-radius: var(--dropdown-underlay-start-radius);
            border-end-start-radius: var(--dropdown-underlay-start-radius);
            box-shadow: var(--dropdown-underlay-shadow);
            box-sizing: border-box;
            pointer-events: none;
        }

        & > cap-selectshell::before {
            content: var(--dropdown-trigger-content);
            position: absolute;
            z-index: 2;
            inset-block: 0;
            inset-inline-end: 0;
            display: grid;
            inline-size: var(--dropdown-trigger-width);
            place-items: center;
            color: var(--dropdown-trigger-color);
            background: var(--dropdown-trigger-background);
            border: var(--dropdown-trigger-border);
            border-radius: 0;
            border-start-end-radius: var(--dropdown-trigger-end-radius);
            border-end-end-radius: var(--dropdown-trigger-end-radius);
            box-shadow: var(--dropdown-trigger-shadow);
            box-sizing: border-box;
            pointer-events: none;
        }

        & > cap-selectshell:has(> select:hover:not(:disabled))::before {
            background: var(--dropdown-trigger-background-hover);
            box-shadow: var(--dropdown-trigger-shadow-hover);
        }

        & > cap-selectshell:has(> select:disabled)::before {
            color: var(--input-color-disabled);
            background: var(--dropdown-trigger-background-disabled);
            border: var(--dropdown-trigger-border-disabled);
        }

        & > cap-selectshell:has(> select:disabled)::after {
            background: var(--dropdown-underlay-background-disabled);
            border: var(--dropdown-underlay-border-disabled);
        }

        & > cap-selectshell:has(> select:required:invalid:not(:disabled):not([aria-invalid="true"])) {
            outline: 1px dashed var(--required-color);
            outline-offset: 3px;
        }

        &:has(> cap-selectshell > select:required:invalid:not(:disabled):not([aria-invalid="true"]))::after {
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

        & > cap-selectshell > select:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        & > cap-selectshell:has(> select[aria-busy="true"]:not([aria-invalid="true"]))::after {
            background: var(--working-background-image), var(--dropdown-underlay-background);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
            animation: cap-working-progress .55s linear infinite;
        }

        & > cap-selectshell > select[aria-busy="true"]:not([aria-invalid="true"]) {
            background: var(--working-background-image), var(--dropdown-select-background);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
            animation: cap-working-progress .55s linear infinite;
        }

        & > cap-selectshell:has(> select[aria-invalid="true"])::before,
        & > cap-selectshell:has(> select[aria-invalid="true"])::after,
        & > cap-selectshell > select[aria-invalid="true"] {
            border-color: var(--error-color);
        }

        @media (prefers-reduced-motion: reduce) {
            & > cap-selectshell:has(> select[aria-busy="true"])::after,
            & > cap-selectshell > select[aria-busy="true"] {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > cap-selectshell::before,
            & > cap-selectshell::after {
                display: none;
            }

            & > cap-selectshell > select {
                appearance: auto;
                padding-inline-end: var(--space-sm);
            }

            & > cap-selectshell > select[aria-invalid="true"] {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `
}
