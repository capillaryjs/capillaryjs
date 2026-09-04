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
        // Compatibility alias used by filter controls.
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
        } = this.props
        const semanticState = this.valueEmitter.get()
        const semanticIndex = this.symbols.findIndex(([, state]) =>
            Object.is(state, semanticState))
        const [symbol] = this.symbols[semanticIndex] ?? ['?', semanticState]
        const stateName = describeState(semanticState)
        const checked = semanticState === FilterMode.Prefer
            || semanticState === FilterMode.Require
            || (this.symbols.length === 2 && semanticIndex === 1)

        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            data-disabled={disabled ? '' : null}
            data-required={required ? '' : null}
            data-state={stateName}
        >
            <label>
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    required={required}
                    name={this.props.name}
                    value={this.props.value == null ? undefined : String(this.props.value)}
                    data-state={stateName}
                    aria-label={`${label}: ${stateName}`}
                    onChange={(event: Event) => this.cycleState(1, event)}
                    onKeyDown={(event: KeyboardEvent) => {
                        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                            event.preventDefault()
                            this.cycleState(1, event)
                        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                            event.preventDefault()
                            this.cycleState(-1, event)
                        }
                    }}
                />
                <span className="checkboxshell" aria-hidden="true">{symbol}</span>
                <span>{label}</span>
            </label>
        </Host>
    }

    static override hostName = 'check-box'
    static override standaloneHostName = 'check-box'

    static css = css`
        & {
            display: inline-block;
        }

        & > label {
            display: inline-flex;
            align-items: center;
            gap: 0.35em;
            cursor: pointer;
        }

        &[data-disabled] > label {
            cursor: not-allowed;
        }

        & input[type="checkbox"] {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
            border: 0;
            font: inherit;
            font-size: var(--ui-font-size, inherit);
        }

        & input[type="checkbox"] + .checkboxshell {
            position: relative;
            display: inline-grid;
            width: 1em;
            height: 1em;
            flex: 0 0 1em;
            overflow: hidden;
            box-sizing: border-box;
            line-height: 1;
            place-items: center;
            color: var(--input-color, var(--ui-text-color, currentColor));
            background: var(--checkbox-box-background, var(--ui-input-bg, transparent));
            border: var(--checkbox-box-border, var(--cbx-o-border, 1px solid currentColor));
            border-radius: var(--cbx-border-radius, var(--radius-sm, 0.2rem));
            font-family: inherit;
            font-size: 1em;
            user-select: none;
        }

        & input[type="checkbox"]:checked + .checkboxshell {
            color: var(--checkbox-symbol-color, var(--selection-color, currentColor));
            background: var(--checkbox-box-background-checked,
                var(--selection-background, var(--ui-accent-color, Highlight)));
        }

        & input[type="checkbox"]:focus-visible + .checkboxshell {
            outline: 2px solid var(--focus-color, var(--ui-accent-color, Highlight));
            outline-offset: 1px;
        }

        & input[type="checkbox"]:disabled + .checkboxshell {
            opacity: 0.6;
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
