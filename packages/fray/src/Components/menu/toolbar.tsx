import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass} from '../controlUtils.js'

export interface ToolbarProps extends ComponentProps {
    id?: string
    label?: string
    orientation?: 'horizontal' | 'vertical'
}

export class Toolbar extends Component<ToolbarProps> {
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
            data-orientation={orientation}
            aria-label={label}
            aria-orientation={orientation}
        >{children}</Host>
    }

    static override hostName = 'toolbar'
    static override standaloneHostName = 'tool-bar'

    static baseStyles = [
        ['&', ['toolbar']],
    ]

    static css = css`
        & {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--spacing-small, 0.5rem);
            padding: var(--ui-padding);
        }

        &[data-orientation="vertical"] {
            flex-direction: column;
            align-items: stretch;
        }
    `
}
