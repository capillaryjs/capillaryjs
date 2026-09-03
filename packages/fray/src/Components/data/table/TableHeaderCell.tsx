import {Component, css} from '../../component.js'
import type {ComponentProps, FrayChild} from '../../component.js'
import type {ValueEmitter} from '../../controlUtils.js'
import type {CheckboxSymbol} from '../../lineinputs/checkbox/Checkbox.js'
import type {FilterModeValue} from '../../../util/filterMode.js'
import {FilterPanel} from './FilterPanel.js'
import type {
    FilterOptionsSource,
    FilterSelection,
    FilterValue,
} from './FilterPanel.js'
import type {TableFilters, TableSort} from './tableQuery.js'

export type TableRow = Record<string, unknown>

export interface TableColumnBase {
    field: string
    label?: FrayChild
    sortable?: boolean
    filterOptions?: FilterOptionsSource
}

export interface TableColumn<TRow extends TableRow = TableRow> extends TableColumnBase {
    field: Extract<keyof TRow, string>
    render?: (row: TRow, index: number) => FrayChild
}

export interface TableHeaderCellProps extends ComponentProps, TableColumnBase {
    sortEmitter: ValueEmitter<TableSort | null>
    filtersEmitter: ValueEmitter<TableFilters>
    filterModes?: readonly CheckboxSymbol<FilterModeValue>[]
    defaultSemanticState?: FilterModeValue
    onFilterChange?: (filters: TableFilters, event: Event | null) => void
}

export class TableHeaderCell extends Component<TableHeaderCellProps> {
    private filterVisible = false

    initialize(): void {
        this.watch(this.props.sortEmitter, this.props.filtersEmitter)
        if (this.props.filterOptions != null) {
            this.listen<MouseEvent>(document, 'click', this.onGlobalClick)
        }
    }

    toggleSort(): void {
        if (!this.props.sortable) return
        const current = this.props.sortEmitter.get()
        let next: TableSort | null
        if (current?.field !== this.props.field) {
            next = {field: this.props.field, direction: 'asc'}
        } else if (current.direction === 'asc') {
            next = {field: this.props.field, direction: 'desc'}
        } else next = null
        this.props.sortEmitter.set(next, 'table sort changed')
    }

    toggleFilterPanel(event: MouseEvent): void {
        event.stopPropagation()
        this.filterVisible = !this.filterVisible
        this.update()
    }

    updateFilters(next: FilterSelection, event: Event | null): void {
        const filters: TableFilters = {...this.props.filtersEmitter.get()}
        if (next.size === 0) delete filters[this.props.field]
        else filters[this.props.field] = [...next.entries()]
        this.props.filtersEmitter.set(filters, 'table filters changed')
        this.props.onFilterChange?.(filters, event)
    }

    render(): FrayChild {
        const currentSort = this.props.sortEmitter.get()
        const direction = currentSort?.field === this.props.field
            ? currentSort.direction
            : null
        const filters = new Map<FilterValue, FilterModeValue>(
            (this.props.filtersEmitter.get()[this.props.field] ?? [])
                .filter(isFilterSelectionEntry),
        )
        const label = this.props.label ?? String(this.props.field)
        const filterLabel = `Filter ${String(label)}`

        let panel: FrayChild = null
        if (this.filterVisible && this.props.filterOptions != null) {
            panel = <FilterPanel
                key="filter-panel"
                label={filterLabel}
                options={this.props.filterOptions}
                filters={filters}
                onChange={(next, event) => this.updateFilters(next, event)}
                {...(this.props.filterModes == null
                    ? {}
                    : {filterModes: this.props.filterModes})}
                {...(this.props.defaultSemanticState == null
                    ? {}
                    : {defaultSemanticState: this.props.defaultSemanticState})}
            />
        }

        return <th
            scope="col"
            data-fray-component="table-header-cell"
            aria-sort={direction === 'asc'
                ? 'ascending'
                : direction === 'desc' ? 'descending' : 'none'}
        >
            {this.props.sortable
                ? <button
                    type="button"
                    data-part="sort"
                    onClick={() => this.toggleSort()}
                >
                    {label}
                    {direction === 'asc' ? ' ▲' : direction === 'desc' ? ' ▼' : ''}
                </button>
                : <span data-part="label">{label}</span>}
            {this.props.filterOptions == null
                ? null
                : <button
                    type="button"
                    data-part="filter-toggle"
                    aria-label={filterLabel}
                    aria-expanded={String(this.filterVisible)}
                    onClick={(event: MouseEvent) => this.toggleFilterPanel(event)}
                >Filter</button>}
            {panel}
        </th>
    }

    private readonly onGlobalClick = (event: MouseEvent): void => {
        if (this.filterVisible
            && this.dom instanceof Node
            && event.target instanceof Node
            && !this.dom.contains(event.target)) {
            this.filterVisible = false
            this.update()
        }
    }

    static dependencies = [FilterPanel]

    static baseStyles = [
        ['th[data-fray-component="table-header-cell"]', 'noselect'],
        ['th[data-fray-component="table-header-cell"] > [data-part="sort"]', ['uiline', 'button']],
        ['th[data-fray-component="table-header-cell"] > [data-part="filter-toggle"]', ['uiline', 'button']],
    ]

    static css = css`
        th[data-fray-component="table-header-cell"] {
            position: relative;
            text-align: start;
            color: var(
                --fray-table-header-color,
                var(--fray-section-header-color, var(--fray-header-color))
            );
            background: var(
                --fray-table-header-background,
                var(--fray-section-header-background, var(--fray-header-background))
            );
            border-block-end: var(--fray-section-header-border, var(--fray-header-border));
            box-shadow: var(--fray-section-header-shadow, var(--fray-header-shadow));
        }

        th[data-fray-component="table-header-cell"] > [data-part="sort"],
        th[data-fray-component="table-header-cell"] > [data-part="filter-toggle"] {
            width: auto;
            font-family: inherit;
            color: inherit;
            background: var(
                --fray-table-header-button-background,
                var(--fray-button-background)
            );
        }

        th[data-fray-component="table-header-cell"] > [data-part="filter-toggle"] {
            margin-inline-start: var(--ui-padding-h);
            font-size: 0.75em;
        }
    `
}

function isFilterSelectionEntry(
    entry: readonly [unknown, FilterModeValue],
): entry is readonly [FilterValue, FilterModeValue] {
    return typeof entry[0] === 'string' || typeof entry[0] === 'number'
}
