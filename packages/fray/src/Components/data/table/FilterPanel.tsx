import {Emitter, FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'

import {Component, css} from '../../component.js'
import type {ComponentConstructor, ComponentProps, FrayChild} from '../../component.js'
import {componentClass} from '../../controlUtils.js'
import {Checkbox} from '../../lineinputs/checkbox/Checkbox.js'
import type {
    CheckboxProps,
    CheckboxSymbol,
} from '../../lineinputs/checkbox/Checkbox.js'
import {FilterMode} from '../../../util/filterMode.js'
import type {FilterModeValue} from '../../../util/filterMode.js'

export type FilterValue = string | number

export interface FilterOption {
    value: FilterValue
    label?: FrayChild
}

export type FilterOptionInput = FilterValue | FilterOption
export type FilterOptions = readonly FilterOptionInput[]
export type FilterOptionsSource = FilterOptions | ReadableEmitter<FilterOptions, unknown>
export type FilterSelection = ReadonlyMap<FilterValue, FilterModeValue>

export interface FilterPanelProps extends ComponentProps {
    options?: FilterOptionsSource
    filters?: FilterSelection | readonly (readonly [FilterValue, FilterModeValue])[]
    filterModes?: readonly CheckboxSymbol<FilterModeValue>[]
    defaultSemanticState?: FilterModeValue
    label?: string
    onChange?: (filters: Map<FilterValue, FilterModeValue>, event: Event | null) => void
}

/** Filter choices whose option data is always supplied by the caller. */
export class FilterPanel extends Component<FilterPanelProps> {
    static override liveProps: readonly string[] = []
    readonly optionsEmitter: ReadableEmitter<FilterOptions, unknown> | null
    private readonly optionStateEmitters = new Map<FilterValue, Emitter<FilterModeValue>>()
    private staleOptionValues = new Set<FilterValue>()

    constructor(props: FilterPanelProps = {}) {
        super(props)
        this.optionsEmitter = isEmitterLike<FilterOptions>(props.options) ? props.options : null
    }

    initialize(): void {
        if (this.optionsEmitter) this.watch(this.optionsEmitter)
    }

    render(): FrayChild {
        const values = this.optionsEmitter?.get()
            ?? (Array.isArray(this.props.options) ? this.props.options : [])
        if (!Array.isArray(values)) {
            throw new TypeError('FilterPanel options must be an array or emitter of arrays')
        }
        const fetchState = this.optionsEmitter?.getFetchState() ?? FetchState.Ready
        const error = this.optionsEmitter?.getError()
        const filters = normalizeFilters(this.props.filters)
        const filterModes = this.props.filterModes ?? Checkbox.symbols
        const defaultSemanticState = this.props.defaultSemanticState ?? FilterMode.Neutral
        const activeValues = new Set(values.map(optionValue))
        this.staleOptionValues = new Set(
            [...this.optionStateEmitters.keys()].filter((value) => !activeValues.has(value)),
        )
        const Host = this.Host

        const isLoading = fetchState === FetchState.Initial || fetchState === FetchState.Loading
        const hostClass = componentClass(this.props) || null
        if (fetchState === FetchState.Error && values.length === 0) {
            return <Host className={hostClass}>
                <p role="alert">{errorMessage(error, 'Unable to load filter options')}</p>
            </Host>
        }
        if (isLoading && values.length === 0) {
            return <Host className={hostClass}>
                <p role="status">Loading filter options…</p>
            </Host>
        }

        return <Host
            className={hostClass}
            role="group"
            aria-label={this.props.label ?? 'Filter options'}
            aria-busy={isLoading ? 'true' : null}
        >
            {fetchState === FetchState.Error
                ? <p role="alert">{errorMessage(error, 'Unable to load filter options')}</p>
                : null}
            {isLoading ? <p role="status">Loading filter options…</p> : null}
            {values.length === 0
                ? <p>No filter options</p>
                : values.map((option) => {
                    const value = optionValue(option)
                    const label = optionLabel(option)
                    const state = filters.get(value) ?? defaultSemanticState
                    const valueEmitter = this.optionEmitter(value, state)
                    return <FilterModeCheckbox
                        key={optionKey(value)}
                        label={label}
                        valueEmitter={valueEmitter}
                        symbols={filterModes}
                        onChange={(nextState, event) => {
                            event?.stopPropagation()
                            const next = normalizeFilters(this.props.filters)
                            if (nextState === FilterMode.Neutral) next.delete(value)
                            else next.set(value, nextState)
                            this.props.onChange?.(next, event)
                        }}
                    />
                })}
        </Host>
    }

    afterUpdate(_dom: ChildNode | null): void {
        for (const value of this.staleOptionValues) {
            this.optionStateEmitters.get(value)?.dispose()
            this.optionStateEmitters.delete(value)
        }
        this.staleOptionValues.clear()
    }

    onDestroy(): void {
        for (const emitter of this.optionStateEmitters.values()) emitter.dispose()
        this.optionStateEmitters.clear()
    }

    private optionEmitter(
        value: FilterValue,
        state: FilterModeValue,
    ): Emitter<FilterModeValue> {
        const existing = this.optionStateEmitters.get(value)
        if (existing != null) {
            if (existing.get() !== state) existing.set(state, 'filter option synchronized')
            return existing
        }
        const emitter = new Emitter(state, {owner: this, purpose: `filter option ${String(value)}`})
        this.optionStateEmitters.set(value, emitter)
        return emitter
    }

    static dependencies = [Checkbox]

    static override hostName = 'filter-panel'

    static css = css`
        & {
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            padding: 8px;
            min-width: 180px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            display: flex;
            flex-flow: column nowrap;
            align-items: flex-start;
            left: 100%;
            top: 0;
            user-select: none;
        }

        & > p {
            margin: 0;
        }
    `
}

// Passing a generic class as a runtime vnode erases its state parameter. The
// concrete props below restore the FilterMode relationship checked by tsc.
const FilterModeCheckbox = Checkbox as unknown as ComponentConstructor<
    CheckboxProps<FilterModeValue>
>

function normalizeFilters(
    filters: FilterPanelProps['filters'],
): Map<FilterValue, FilterModeValue> {
    if (filters == null) return new Map<FilterValue, FilterModeValue>()
    if (filters instanceof Map) return new Map(filters)
    if (Array.isArray(filters)) return new Map(filters)
    throw new TypeError('FilterPanel filters must be a Map or tuple array')
}

function optionValue(option: FilterOptionInput): FilterValue {
    if (typeof option === 'string' || typeof option === 'number') return option
    if (option != null && typeof option === 'object') {
        const value = Reflect.get(option, 'value')
        if (typeof value === 'string' || typeof value === 'number') return value
    }
    throw new TypeError('Filter options must be strings, numbers, or value/label objects')
}

function optionLabel(option: FilterOptionInput): FrayChild {
    if (option != null && typeof option === 'object') {
        const label = Reflect.get(option, 'label')
        if (label != null) return isFrayLabel(label) ? label : String(label)
    }
    return String(optionValue(option))
}

function optionKey(value: FilterValue): string {
    return `${typeof value}:${String(value)}`
}

function isFrayLabel(value: unknown): value is string | number {
    return typeof value === 'string' || typeof value === 'number'
}

function isEmitterLike<TValue>(value: unknown): value is ReadableEmitter<TValue, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}

function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message
    return error == null ? fallback : String(error)
}
