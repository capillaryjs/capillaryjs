import {Component, css} from '../../component.js'
import type {ComponentProps, FrayChild} from '../../component.js'
import {
    componentClass,
    createValueEmitter,
    describeState,
    invoke,
} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import {FilterMode} from '../../../util/filterMode.js'
import type {FilterModeValue} from '../../../util/filterMode.js'

export type CheckboxValue = string | number
export type CheckboxSymbol<TValue extends CheckboxValue = FilterModeValue> = readonly [
    symbol: FrayChild,
    value: TValue,
]

export interface CheckboxProps<TValue extends CheckboxValue = FilterModeValue>
    extends ValueControlProps<TValue> {
    symbols?: readonly CheckboxSymbol<TValue>[]
    initialSemanticState?: TValue
    label?: FrayChild
    disabled?: boolean
    required?: boolean
    name?: string
    onChange?: (value: TValue, event: Event | null) => void
}

/** Keyboard-operable semantic state cycler. */
export class Checkbox<TValue extends CheckboxValue = FilterModeValue>
    extends Component<CheckboxProps<TValue>> {
    static symbols: readonly CheckboxSymbol<FilterModeValue>[] = [
        ['☐', FilterMode.Neutral],
        ['✓', FilterMode.Prefer],
    ]
    static defaultSemanticState = FilterMode.Neutral

    readonly symbols: readonly CheckboxSymbol<TValue>[]
    readonly valueEmitter: ValueEmitter<TValue>
    readonly semanticStateEmitter: ValueEmitter<TValue>

    constructor(props: CheckboxProps<TValue> = {}) {
        super(props)
        const componentType = this.constructor as typeof Checkbox
        // Static members cannot carry the instance's generic state parameter;
        // subclasses validate the tuple values before this boundary is used.
        this.symbols = props.symbols
            ?? componentType.symbols as unknown as readonly CheckboxSymbol<TValue>[]
        validateSymbols(this.symbols)
        const fallback = props.initialSemanticState
            ?? componentType.defaultSemanticState as TValue
            ?? this.symbols[0]![1]
        const emitterProps: CheckboxProps<TValue> = {...props}
        if (emitterProps.defaultValue == null && props.initialSemanticState != null) {
            emitterProps.defaultValue = props.initialSemanticState
        }
        this.valueEmitter = createValueEmitter<TValue>(this, emitterProps, fallback,
            'checkbox semantic state')
        // Compatibility alias used only by the experimental filter implementation.
        this.semanticStateEmitter = this.valueEmitter
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    cycleState(direction = 1, event: Event | null = null): void {
        if (this.props.disabled) return
        const currentIndex = this.symbols.findIndex(([, state]) =>
            Object.is(state, this.valueEmitter.get()))
        const baseIndex = currentIndex < 0 ? 0 : currentIndex
        const nextIndex = (baseIndex + direction + this.symbols.length) % this.symbols.length
        const nextValue = this.symbols[nextIndex]![1]
        this.valueEmitter.set(nextValue, 'checkbox state changed')
        invoke(this.props.onChange, nextValue, event)
    }

    render(): FrayChild {
        const {
            label = this.props.value ?? 'Option',
            disabled = false,
            required = false,
            name,
            value,
        } = this.props
        const semanticState = this.valueEmitter.get()
        const [symbol] = this.symbols.find(([, state]) => Object.is(state, semanticState))
            ?? ['?', semanticState]
        const stateName = describeState(semanticState)
        const checked = semanticState === FilterMode.Prefer
            || semanticState === FilterMode.Require

        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            data-disabled={disabled ? '' : null}
            data-required={required ? '' : null}
            data-state={stateName}
        >
            <button
                type="button"
                role="checkbox"
                disabled={disabled}
                name={name}
                value={value == null ? undefined : String(value)}
                data-part="control"
                aria-checked={checked ? 'true' : 'false'}
                aria-required={required ? 'true' : null}
                aria-label={`${label}: ${stateName}`}
                onClick={(event: MouseEvent) => this.cycleState(1, event)}
                onKeyDown={(event: KeyboardEvent) => {
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                        event.preventDefault()
                        this.cycleState(1, event)
                    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                        event.preventDefault()
                        this.cycleState(-1, event)
                    }
                }}
            >
                <span data-part="symbol" aria-hidden="true">{symbol}</span>
                <span data-part="label">{label}</span>
            </button>
        </Host>
    }

    static override hostName = 'checkbox'
    static override standaloneHostName = 'check-box'

    static baseStyles = [
        ['&', ['inputline']],
        ['& > [data-part="control"]', ['input', 'inputline']],
        ['&[data-disabled]', ['disabled']],
    ]

    static css = css`
        & > [data-part="control"] {
            display: inline-flex;
            align-items: center;
            gap: 0.35em;
            width: auto;
            font-family: inherit;
        }

        & [data-part="symbol"] {
            display: inline-grid;
            width: 1em;
            height: 1em;
            line-height: 1;
            place-items: center;
            border: var(--cbx-o-border, 1px solid currentColor);
            border-radius: var(--cbx-border-radius, var(--ui-border-radius));
        }
    `
}

function validateSymbols<TValue extends CheckboxValue>(
    symbols: unknown,
): asserts symbols is readonly CheckboxSymbol<TValue>[] {
    if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new TypeError('Checkbox symbols must be a non-empty tuple array')
    }
    for (const tuple of symbols) {
        if (!Array.isArray(tuple) || tuple.length < 2) {
            throw new TypeError('Checkbox symbols must be [symbol, state] tuples')
        }
    }
}
