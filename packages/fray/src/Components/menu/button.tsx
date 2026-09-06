import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../component.js'
import {componentClass, invoke} from '../controlUtils.js'

const buttonLiveProps = ['disabled', 'pressed', 'busy'] as const

export interface ButtonProps extends ComponentProps,
    LivePropContract<(typeof buttonLiveProps)[number]> {
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
    static override liveProps = buttonLiveProps
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

    static override css = css`
        button {
            min-height: var(--control-min-height, 2rem);
            padding: var(--space-xs) var(--space-sm);
            color: var(--button-color);
            background: var(--button-background);
            border: var(--button-border);
            border-radius: var(--radius-md);
            box-shadow: var(--button-shadow);
            box-sizing: border-box;
            cursor: default;
            font-family: inherit;
            font-size: var(--ui-font-size);
            line-height: calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding));
            user-select: none;
            white-space: nowrap;
        }

        button:hover:not(:disabled, [aria-disabled="true"]) {
            background: var(--button-background-hover);
        }

        button:active:not(:disabled, [aria-disabled="true"]) {
            background: var(--button-background-active);
            border-style: var(--button-border-style-active);
            box-shadow: var(--button-shadow-active);
        }

        button:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        button:disabled,
        button[aria-disabled="true"] {
            color: var(--input-color-disabled);
            background: var(--button-background-disabled);
            border: var(--button-border-disabled);
            cursor: not-allowed;
            pointer-events: none;
        }
    `
}
