import {Component, css} from '../component.js'
import type {FrayChild, Key} from '../component.js'
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

export interface ToggleProps<TValue extends Key = string>
    extends ValueControlProps<TValue> {
    id?: string | number | null
    options?: readonly ToggleOption<TValue>[]
    label?: FrayChild
    ariaLabel?: string
    disabled?: boolean
    required?: boolean
    onChange?: (value: TValue, event: Event | null) => void
}

/** Mutually exclusive button group with radio-group semantics. */
export class Toggle<TValue extends Key = string> extends Component<ToggleProps<TValue>> {
    readonly valueEmitter: ValueEmitter<TValue>
    readonly groupId: string
    readonly legendId: string

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
    }

    initialize(): void {
        this.watch(this.valueEmitter)
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
        } = this.props
        validateToggleOptions(options)
        const selectedValue = this.valueEmitter.get()
        const selectedIndex = Math.max(0,
            options.findIndex(([value]) => Object.is(value, selectedValue)))

        return <fieldset
            id={this.groupId}
            disabled={disabled}
            className={componentClass(this.props) || undefined}
            data-fray-component="toggle"
            data-disabled={disabled ? '' : null}
            aria-required={required ? 'true' : null}
        >
            {label == null ? null : <legend id={this.legendId}>{label}</legend>}
            <div
                data-part="options"
                role="radiogroup"
                aria-label={label == null ? this.props.ariaLabel : null}
                aria-labelledby={label == null ? null : this.legendId}
            >
                {options.map(([value, optionLabel], index) => <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    disabled={disabled}
                    data-part="option"
                    aria-checked={Object.is(selectedValue, value) ? 'true' : 'false'}
                    data-value={String(value)}
                    tabIndex={index === selectedIndex ? 0 : -1}
                    onClick={(event: MouseEvent) => this.selectOption(value, event)}
                    onKeyDown={(event: KeyboardEvent) =>
                        this.handleKeyDown(event, index, options)}
                >{optionLabel}</button>)}
            </div>
        </fieldset>
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

    static baseStyles = [
        ['fieldset[data-fray-component="toggle"] > [data-part="options"]', ['uiline']],
        ['fieldset[data-fray-component="toggle"] [data-part="option"]', ['uiline', 'button']],
    ]

    static css = css`
        fieldset[data-fray-component="toggle"] {
            margin: 0;
            padding: 0;
            border: 0;
        }

        fieldset[data-fray-component="toggle"] > [data-part="options"] {
            display: flex;
            padding: 0;
        }

        fieldset[data-fray-component="toggle"] [data-part="option"] {
            background: var(--fray-toggle-button-background, var(--fray-button-background));
            border-radius: 0;
        }

        fieldset[data-fray-component="toggle"] [data-part="option"]:first-child {
            border-radius: var(--ui-border-radius) 0 0 var(--ui-border-radius);
        }

        fieldset[data-fray-component="toggle"] [data-part="option"]:last-child {
            border-radius: 0 var(--ui-border-radius) var(--ui-border-radius) 0;
        }

        fieldset[data-fray-component="toggle"] [data-part="option"][aria-checked="true"] {
            background: var(
                --fray-toggle-button-background-checked,
                var(--fray-selection-background, var(--toggle-selected-bg))
            );
            color: var(--fray-selection-color, var(--toggle-selected-text));
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
