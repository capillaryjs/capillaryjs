import {Component, css} from '../../component.js'
import type {ComponentProps, CapillaryUiChild} from '../../component.js'
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
    label?: CapillaryUiChild
    /** Text alternative used by Capillary UI-authored sort and filter controls. */
    ariaLabel?: string
    sortable?: boolean
    filterOptions?: FilterOptionsSource
    /**
     * Derive this column's filter options from the distinct values in the
     * table's unfiltered rows. Ignored when filterOptions is supplied.
     */
    filterable?: boolean
}

export interface TableColumn<TRow extends TableRow = TableRow> extends TableColumnBase {
    field: Extract<keyof TRow, string>
    render?: (row: TRow, index: number) => CapillaryUiChild
}

export interface TableHeaderCellProps extends ComponentProps, TableColumnBase {
    sortEmitter: ValueEmitter<TableSort | null>
    filtersEmitter: ValueEmitter<TableFilters>
    filterModes?: readonly CheckboxSymbol<FilterModeValue>[]
    defaultSemanticState?: FilterModeValue
    onFilterChange?: (filters: TableFilters, event: Event | null) => void
}

export class TableHeaderCell extends Component<TableHeaderCellProps> {
    static override diagnosticLabel = 'Table header cell'
    static override liveProps: readonly string[] = []
    private filterVisible = false
    private removeGlobalClickListener: (() => void) | null = null

    initialize(): void {
        this.watch(this.props.sortEmitter, this.props.filtersEmitter)
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
        this.setGlobalClickListener(this.filterVisible)
        this.update()
    }

    updateFilters(next: FilterSelection, event: Event | null): void {
        const filters: TableFilters = {...this.props.filtersEmitter.get()}
        if (next.size === 0) delete filters[this.props.field]
        else filters[this.props.field] = [...next.entries()]
        this.props.filtersEmitter.set(filters, 'table filters changed')
        this.props.onFilterChange?.(filters, event)
    }

    render(): CapillaryUiChild {
        const currentSort = this.props.sortEmitter.get()
        const direction = currentSort?.field === this.props.field
            ? currentSort.direction
            : null
        const filters = new Map<FilterValue, FilterModeValue>(
            (this.props.filtersEmitter.get()[this.props.field] ?? [])
                .filter(isFilterSelectionEntry),
        )
        const label = this.props.label ?? String(this.props.field)
        const textLabel = this.props.ariaLabel ?? textAlternative(label) ?? String(this.props.field)
        const filterLabel = this.capillaryUiMessage('tableFilterColumnLabel')(textLabel)

        let panel: CapillaryUiChild = null
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
            aria-sort={direction === 'asc'
                ? 'ascending'
                : direction === 'desc' ? 'descending' : 'none'}
            style={{zIndex: this.filterVisible ? 1200 : null}}
        >
            {this.props.sortable
                ? <button
                    type="button"
                    class="sort"
                    aria-label={this.capillaryUiMessage('tableSortColumnLabel')(textLabel)}
                    onClick={() => this.toggleSort()}
                >
                    {label}
                    <span class="sortindicator" aria-hidden="true">
                        {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : ''}
                    </span>
                </button>
                : <span>{label}</span>}
            {this.props.filterOptions == null
                ? null
                : <button
                    type="button"
                    class="filter"
                    aria-label={filterLabel}
                    aria-expanded={String(this.filterVisible)}
                    onClick={(event: MouseEvent) => this.toggleFilterPanel(event)}
                >⛃</button>}
            {panel}
        </th>
    }

    private readonly onGlobalClick = (event: MouseEvent): void => {
        if (this.filterVisible
            && this.dom instanceof Node
            && event.target instanceof Node
            && !this.dom.contains(event.target)) {
            this.filterVisible = false
            this.setGlobalClickListener(false)
            this.update()
        }
    }

    /**
     * The outside-click listener exists only while the panel is open. A
     * permanent document listener would fire — and be traced as an
     * interaction — on every click in the document, even though it only
     * acts when the panel is open. listenWhile keeps it on the same traced
     * native-event path as listen(), so a real outside-click coalesces with
     * any other listener observing that click instead of opening a
     * separate root.
     */
    private setGlobalClickListener(active: boolean): void {
        if (active === (this.removeGlobalClickListener != null)) return
        if (!active) {
            this.removeGlobalClickListener!()
            return
        }
        const detach = this.listenWhile<MouseEvent>(document, 'click',
            (event) => this.onGlobalClick(event))
        this.removeGlobalClickListener = () => {
            detach()
            this.removeGlobalClickListener = null
        }
    }

    static dependencies = [FilterPanel]

    static override css = css`
        cap-datatable > table > thead > tr > th[aria-sort] {
            position: sticky;
            inset-block-start: 0;
            padding-right: 24px;
            user-select: var(--noselect-user-select);
            cursor: var(--noselect-cursor);
        }

        cap-datatable > table > thead > tr > th[aria-sort] > button.sort {
            appearance: none;
            display: block;
            width: 100%;
            padding: 0;
            color: inherit;
            background: transparent;
            border: 0;
            font-family: inherit;
            font-size: inherit;
            font-weight: inherit;
            line-height: inherit;
            text-align: inherit;
            cursor: pointer;
        }

        cap-datatable > table > thead > tr > th[aria-sort] > button.sort > span.sortindicator {
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 1em;
            text-align: center;
        }

        cap-datatable > table > thead > tr > th[aria-sort] > button.filter {
            appearance: none;
            position: absolute;
            right: 2px;
            top: 50%;
            transform: translateY(-50%);
            width: 1em;
            padding: 0;
            color: inherit;
            background: transparent;
            border: 0;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
            text-align: center;
            cursor: pointer;
            opacity: 0.5;
        }

        cap-datatable > table > thead > tr > th[aria-sort] > button.filter:hover {
            opacity: 1;
        }
    `
}

function textAlternative(label: CapillaryUiChild): string | null {
    return typeof label === 'string' || typeof label === 'number'
        ? String(label)
        : null
}

function isFilterSelectionEntry(
    entry: readonly [unknown, FilterModeValue],
): entry is readonly [FilterValue, FilterModeValue] {
    return typeof entry[0] === 'string' || typeof entry[0] === 'number'
}
