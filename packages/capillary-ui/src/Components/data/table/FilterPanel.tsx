import {Emitter, FetchState} from '@capillaryjs/capillary'
import type {ReadableEmitter} from '@capillaryjs/capillary'

import {Component, css} from '../../component.js'
import type {ComponentConstructor, ComponentProps, CapillaryUiChild} from '../../component.js'
import {componentClass} from '../../controlUtils.js'
import {Checkbox} from '../../lineinputs/checkbox/Checkbox.js'
import type {
    CheckboxProps,
    CheckboxSymbol,
} from '../../lineinputs/checkbox/Checkbox.js'
import {ErrorMessage} from '../../status/statusPresentation.js'
import {FilterMode} from '../../../util/filterMode.js'
import type {FilterModeValue} from '../../../util/filterMode.js'

export type FilterValue = string | number

export interface FilterOption {
    value: FilterValue
    label?: CapillaryUiChild
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

    render(): CapillaryUiChild {
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
                <ErrorMessage
                    className="cap-error-banner"
                    error={error}
                    fallback={this.capillaryUiMessage('filterPanelLoadError')}
                />
            </Host>
        }
        if (isLoading && values.length === 0) {
            return <Host className={hostClass} aria-busy="true">
                <p role="status">{this.capillaryUiMessage('filterPanelLoading')}</p>
            </Host>
        }

        return <Host
            className={hostClass}
            role="group"
            aria-label={this.props.label ?? this.capillaryUiMessage('filterPanelLabel')}
            aria-busy={isLoading ? 'true' : null}
        >
            {fetchState === FetchState.Error
                ? <ErrorMessage
                    className="cap-error-banner"
                    error={error}
                    fallback={this.capillaryUiMessage('filterPanelLoadError')}
                />
                : null}
            {isLoading ? <p role="status">{this.capillaryUiMessage('filterPanelLoading')}</p> : null}
            {values.length === 0
                ? <p>{this.capillaryUiMessage('filterPanelEmpty')}</p>
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

    static dependencies = [Checkbox, ErrorMessage]

    static override hostName = 'filter-panel'

    static css = css`
        & {
            position: absolute;
            color: var(--filter-panel-color);
            background: var(--filter-panel-background);
            border: var(--filter-panel-border);
            border-radius: var(--filter-panel-radius);
            padding: var(--filter-panel-padding);
            min-width: var(--filter-panel-min-width);
            box-shadow: var(--filter-panel-shadow);
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

        &[aria-busy="true"]::after {
            content: "";
            position: absolute;
            z-index: 1;
            inset: 0;
            background-image: var(--working-background-image);
            background-repeat: repeat;
            background-size: 2rem 2rem;
            animation: cap-working-progress .55s linear infinite;
            pointer-events: none;
        }

        &:has(> cap-error) {
            border-color: var(--error-color);
        }

        @media (prefers-reduced-motion: reduce) {
            &[aria-busy="true"]::after {
                animation: none !important;
            }
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

function optionLabel(option: FilterOptionInput): CapillaryUiChild {
    if (option != null && typeof option === 'object') {
        const label = Reflect.get(option, 'label')
        if (label != null) return isCapillaryUiLabel(label) ? label : String(label)
    }
    return String(optionValue(option))
}

function optionKey(value: FilterValue): string {
    return `${typeof value}:${String(value)}`
}

function isCapillaryUiLabel(value: unknown): value is string | number {
    return typeof value === 'string' || typeof value === 'number'
}

function isEmitterLike<TValue>(value: unknown): value is ReadableEmitter<TValue, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}
