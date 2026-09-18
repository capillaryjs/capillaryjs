import {css} from '../component.js'
import {GroupBox} from './groupBox.js'
import type {GroupBoxBaseProps} from './groupBox.js'
import {OptionGroup} from './optionGroup.js'
import type {CapillaryUiChild} from '../component.js'

export interface OptionsBoxProps extends GroupBoxBaseProps {
    header: CapillaryUiChild
}

/** Bordered panel with a vertical section header for compact related choice controls. */
export class OptionsBox<TProps extends GroupBoxBaseProps = OptionsBoxProps>
    extends GroupBox<TProps> {
    static override hostName = 'options-box'
    static override dependencies = [...GroupBox.dependencies, OptionGroup]

    static css = css`
        & {
            --_cap-control-compact-min: 0px;
            --control-row-padding-block: 0px;
        }

        & > cap-content {
            display: flex;
            flex-direction: column;
            align-self: stretch;
            flex: 1 1 0;
            gap: 2px;
        }

        & > cap-content cap-optiongroup > fieldset > legend {
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            font-size: var(--ui-font-size);
            color: var(--palette-neutral-950);
            gap: 0.5rem;
            width: 100%;
            padding: 0 0 1px;
            margin-bottom: 1px;
            border-bottom: 1px solid var(--ui-border-color);
            user-select: none;
        }

        & > cap-content cap-optiongroup > fieldset {
            display: flex;
            flex-flow: column nowrap;
            justify-content: stretch;
            justify-items: stretch;
            align-items: stretch;
            align-content: stretch;
            box-sizing: border-box;
            width: 100%;
            gap: 2px;
            padding: 1px 0 2px;
        }

        /* OptionsBox is deliberately a dense, vertical filter surface. Keep
           RadioGroup in the same rhythm as checkbox options, regardless of
           theme-level RadioGroup spacing. */
        & > cap-content cap-radiogroup > fieldset {
            gap: 2px;
        }
    `
}
