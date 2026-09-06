import {Component, css, h} from '../../component.js'
import type {ComponentProps, FrayChild, LivePropContract} from '../../component.js'
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
    extends Component<CheckboxProps<TValue>> {
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
        const checked = semanticState === FilterMode.Prefer
            || semanticState === FilterMode.Require
            || (this.symbols.length === 2 && semanticIndex === 1)

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
                    value={this.props.value == null ? undefined : String(this.props.value)}
                    aria-label={`${label}: ${stateName}`}
                    aria-invalid={error == null ? null : 'true'}
                    aria-describedby={error == null ? null : this.errorId}
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
                {h('fray-checkboxshell', {'aria-hidden': 'true'}, shellSymbol)}
                {label}
            </label>
            {error == null ? null : <p id={this.errorId} role="alert">{String(error)}</p>}
        </Host>
    }

    static override hostName = 'check-box'

    static css = css`
        & {
            display: inline-flex;
            line-height: 1;
        }

        & > label {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            line-height: calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding));
            font-size: var(--ui-font-size);
            height: calc(var(--ui-font-size) + var(--ui-padding-h) + var(--ui-padding-h));
            color: var(--ui-text-color);
            border-radius: var(--ui-border-radius);
            box-sizing: border-box;
            align-items: center;
            gap: .3em;
            align-content: center;
            justify-content: center;
            justify-items: center;
            cursor: pointer;
            user-select: none;
        }

        & > label:has(> input[type="checkbox"]:disabled) {
            color: #aaa;
            cursor: not-allowed;
        }

        & > label > input[type="checkbox"] {
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

        & > label > input[type="checkbox"] + fray-checkboxshell {
            position: relative;
            display: block;
            width: 1em;
            height: 1em;
            flex: 0 0 1em;
            box-sizing: border-box;
            text-align: center;
            line-height: 120%;
            color: var(--input-color, var(--ui-text-color, currentColor));
            background: var(--checkbox-box-background, var(--ui-input-bg, transparent));
            border: var(--checkbox-box-border, var(--cbx-o-border, 1px solid currentColor));
            border-radius: var(--cbx-border-radius, var(--radius-sm, 0.2rem));
            box-shadow: var(--checkbox-box-shadow);
            font-family: inherit;
            font-size: 1em;
            user-select: none;
        }

        & > label > input[type="checkbox"]:checked + fray-checkboxshell {
            color: var(--checkbox-symbol-color, var(--selection-color, currentColor));
            background: var(--checkbox-box-background-checked,
                var(--selection-background, var(--ui-accent-color, Highlight)));
            box-shadow: var(--checkbox-box-shadow-checked);
        }

        & > label > input[type="checkbox"]:focus-visible + fray-checkboxshell {
            outline: 2px solid var(--focus-color, var(--ui-accent-color, Highlight));
            outline-offset: 1px;
        }

        & > label > input[type="checkbox"]:disabled + fray-checkboxshell {
            opacity: 0.6;
            filter: saturate(0.6);
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
