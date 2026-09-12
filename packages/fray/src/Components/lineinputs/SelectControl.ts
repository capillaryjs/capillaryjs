import {css} from '../component.js'
import type {ComponentProps} from '../component.js'
import {LabeledInputControl} from './LabeledInputControl.js'

/** Shared select-shell contract for labeled controls that render a native select. */
export abstract class SelectControl<
    TProps extends ComponentProps = ComponentProps,
> extends LabeledInputControl<TProps> {
    static override css = css`
        & {
            min-width: 0;
        }

        & > fray-selectshell {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            isolation: isolate;
            min-height: var(--control-min-height, 2rem);
            min-width: 0;
            box-sizing: border-box;
        }

        & > fray-selectshell > select {
            position: relative;
            z-index: 1;
            min-height: var(--control-min-height, 2rem);
            width: var(--input-width, 15rem);
            max-width: 100%;
            min-width: var(--input-min-width, 6rem);
            padding: var(--space-xs) var(--space-sm);
            padding-inline-end: var(--dropdown-padding-inline-end);
            color: var(--input-color);
            background: var(--dropdown-select-background);
            border: var(--dropdown-select-border);
            border-radius: var(--radius-md);
            box-shadow: var(--dropdown-select-shadow);
            box-sizing: border-box;
            font: inherit;
            appearance: var(--dropdown-appearance);
            pointer-events: all;
            white-space: nowrap;
        }

        & > fray-selectshell::after {
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

        & > fray-selectshell::before {
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

        & > fray-selectshell:has(> select:hover:not(:disabled))::before {
            background: var(--dropdown-trigger-background-hover);
            box-shadow: var(--dropdown-trigger-shadow-hover);
        }

        & > fray-selectshell:has(> select:disabled)::before {
            color: var(--input-color-disabled);
            background: var(--dropdown-trigger-background-disabled);
            border: var(--dropdown-trigger-border-disabled);
        }

        & > fray-selectshell:has(> select:disabled)::after {
            background: var(--dropdown-underlay-background-disabled);
            border: var(--dropdown-underlay-border-disabled);
        }

        & > fray-selectshell > select:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        @media (forced-colors: active) {
            & > fray-selectshell::before,
            & > fray-selectshell::after {
                display: none;
            }

            & > fray-selectshell > select {
                appearance: auto;
                padding-inline-end: var(--space-sm);
            }
        }
    `
}
