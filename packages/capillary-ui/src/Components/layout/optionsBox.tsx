import {css} from '../component.js'
import {GroupBox} from './groupBox.js'
import type {GroupBoxBaseProps} from './groupBox.js'
import type {CapillaryUiChild} from '../component.js'

export interface OptionsBoxProps extends GroupBoxBaseProps {
    header: CapillaryUiChild
}

/** Bordered panel with a vertical section header, designed to contain OptionGroups. */
export class OptionsBox<TProps extends GroupBoxBaseProps = OptionsBoxProps>
    extends GroupBox<TProps> {
    static override hostName = 'options-box'

    static css = css`
        & > cap-content {
            display: flex;
            flex-direction: column;
            align-self: stretch;
            flex: 1 1 0;
            gap: 1rem;
        }

        & > cap-content * > fieldset > legend {
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            font-size: var(--ui-font-size);
            color: var(--palette-neutral-950);
            gap: 0.5rem;
            width: 100%;
            padding: 0 0 0.25rem;
            margin-bottom: 0.25rem;
            border-bottom: 1px solid var(--ui-border-color);
            user-select: none;
        }

        & > cap-content * > fieldset {
            display: flex;
            flex-flow: column;
            justify-content: stretch;
            justify-items: stretch;
            align-items: stretch;
            align-content: stretch;
            box-sizing: border-box;
            width: 100%;
            gap: .33rem;
            padding: .25em 0 .5em 0;
        }
    `
}
