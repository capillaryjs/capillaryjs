import {css} from '../component.js'
import {LineControl} from '../lineinputs/LineControl.js'
import type {ComponentProps, CapillaryUiChild, LivePropContract} from '../component.js'
import {classNames, componentClass, controlId, invoke} from '../controlUtils.js'
import {Icon} from './icon.js'
import type {IconName} from './icon.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {
    CommandInvocationPresentation,
    commandSource,
    validateCommandInteractionOptions,
} from '../commandSupport.js'
import type {CommandAction, CommandInteractionOptions} from '../commandSupport.js'

const buttonLiveProps = ['disabled', 'pressed', 'busy', 'error'] as const

interface ButtonCommonProps extends ComponentProps,
    LivePropContract<(typeof buttonLiveProps)[number]>, CommandInteractionOptions {
    label?: CapillaryUiChild
    /** Decorative intent icon; icon-only actions require ariaLabel. */
    icon?: IconName
    /** Subtle actions retain button semantics without standalone button chrome. */
    appearance?: 'standard' | 'subtle'
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
    ariaControls?: string
    ariaExpanded?: boolean
    ariaHasPopup?: 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid' | 'true'
    /** Guard command and explicit busy state by default; false delegates repeat policy to the caller. */
    disableWhileRunning?: boolean
}

export type ButtonProps = ButtonCommonProps & (
    | {
        /** Executes this command on native button activation. */
        command: CommandAction<void>
        onClick?: never
    }
    | {
        command?: never
        onClick?: (event: MouseEvent) => void
    }
)

/** Native actionable button primitive. */
export class Button extends LineControl<ButtonProps> {
    static override liveProps = buttonLiveProps
    static override dependencies = [ErrorMessage, Icon]
    readonly errorId: string
    private readonly commandPresentation = new CommandInvocationPresentation(() => this.update())

    constructor(props: ButtonProps = {}) {
        super(props)
        this.errorId = `${controlId('button', props.id)}-error`
        if (props.onClick != null && typeof props.onClick !== 'function') {
            throw new TypeError('Button onClick must be a function')
        }
        if (props.command != null && props.onClick != null) {
            throw new TypeError('Button command and onClick are mutually exclusive')
        }
        if (props.command != null && props.type != null && props.type !== 'button') {
            throw new TypeError('Button command requires type="button"')
        }
        validateCommandInteractionOptions(props)
    }

    render(): CapillaryUiChild {
        const {
            children = [],
            label,
            icon,
            appearance = 'standard',
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
            ariaControls,
            ariaExpanded,
            ariaHasPopup,
            command,
            disableWhileRunning = true,
            commandErrors = 'inline',
            onCommandInvocationError,
            onClick,
        } = this.props
        this.commandPresentation.reconcile(command)
        const commandState = commandSource(command)
        const commandRunning = commandState == null ? false : this.read(commandState.isRunning)
        const commandError = commandErrors === 'external' || commandState == null
            ? null : this.snapshot(commandState).error
        const invocationError = this.commandPresentation.error(commandErrors)
        const hasChildren = Array.isArray(children)
            ? children.length > 0
            : children != null && typeof children !== 'boolean'
        const normalContent = hasChildren ? children : (label ?? '')
        if (appearance !== 'standard' && appearance !== 'subtle') throw new TypeError('Unknown Button appearance')
        if (icon != null && !hasChildren && (label == null || label === '') && !ariaLabel?.trim()) {
            throw new TypeError('Icon-only Button requires ariaLabel')
        }
        const isBusy = busy || commandRunning
        const displayedError = error ?? invocationError ?? commandError
        const content = isBusy ? (busyLabel ?? normalContent) : normalContent
        const unavailable = disabled || (isBusy && disableWhileRunning)

        const Host = this.Host
        return <Host className={classNames(componentClass(this.props), appearance === 'subtle' ? 'cap-subtle' : '') || null}>
            <button
                id={id}
                name={name}
                value={value == null ? undefined : String(value)}
                title={title ?? (icon == null ? undefined : ariaLabel)}
                type={type}
                disabled={unavailable}
                aria-label={ariaLabel}
                aria-controls={ariaControls}
                aria-expanded={ariaExpanded == null ? null : String(ariaExpanded)}
                aria-haspopup={ariaHasPopup}
                aria-pressed={pressed == null ? null : String(Boolean(pressed))}
                aria-busy={isBusy ? 'true' : null}
                aria-invalid={displayedError == null ? null : 'true'}
                aria-describedby={displayedError == null ? null : this.errorId}
                onClick={(event: MouseEvent) => {
                    if (unavailable) return
                    if (command != null) this.commandPresentation.invoke(command, undefined, event, {
                        commandErrors,
                        onCommandInvocationError,
                    })
                    else invoke(onClick, event)
                }}
            >{icon == null ? null : <Icon name={icon} />}{content}</button>
            {displayedError == null ? null : <ErrorMessage id={this.errorId} error={displayedError} />}
        </Host>
    }

    static override hostName = 'button'

    static override css = css`
        & > button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: .35em;
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

        &.cap-subtle > button {
            min-height: 1.75em;
            padding: .2em .3em;
            background: transparent;
            border-color: transparent;
            box-shadow: none;
        }
        &.cap-subtle > button:hover:not(:disabled, [aria-disabled="true"]) {
            background: var(--button-background-hover);
        }
        &.cap-subtle > button:focus-visible { box-shadow: var(--focus-ring); }
        &.cap-subtle > button[aria-busy="true"]:not([aria-invalid="true"]) {
            background: var(--working-background-image), transparent;
            background-size: 2rem 2rem, 100% 100%;
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
