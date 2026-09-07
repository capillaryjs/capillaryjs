import {css} from '../component.js'
import {GroupPanel} from './groupPanel.js'
import type {GroupPanelBaseProps} from './groupPanel.js'
import type {FrayChild} from '../component.js'

export interface OptionsPanelProps extends GroupPanelBaseProps {
    header: FrayChild
}

/** Bordered panel with a vertical section header, designed to contain OptionGroups. */
export class OptionsPanel<TProps extends GroupPanelBaseProps = OptionsPanelProps>
    extends GroupPanel<TProps> {
    static override hostName = 'options-panel'

    static css = css`
        
        & > fray-content {
            display: flex;
            flex-direction: column;
            align-self: stretch;
            flex: 1 1 0;
            gap: .5em;
        }

        & > fray-content * > fieldset > legend {
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            font-size: var(--ui-font-size);
            color: var(--palette-neutral-950);
            gap: 0.5rem;
            width: 100%;
            padding: 0 0 0.25em;
            margin-bottom: 0.25em;
            border-bottom: 1px solid var(--ui-border-color);
        }

        & > fray-content * > fieldset {
            display: flex;
            flex-flow: column;
            justify-content: stretch;
            justify-items: stretch;
            align-items: stretch;
            align-content: stretch;
            box-sizing: border-box;
            width: 100%;
            gap: 0;
            padding: .25em 0 .5em 0;
        }
    `
}
