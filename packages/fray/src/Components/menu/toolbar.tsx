import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass} from '../controlUtils.js'

export interface ToolbarProps extends ComponentProps {
    id?: string
    label?: string
    orientation?: 'horizontal' | 'vertical'
}

export class Toolbar extends Component<ToolbarProps> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const {
            children = [],
            id,
            label = 'Actions',
            orientation = 'horizontal',
        } = this.props
        if (!['horizontal', 'vertical'].includes(orientation)) {
            throw new TypeError('Toolbar orientation must be horizontal or vertical')
        }

        const Host = this.Host
        return <Host
            id={id}
            role="toolbar"
            className={componentClass(this.props) || null}
            aria-label={label}
            aria-orientation={orientation}
        >{children}</Host>
    }

    static override hostName = 'toolbar'

    static css = css`
        & {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            color: var(--toolbar-color);
            background: var(--toolbar-background);
            border: var(--toolbar-border);
            box-shadow: var(--toolbar-shadow);
            gap: var(--spacing-small, 0.5rem);
            padding: var(--ui-padding);
        }

        & > * {
            margin: 0;
        }

        &[aria-orientation="vertical"] {
            flex-direction: column;
            align-items: stretch;
        }
    `
}
