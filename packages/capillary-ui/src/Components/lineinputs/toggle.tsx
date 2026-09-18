import {css} from '../component.js'
import type {CapillaryUiChild, Key, LivePropContract} from '../component.js'
import {LabeledInputControl} from './LabeledInputControl.js'
import {
    assertOptions,
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {ErrorMessage} from '../status/statusPresentation.js'

export type ToggleOption<TValue extends Key = string> = readonly [
    value: TValue,
    label: CapillaryUiChild,
]

const toggleLiveProps = ['disabled', 'required', 'busy', 'error'] as const

export interface ToggleProps<TValue extends Key = string>
    extends ValueControlProps<TValue>, LivePropContract<(typeof toggleLiveProps)[number]> {
    id?: string | number | null
    options?: readonly ToggleOption<TValue>[]
    label?: CapillaryUiChild
    ariaLabel?: string
    disabled?: boolean
    required?: boolean
    busy?: boolean
    error?: unknown
    onChange?: (value: TValue, event: Event | null) => void
}

/** Mutually exclusive button group with radio-group semantics. */
export class Toggle<TValue extends Key = string> extends LabeledInputControl<ToggleProps<TValue>> {
    static override liveProps = toggleLiveProps
    static override dependencies = [ErrorMessage]
    readonly valueEmitter: ValueEmitter<TValue>
    readonly groupId: string
    readonly legendId: string
    readonly errorId: string

    constructor(props: ToggleProps<TValue> = {}) {
        super(props)
        const options = props.options ?? []
        validateToggleOptions(options)
        const firstValue = options[0]?.[0] ?? null
        // Null is the runtime no-option sentinel and is used only when no
        // controlled/default value exists for an empty option set.
        this.valueEmitter = createValueEmitter<TValue>(
            this,
            props,
            firstValue ?? null as unknown as TValue,
            'toggle value',
        )
        this.groupId = controlId('toggle', props.id)
        this.legendId = `${this.groupId}-label`
        this.errorId = `${this.groupId}-error`
    }

    initialize(): void {
        this.selectFirstAvailableOption(this.props.options ?? [])
        this.watch(this.valueEmitter)
    }

    setProps(nextProps: ToggleProps<TValue>): this {
        const options = nextProps.options ?? []
        validateToggleOptions(options)
        super.setProps(nextProps)
        this.selectFirstAvailableOption(options)
        return this
    }

    selectOption(value: TValue, event: Event | null = null): void {
        if (this.props.disabled) return
        this.valueEmitter.set(value, 'toggle option selected')
        invoke(this.props.onChange, value, event)
    }

    render(): CapillaryUiChild {
        const {
            options = [],
            label,
            disabled = false,
            required = false,
            busy = false,
            error = null,
        } = this.props
        validateToggleOptions(options)
        const selectedValue = this.valueEmitter.get()
        const selectedIndex = Math.max(0,
            options.findIndex(([value]) => Object.is(value, selectedValue)))

        const Host = this.Host
        return <Host id={this.groupId} className={componentClass(this.props) || null}>
            {label == null ? null : <cap-label id={this.legendId}>{label}</cap-label>}
            <cap-options
                role="radiogroup"
                aria-label={label == null ? this.props.ariaLabel : null}
                aria-labelledby={label == null ? null : this.legendId}
                aria-required={required ? 'true' : null}
                aria-busy={busy ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
            >{options.map(([value, optionLabel], index) => <button
                key={String(value)}
                type="button"
                role="radio"
                disabled={disabled}
                aria-checked={Object.is(selectedValue, value) ? 'true' : 'false'}
                tabIndex={index === selectedIndex ? 0 : -1}
                onClick={(event: MouseEvent) => this.selectOption(value, event)}
                onKeyDown={(event: KeyboardEvent) =>
                    this.handleKeyDown(event, index, options)}
            >{optionLabel}</button>)}</cap-options>
            {error == null ? null : <ErrorMessage id={this.errorId} error={error} />}
        </Host>
    }

    handleKeyDown(
        event: KeyboardEvent,
        index: number,
        options: readonly ToggleOption<TValue>[],
    ): void {
        const {key} = event
        let nextIndex
        if (key === 'ArrowRight' || key === 'ArrowDown') nextIndex = (index + 1) % options.length
        else if (key === 'ArrowLeft' || key === 'ArrowUp') {
            nextIndex = (index - 1 + options.length) % options.length
        } else if (key === 'Home') nextIndex = 0
        else if (key === 'End') nextIndex = options.length - 1
        else return

        event.preventDefault()
        const option = options[nextIndex]
        if (option == null) return
        this.selectOption(option[0], event)
        if (this.dom instanceof Element) {
            const radio = this.dom.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]
            radio?.focus()
        }
    }

    private selectFirstAvailableOption(options: readonly ToggleOption<TValue>[]): void {
        if (!options.some(([value]) => Object.is(value, this.valueEmitter.get()))) {
            this.valueEmitter.set(options[0]?.[0] ?? null as unknown as TValue,
                'toggle options changed')
        }
    }

    static override hostName = 'toggle'

    static override css = css`
        & {
            min-height: var(--control-min-height, 2em);
            display: flex;
            position: relative;
            flex-flow: row nowrap;
            align-content: center;
            align-items: center;
            gap: .75em;
            color: var(--text-color);
            outline: none;
        }

        & > cap-label {
            display: block;
            align-self: center;
        }

        & > cap-options {
            display: flex;
            min-height: var(--control-min-height, 2em);
            border-radius: var(--ui-border-radius);
            box-shadow: var(--toggle-group-shadow);
            box-sizing: border-box;
            cursor: pointer;
            user-select: none;
            margin-left: auto;
        }

        & > cap-options > button[role="radio"] {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: var(--control-min-height, 2em);
            min-width: 2em;
            margin: 0;
            padding: var(--ui-control-padding);
            position: relative;
            isolation: isolate;
            font: inherit;
            color: var(--button-color);
            background: transparent;
            user-select: none;
            white-space: nowrap;
            box-sizing: border-box;
            border: 0;
            border-radius: 0;
            cursor: default;
        }

        /* Chrome may overlap adjacent segments, but never moves their text. */
        & > cap-options > button[role="radio"]::before {
            content: '';
            position: absolute;
            inset: 0;
            z-index: -1;
            pointer-events: none;
            box-sizing: border-box;
            background: var(--toggle-button-background);
            border: var(--button-border);
            border-left: none;
            border-right: none;
            border-radius: inherit;
            box-shadow: var(--toggle-button-shadow);
        }

        & > cap-options > button[role="radio"]:hover:not(:disabled)[aria-checked="false"]::before {
            background: var(--button-background-hover);
        }

        & > cap-options > button[role="radio"]:first-of-type {
            border-radius: var(--ui-border-radius) 0 0 var(--ui-border-radius);
        }

        & > cap-options > button[role="radio"]:first-of-type::before {
            border: var(--button-border);
            border-right: none;
        }

        & > cap-options > button[role="radio"]:last-of-type {
            border-radius: 0 var(--ui-border-radius) var(--ui-border-radius) 0;
        }

        & > cap-options > button[role="radio"]:only-of-type {
            border-radius: var(--ui-border-radius);
        }

        & > cap-options > button[role="radio"]:last-of-type::before {
            border: var(--button-border);
            border-left: none;
        }

        & > cap-options > button[role="radio"][aria-checked="false"]
        + [role="radio"][aria-checked="false"]::before {
            border-inline-start: var(--button-border);
            border-inline-start-color: var(--toggle-inactive-shared-border-color);
        }

        & > cap-options > button[role="radio"][aria-checked="true"] {
            color: var(--selection-color);
            z-index: var(--toggle-button-selected-z-index);
        }

        & > cap-options > button[role="radio"][aria-checked="true"]::before {
            background: var(--toggle-button-background-checked);
            border: var(--toggle-button-border-checked);
            box-shadow: var(--toggle-button-shadow-checked);
            inset-inline: var(--toggle-button-selected-inline-overlap);
        }

        & > cap-options > button[role="radio"]:disabled {
            color: var(--input-color-disabled);
            cursor: not-allowed;
        }

        & > cap-options > button[role="radio"]:disabled::before {
            background: var(--button-background-disabled);
            border: var(--button-border-disabled);
        }

        & > cap-options[aria-busy="true"]:not([aria-invalid="true"])
        > button[role="radio"]::before {
            background: var(--working-background-image), var(--toggle-button-background);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
            animation: cap-working-progress .55s linear infinite;
        }

        & > cap-options[aria-busy="true"]:not([aria-invalid="true"])
        > button[role="radio"][aria-checked="true"]::before {
            background: var(--working-background-image), var(--toggle-button-background-checked);
            background-repeat: repeat, no-repeat;
            background-size: 2rem 2rem, 100% 100%;
        }

        & > cap-options[aria-invalid="true"] > button[role="radio"]::before {
            border-color: var(--error-control-border);
        }

        & > cap-options[aria-invalid="true"] {
            border-radius: var(--ui-border-radius);
            box-shadow: var(--error-control-shadow);
        }

        & > cap-options > button[role="radio"][aria-checked="false"]
        + [role="radio"][aria-checked="false"]::after {
            content: '';
            position: absolute;
            inset-block: var(--toggle-inactive-separator-block-inset);
            inline-size: 1px;
            inset-inline-start: -1px;
            background: var(--toggle-inactive-separator-background);
        }

        @media (prefers-reduced-motion: reduce) {
            & > cap-options[aria-busy="true"] > button[role="radio"]::before {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > cap-options[aria-invalid="true"] {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `
}

function validateToggleOptions<TValue extends Key>(
    options: unknown,
): asserts options is readonly ToggleOption<TValue>[] {
    assertOptions<unknown>(options)
    for (const option of options) {
        if (!Array.isArray(option) || option.length < 2) {
            throw new TypeError('Toggle options must be [value, label] tuples')
        }
    }
}
