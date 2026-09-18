import {css} from '../component.js'
import {LineControl} from '../lineinputs/LineControl.js'
import type {ComponentProps, CapillaryUiChild, LivePropContract} from '../component.js'
import {componentClass, controlId, invoke} from '../controlUtils.js'
import {ErrorMessage} from '../status/statusPresentation.js'

const buttonLiveProps = ['disabled', 'pressed', 'busy', 'error'] as const

export interface ButtonProps extends ComponentProps,
    LivePropContract<(typeof buttonLiveProps)[number]> {
    label?: CapillaryUiChild
    type?: 'button' | 'reset' | 'submit'
    disabled?: boolean
    pressed?: boolean
    busy?: boolean
    busyLabel?: CapillaryUiChild
    error?: unknown
    id?: string
    name?: string
    value?: string | number
    title?: string
    ariaLabel?: string
    onClick?: (event: MouseEvent) => void
}

/** Native actionable button primitive. */
export class Button extends LineControl<ButtonProps> {
    static override liveProps = buttonLiveProps
    static override dependencies = [ErrorMessage]
    readonly errorId: string

    constructor(props: ButtonProps = {}) {
        super(props)
        this.errorId = `${controlId('button', props.id)}-error`
        if (props.onClick != null && typeof props.onClick !== 'function') {
            throw new TypeError('Button onClick must be a function')
        }
    }

    render(): CapillaryUiChild {
        const {
            children = [],
            label,
            type = 'button',
            disabled = false,
            pressed,
            busy = false,
            busyLabel,
            error = null,
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

        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <button
                id={id}
                name={name}
                value={value == null ? undefined : String(value)}
                title={title}
                type={type}
                disabled={unavailable}
                aria-label={ariaLabel}
                aria-pressed={pressed == null ? null : String(Boolean(pressed))}
                aria-busy={busy ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
                onClick={(event: MouseEvent) => {
                    if (!unavailable) invoke(onClick, event)
                }}
            >{content}</button>
            {error == null ? null : <ErrorMessage id={this.errorId} error={error} />}
        </Host>
    }

    static override hostName = 'button'

    static override css = css`
        & > button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: var(--control-min-height, 2em);
            margin: 0;
            padding: var(--ui-control-padding);
            color: var(--button-color);
            background: var(--button-background);
            border: var(--button-border);
            border-radius: var(--ui-border-radius);
            box-shadow: var(--button-shadow);
            box-sizing: border-box;
            cursor: default;
            font: inherit;
            user-select: none;
            white-space: nowrap;
        }

        & {
            display: inline-flex;
            position: relative;
            flex-flow: row wrap;
            align-items: center;
            align-content: center;
        }

        & > button:hover:not(:disabled, [aria-disabled="true"]) {
            background: var(--button-background-hover);
        }

        & > button:active:not(:disabled, [aria-disabled="true"]) {
            background: var(--button-background-active);
            border-style: var(--button-border-style-active);
            box-shadow: var(--button-shadow-active);
        }

        & > button:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        & > button:disabled:not([aria-busy="true"]),
        & > button[aria-disabled="true"]:not([aria-busy="true"]) {
            color: var(--input-color-disabled);
            background: var(--button-background-disabled);
            border-color: var(--button-border-disabled);
            cursor: not-allowed;
            pointer-events: none;
        }

        & > button[aria-busy="true"]:not([aria-invalid="true"]) {
            /* Busy is unavailable for activation, but remains a normal button
             * surface with the loading texture layered on top. */
            background: var(--working-background-image), var(--button-background);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
            animation: cap-working-progress .55s linear infinite;
        }

        & > button[aria-invalid="true"] {
            border-color: var(--error-control-border);
            box-shadow: var(--error-control-shadow);
        }

        @media (prefers-reduced-motion: reduce) {
            & > button[aria-busy="true"] {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > button[aria-invalid="true"] {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `
}
