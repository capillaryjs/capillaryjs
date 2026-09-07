import {Component, css} from '../component.js'
import type {FrayChild, Key, LivePropContract} from '../component.js'
import {
    assertOptions,
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'

export type ToggleOption<TValue extends Key = string> = readonly [
    value: TValue,
    label: FrayChild,
]

const toggleLiveProps = ['disabled', 'required', 'error'] as const

export interface ToggleProps<TValue extends Key = string>
    extends ValueControlProps<TValue>, LivePropContract<(typeof toggleLiveProps)[number]> {
    id?: string | number | null
    options?: readonly ToggleOption<TValue>[]
    label?: FrayChild
    ariaLabel?: string
    disabled?: boolean
    required?: boolean
    error?: unknown
    onChange?: (value: TValue, event: Event | null) => void
}

/** Mutually exclusive button group with radio-group semantics. */
export class Toggle<TValue extends Key = string> extends Component<ToggleProps<TValue>> {
    static override liveProps = toggleLiveProps
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

    render(): FrayChild {
        const {
            options = [],
            label,
            disabled = false,
            required = false,
            error = null,
        } = this.props
        validateToggleOptions(options)
        const selectedValue = this.valueEmitter.get()
        const selectedIndex = Math.max(0,
            options.findIndex(([value]) => Object.is(value, selectedValue)))

        const Host = this.Host
        return <Host id={this.groupId} className={componentClass(this.props) || null}>
            {label == null ? null : <fray-label id={this.legendId}>{label}</fray-label>}
            <fray-options
                role="radiogroup"
                aria-label={label == null ? this.props.ariaLabel : null}
                aria-labelledby={label == null ? null : this.legendId}
                aria-required={required ? 'true' : null}
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
            >{optionLabel}</button>)}</fray-options>
            {error == null ? null : <fray-error
                id={this.errorId}
                role="alert"
            >{String(error)}</fray-error>}
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
            display: inline-block;
            inline-size: fit-content;
            max-inline-size: 100%;
        }

        & > fray-label,
        & > fray-error {
            display: block;
        }

        & > fray-options {
            display: flex;
            min-height: var(--control-min-height, 2rem);
            border-radius: var(--radius-md);
            box-shadow: var(--toggle-group-shadow);
            box-sizing: border-box;
            cursor: pointer;
            user-select: none;
        }

        & > fray-options > button[role="radio"] {
            position: relative;
            min-height: var(--control-min-height, 2rem);
            padding: var(--space-xs) var(--space-sm);
            color: var(--button-color);
            background: var(--toggle-button-background);
            border: var(--button-border);
            border-radius: 0;
            border-left: none;
            border-right: none;
            box-shadow: var(--toggle-button-shadow);
            box-sizing: border-box;
            cursor: default;
            font-family: inherit;
            font-size: var(--ui-font-size);
            line-height: calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding));
            user-select: none;
            white-space: nowrap;
        }

        & > fray-options > button[role="radio"]:hover:not(:disabled)[aria-checked="false"] {
            background: var(--button-background-hover);
        }

        & > fray-options > button[role="radio"]:first-of-type {
            border-radius: var(--radius-md) 0 0 var(--radius-md);
            border: var(--button-border);
            border-right: none;
        }

        & > fray-options > button[role="radio"]:last-of-type {
            border-radius: 0 var(--radius-md) var(--radius-md) 0;
            border: var(--button-border);
            border-left: none;
        }

        & > fray-options > button[role="radio"][aria-checked="false"]
        + [role="radio"][aria-checked="false"] {
            border-inline-start: var(--button-border);
            border-inline-start-color: var(--toggle-inactive-shared-border-color);
        }

        & > fray-options > button[role="radio"][aria-checked="true"] {
            color: var(--selection-color);
            background: var(--toggle-button-background-checked);
            border: var(--toggle-button-border-checked);
            box-shadow: var(--toggle-button-shadow-checked);
            margin-inline: var(--toggle-button-selected-inline-overlap);
            z-index: var(--toggle-button-selected-z-index);
        }

        & > fray-options > button[role="radio"]:disabled {
            color: var(--input-color-disabled);
            background: var(--button-background-disabled);
            border: var(--button-border-disabled);
            cursor: not-allowed;
        }

        & > fray-options > button[role="radio"]:active:not(:disabled) {
            border-style: var(--button-border-style-active);
        }

        & > fray-options > button[role="radio"][aria-checked="false"]
        + [role="radio"][aria-checked="false"]::after {
            content: '';
            position: absolute;
            inset-block: var(--toggle-inactive-separator-block-inset);
            inline-size: 1px;
            inset-inline-start: -1px;
            background: var(--toggle-inactive-separator-background);
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
