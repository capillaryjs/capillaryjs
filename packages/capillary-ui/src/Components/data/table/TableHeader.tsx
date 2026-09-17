import {Component, css} from '../../component.js'
import type {ComponentProps, CapillaryUiChild} from '../../component.js'
import type {ValueEmitter} from '../../controlUtils.js'
import type {CheckboxSymbol} from '../../lineinputs/checkbox/Checkbox.js'
import type {FilterModeValue} from '../../../util/filterMode.js'
import {TableHeaderCell} from './TableHeaderCell.js'
import type {
    TableColumn,
    TableRow,
} from './TableHeaderCell.js'
import type {TableFilters, TableSort} from './tableQuery.js'

export interface TableHeaderProps<TRow extends TableRow = TableRow> extends ComponentProps {
    columns: readonly TableColumn<TRow>[]
    sortEmitter: ValueEmitter<TableSort | null>
    filtersEmitter: ValueEmitter<TableFilters>
    filterModes?: readonly CheckboxSymbol<FilterModeValue>[]
    defaultSemanticState?: FilterModeValue
    onFilterChange?: (filters: TableFilters, event: Event | null) => void
}

export class TableHeader<TRow extends TableRow = TableRow>
    extends Component<TableHeaderProps<TRow>> {
    static override diagnosticLabel = 'Table header'
    static override liveProps: readonly string[] = []

    override setProps(next: TableHeaderProps<TRow>): this {
        const previous = this.props
        const equal = previous.sortEmitter === next.sortEmitter
            && previous.filtersEmitter === next.filtersEmitter
            && previous.filterModes === next.filterModes
            && previous.defaultSemanticState === next.defaultSemanticState
            && previous.onFilterChange === next.onFilterChange
            && previous.columns.length === next.columns.length
            && previous.columns.every((column, index) => {
                const other = next.columns[index]!
                return column.field === other.field && column.label === other.label
                    && column.ariaLabel === other.ariaLabel && column.sortable === other.sortable
                    && column.filterOptions === other.filterOptions
            })
        if (!equal) return super.setProps(next)
        this.props = next
        return this
    }
    render(): CapillaryUiChild {
        return <thead>
            <tr>
                {this.props.columns.map((column) => <TableHeaderCell
                    key={String(column.field)}
                    field={column.field}
                    sortEmitter={this.props.sortEmitter}
                    filtersEmitter={this.props.filtersEmitter}
                    {...(column.label == null ? {} : {label: column.label})}
                    {...(column.ariaLabel == null ? {} : {ariaLabel: column.ariaLabel})}
                    {...(column.sortable == null ? {} : {sortable: column.sortable})}
                    {...(column.filterOptions == null
                        ? {}
                        : {filterOptions: column.filterOptions})}
                    {...(this.props.filterModes == null
                        ? {}
                        : {filterModes: this.props.filterModes})}
                    {...(this.props.defaultSemanticState == null
                        ? {}
                        : {defaultSemanticState: this.props.defaultSemanticState})}
                    {...(this.props.onFilterChange == null
                        ? {}
                        : {onFilterChange: this.props.onFilterChange})}
                />)}
            </tr>
        </thead>
    }

    static dependencies = [TableHeaderCell]

    static css = css`
        cap-datatable > table > thead {
            color: var(--table-header-color);
            background: var(--ui-gradient);
        }

        cap-datatable > table > thead > tr > th {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
            background: var(--ui-gradient);
            border: 2px groove #fff7;
            border-left: none;
        }

        cap-datatable > table > thead > tr > th:last-child {
            border-right: none;
        }
    `
}
