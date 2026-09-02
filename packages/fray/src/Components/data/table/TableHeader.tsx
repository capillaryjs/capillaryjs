import {Component} from '../../component.js'
import type {ComponentProps, FrayChild} from '../../component.js'
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
    render(): FrayChild {
        return <thead data-fray-component="table-header">
            <tr>
                {this.props.columns.map((column) => <TableHeaderCell
                    key={String(column.field)}
                    field={column.field}
                    sortEmitter={this.props.sortEmitter}
                    filtersEmitter={this.props.filtersEmitter}
                    {...(column.label == null ? {} : {label: column.label})}
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
}
