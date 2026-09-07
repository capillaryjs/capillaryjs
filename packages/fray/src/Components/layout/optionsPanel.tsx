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
            gap: var(--options-panel-group-gap, 1.5em);
        }
    `
}
