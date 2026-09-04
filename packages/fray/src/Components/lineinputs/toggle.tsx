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
            error = null,
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
            data-error={error == null ? null : ''}
            aria-required={required ? 'true' : null}
            aria-invalid={error == null ? null : 'true'}
            aria-describedby={error == null ? null : this.errorId}
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
                    aria-checked={Object.is(selectedValue, value) ? 'true' : 'false'}
                    data-value={String(value)}
                    tabIndex={index === selectedIndex ? 0 : -1}
                    onClick={(event: MouseEvent) => this.selectOption(value, event)}
                    onKeyDown={(event: KeyboardEvent) =>
                        this.handleKeyDown(event, index, options)}
                >{optionLabel}</button>)}
            </div>
            {error == null ? null : <p id={this.errorId} role="alert">{String(error)}</p>}
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
        ['fieldset:has(> [data-part="options"]) > [data-part="options"]', ['uiline']],
        ['fieldset:has(> [data-part="options"]) [role="radio"]', ['uiline', 'button']],
    ]

    static css = css`
        fieldset:has(> [data-part="options"]) {
            margin: 0;
            padding: 0;
            border: 0;
        }

        fieldset:has(> [data-part="options"]) > [data-part="options"] {
            display: flex;
            padding: 0;
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
