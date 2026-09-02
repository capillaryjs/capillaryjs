import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass, invoke} from '../controlUtils.js'

export interface ButtonProps extends ComponentProps {
    label?: FrayChild
    type?: 'button' | 'reset' | 'submit'
    disabled?: boolean
    pressed?: boolean
    busy?: boolean
    busyLabel?: FrayChild
    id?: string
    name?: string
    value?: string | number
    title?: string
    ariaLabel?: string
    onClick?: (event: MouseEvent) => void
}

/** Native actionable button primitive. */
export class Button extends Component<ButtonProps> {
    constructor(props: ButtonProps = {}) {
        super(props)
        if (props.onClick != null && typeof props.onClick !== 'function') {
            throw new TypeError('Button onClick must be a function')
        }
    }

    render(): FrayChild {
        const {
            children = [],
            label,
            type = 'button',
            disabled = false,
            pressed,
            busy = false,
            busyLabel,
            id,
            name,
            value,
            title,
            ariaLabel,
            onClick,
        } = this.props
        const hasChildren = Array.isArray(children)
            ? children.length > 0
            : children != null && typeof children !== 'boolean'
        const normalContent = hasChildren ? children : (label ?? '')
        const content = busy ? (busyLabel ?? normalContent) : normalContent
        const unavailable = disabled || busy

        return <button
            id={id}
            name={name}
            value={value == null ? undefined : String(value)}
            title={title}
            type={type}
            disabled={unavailable}
            className={componentClass(this.props) || undefined}
            data-fray-component="button"
            aria-label={ariaLabel}
            aria-pressed={pressed == null ? null : String(Boolean(pressed))}
            aria-busy={busy ? 'true' : null}
            onClick={(event: MouseEvent) => {
                if (!unavailable) invoke(onClick, event)
            }}
        >{content}</button>
    }

    static baseStyles = [
        ['button[data-fray-component="button"]', ['uiline', 'button']],
    ]

    static css = css`
        button[data-fray-component="button"] {
            font-family: inherit;
        }
    `
}
