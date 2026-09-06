import {css, h} from '../../component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../../component.js'
import {CheckableControl} from '../CheckableControl.js'
import {
    componentClass,
    controlId,
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

const checkboxLiveProps = ['disabled', 'required', 'error'] as const

export interface CheckboxProps<TValue extends CheckboxValue = FilterModeValue>
    extends ValueControlProps<TValue>, LivePropContract<(typeof checkboxLiveProps)[number]> {
    id?: string | number | null
    symbols?: readonly CheckboxSymbol<TValue>[]
    initialSemanticState?: TValue
    label?: FrayChild
    disabled?: boolean
    required?: boolean
    error?: unknown
    name?: string
    onChange?: (value: TValue, event: Event | null) => void
}

/** Keyboard-operable semantic state cycler. */
export class Checkbox<TValue extends CheckboxValue = FilterModeValue>
    extends CheckableControl<CheckboxProps<TValue>> {
    static override liveProps = checkboxLiveProps
    static symbols: readonly CheckboxSymbol<FilterModeValue>[] = [
        ['☐', FilterMode.Neutral],
        ['✓', FilterMode.Prefer],
    ]
    static defaultSemanticState = FilterMode.Neutral

    readonly symbols: readonly CheckboxSymbol<TValue>[]
    readonly valueEmitter: ValueEmitter<TValue>
    readonly semanticStateEmitter: ValueEmitter<TValue>
    readonly inputId: string
    readonly errorId: string

    constructor(props: CheckboxProps<TValue> = {}) {
        super(props)
        this.inputId = controlId('checkbox', props.id)
        this.errorId = `${this.inputId}-error`
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
            error = null,
        } = this.props
        const semanticState = this.valueEmitter.get()
        const semanticIndex = this.symbols.findIndex(([, state]) =>
            Object.is(state, semanticState))
        const [symbol] = this.symbols[semanticIndex] ?? ['?', semanticState]
        // Bank2 uses the conventional neutral marker only to select the empty
        // checkbox surface; it is not visible glyph content.
        const shellSymbol = symbol === '☐' ? null : symbol
        const stateName = describeState(semanticState)
        const checked = isCheckedSemanticState(this.symbols, semanticState)

        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            data-state={stateName}
        >
            <label>
                <input
                    id={this.inputId}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    required={required}
                    name={this.props.name}
                    value={String(semanticState)}
                    aria-label={`${label}: ${stateName}`}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
                    onChange={(event: Event) => {
                        this.cycleState(1, event)
                        // A native checkbox toggles its binary checked property before
                        // it emits change. Deny and Neutral both map to unchecked, so
                        // a VDOM patch can otherwise see the same checked prop as its
                        // previous render and leave that native toggle behind.
                        ;(event.currentTarget as HTMLInputElement).checked = isCheckedSemanticState(
                            this.symbols,
                            this.valueEmitter.get(),
                        )
                    }}
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
                {h('fray-checkshell', {'aria-hidden': 'true'}, shellSymbol)}
                {label}
            </label>
            {error == null ? null : <p id={this.errorId} role="alert">{String(error)}</p>}
        </Host>
    }

    static override hostName = 'check-box'

    static override css = css`
        & > label > input[value="require"] + fray-checkshell {
            color: var(--palette-contrast-light);
            background: var(--palette-green);
            box-shadow: var(--checkbox-box-shadow-checked);
        }

        & > label > input[value="deny"] + fray-checkshell {
            color: var(--palette-contrast-light);
            background: var(--palette-red);
            box-shadow: var(--checkbox-box-shadow-checked);
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

function isCheckedSemanticState<TValue extends CheckboxValue>(
    symbols: readonly CheckboxSymbol<TValue>[],
    semanticState: TValue,
): boolean {
    const semanticIndex = symbols.findIndex(([, state]) => Object.is(state, semanticState))
    return semanticState === FilterMode.Prefer
        || semanticState === FilterMode.Require
        || (symbols.length === 2 && semanticIndex === 1)
}
