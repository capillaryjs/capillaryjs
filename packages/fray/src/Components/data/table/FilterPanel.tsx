import {FetchState} from '@sylwellsoftware/glue'
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

/** Experimental filter choices. Option data is always supplied by the caller. */
export class FilterPanel extends Component<FilterPanelProps> {
    readonly optionsEmitter: ReadableEmitter<FilterOptions, unknown> | null

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
        const Host = this.Host

        if (fetchState === FetchState.Error) {
            return <Host
                className={componentClass(this.props) || null}
                role="alert"
                data-state="error"
            >{errorMessage(error, 'Unable to load filter options')}</Host>
        }
        if ((fetchState === FetchState.Initial || fetchState === FetchState.Loading)
            && values.length === 0) {
            return <Host
                className={componentClass(this.props) || null}
                role="status"
                data-state="loading"
            >Loading filter options…</Host>
        }

        return <Host
            className={componentClass(this.props) || null}
            role="group"
            aria-label={this.props.label ?? 'Filter options'}
        >
            {values.length === 0
                ? <span>No filter options</span>
                : values.map((option) => {
                    const value = optionValue(option)
                    const label = optionLabel(option)
                    const state = filters.get(value) ?? defaultSemanticState
                    return <FilterModeCheckbox
                        key={`${String(value)}:${String(state)}`}
                        label={label}
                        defaultValue={state}
                        symbols={filterModes}
                        onChange={(nextState, event) => {
                            event?.stopPropagation()
                            const next = new Map(filters)
                            if (nextState === FilterMode.Neutral) next.delete(value)
                            else next.set(value, nextState)
                            this.props.onChange?.(next, event)
                        }}
                    />
                })}
        </Host>
    }

    static dependencies = [Checkbox]

    static override hostName = 'filter-panel'
    static override standaloneHostName = 'filter-panel'

    static css = css`
        & {
            position: absolute;
            z-index: 1000;
            inset-block-start: 100%;
            inset-inline-end: 0;
            display: flex;
            min-width: 12rem;
            padding: var(--ui-padding);
            flex-flow: column nowrap;
            align-items: stretch;
            color: var(--panel-color);
            background: var(--panel-bg);
            border: var(--panel-border);
            border-radius: var(--panel-radius);
            box-shadow: var(--panel-shadow);
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
