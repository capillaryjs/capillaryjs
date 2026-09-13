import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass} from '../controlUtils.js'

/** Shared structural keyframe dependency for loading-capable Fray components. */
export class StatusPresentation extends Component {
    static override hostName = null

    static override css = css`
        @keyframes fray-working-progress {
            from { background-position: 0 0, 0 0; }
            to { background-position: 2rem 0, 0 0; }
        }
    `
}

export interface ErrorMessageProps extends ComponentProps {
    id?: string
    error: unknown
    fallback?: string
}

/** Accessible error text exposed visually from an overlay icon on hover or focus. */
export class ErrorMessage extends Component<ErrorMessageProps> {
    render(): FrayChild {
        const message = formatErrorMessage(this.props.error, this.props.fallback ?? '')
        const Host = this.Host
        return <Host
            id={this.props.id}
            className={componentClass(this.props) || null}
            role="alert"
            tabIndex={0}
            aria-label={message}
        >
            <fray-erroricon aria-hidden="true" />
            <fray-errortext>{message}</fray-errortext>
        </Host>
    }

    static override hostName = 'error'
    static override dependencies = [StatusPresentation]

    static override css = css`
        & {
            position: absolute;
            z-index: 1200;
            inset-block-start: -.35em;
            inset-inline-end: -.35em;
            display: block;
            width: 1.25em;
            height: 1.25em;
            margin: 0;
            color: var(--error-color);
            font-size: .875em;
            line-height: 1.35;
            outline: none;
            box-sizing: border-box;
        }

        & > fray-erroricon {
            position: absolute;
            inset: 0;
            display: grid;
            width: 1.25em;
            height: 1.25em;
            color: var(--error-contrast);
            background: var(--error-color);
            border: 1px solid var(--error-color);
            border-radius: 50%;
            box-sizing: border-box;
            font-weight: 700;
            line-height: 1;
            place-items: center;
        }

        & > fray-erroricon::before {
            content: "!";
        }

        & > fray-errortext {
            position: absolute;
            z-index: 1;
            inset-block-start: calc(100% + .25em);
            inset-inline-end: 0;
            display: block;
            visibility: hidden;
            width: max-content;
            max-width: min(22rem, 80vw);
            padding: var(--space-xs) var(--space-sm);
            color: var(--ui-color);
            background: var(--error-bg-neutral, var(--application-background));
            border: 1px solid var(--error-color);
            border-radius: var(--radius-md);
            box-shadow: var(--ui-shadow);
            opacity: 0;
            overflow-wrap: anywhere;
            pointer-events: none;
            transform: translateY(-.2em);
            transition: opacity var(--motion-fast), transform var(--motion-fast), visibility 0s linear var(--motion-fast);
        }

        & > fray-erroricon:hover + fray-errortext,
        &:focus-visible > fray-errortext {
            visibility: visible;
            opacity: 1;
            transform: translateY(0);
            transition-delay: 0s;
        }

        &:focus-visible > fray-erroricon {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        @media (forced-colors: active) {
            & > fray-erroricon,
            & > fray-errortext {
                color: CanvasText;
                background: Canvas;
                border-color: Mark;
                forced-color-adjust: auto;
            }
        }
    `
}

export function formatErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message
    if (isMessageError(error)) return error.message
    if (isDerivedErrors(error)) {
        const messages = error
            .map((entry) => formatErrorMessage(entry.error, ''))
            .filter((message) => message.length > 0)
        if (messages.length > 0) return [...new Set(messages)].join('; ')
    }
    return error == null ? fallback : String(error)
}

function isMessageError(error: unknown): error is {message: string} {
    return error != null
        && typeof error === 'object'
        && typeof Reflect.get(error, 'message') === 'string'
}

function isDerivedErrors(error: unknown): error is readonly {error: unknown}[] {
    return Array.isArray(error) && error.every((entry) =>
        entry != null && typeof entry === 'object' && Object.hasOwn(entry, 'error'))
}
