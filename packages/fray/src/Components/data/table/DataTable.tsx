import {Emitter, FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'

import {Placeholder} from '../../Placeholder.js'
import {Component, css} from '../../component.js'
import type {ComponentProps, FrayChild} from '../../component.js'
import {componentClass} from '../../controlUtils.js'
import type {ValueEmitter} from '../../controlUtils.js'
import type {CheckboxSymbol} from '../../lineinputs/checkbox/Checkbox.js'
import type {FilterModeValue} from '../../../util/filterMode.js'
import {
    createSelectionHandler,
    defaultItemKey,
    SingleSelectionHandler,
} from '../selectionhandler.js'
import type {
    BaseSelectionHandler,
    ItemKeyGetter,
} from '../selectionhandler.js'
import {TableHeader} from './TableHeader.js'
import type {TableColumn, TableRow} from './TableHeaderCell.js'
import {
    createLocalTableDataSource,
    createRestTableDataSource,
} from './tableDataSource.js'
import type {
    RestTableDataSourceOptions,
    TableDataSource,
    TableQueryInput,
} from './tableDataSource.js'
import type {TableFilters, TableSort} from './tableQuery.js'

interface DataTableCommonProps<TRow extends TableRow> extends ComponentProps {
    columns: readonly TableColumn<TRow>[]
    rowKey?: Extract<keyof TRow, string> | ItemKeyGetter<TRow>
    caption?: FrayChild
    emptyMessage?: FrayChild
    placeholderCount?: number
    filterModes?: readonly CheckboxSymbol<FilterModeValue>[]
    defaultSemanticState?: FilterModeValue
    onFilterChange?: (filters: TableFilters, event: Event | null) => void
}

type DataTableInputProps<TRow extends TableRow> =
    | {
        data?: readonly TRow[] | ReadableEmitter<readonly TRow[], unknown>
        dataSource?: never
        rest?: never
    }
    | {
        data?: never
        dataSource: TableDataSource<TRow>
        rest?: never
    }
    | {
        data?: never
        dataSource?: never
        rest: Omit<RestTableDataSourceOptions<TRow>, 'owner' | 'sortEmitter' | 'filtersEmitter'>
    }

type DataTableSelectionProps<TRow extends TableRow> =
    | {
        multiSelect?: false
        selectedItemEmitter?: ValueEmitter<TRow | null>
        selectedItemsEmitter?: never
    }
    | {
        multiSelect: true
        selectedItemsEmitter?: ValueEmitter<TRow[]>
        selectedItemEmitter?: never
    }

export type DataTableProps<TRow extends TableRow = TableRow> =
    DataTableCommonProps<TRow> & DataTableInputProps<TRow> & DataTableSelectionProps<TRow>

/** Accessible table over an explicit local, caller-query, or REST data source. */
export class DataTable<TRow extends TableRow = TableRow>
    extends Component<DataTableProps<TRow>> {
    readonly columns: readonly TableColumn<TRow>[]
    readonly rowKey: ItemKeyGetter<TRow>
    readonly sortEmitter: ValueEmitter<TableSort | null>
    readonly filtersEmitter: ValueEmitter<TableFilters>
    readonly selectedItemsEmitter: ValueEmitter<TRow[]>
    readonly selectedItemEmitter: ValueEmitter<TRow | null> | null
    readonly selectionHandler: BaseSelectionHandler<TRow>
    query: TableQueryInput<TRow> | null = null
    private dataSource: TableDataSource<TRow> | null = null
    private readonly suppliedDataSource: TableDataSource<TRow> | null
    private readonly ownedSortEmitter: Emitter<TableSort | null> | null
    private readonly ownedFiltersEmitter: Emitter<TableFilters> | null
    private ownedDataSource: TableDataSource<TRow> | null = null

    constructor(props: DataTableProps<TRow>) {
        super(props)
        assertDataTableInput(props)
        this.columns = normalizeColumns(props.columns)
        this.rowKey = normalizeRowKey(props.rowKey)
        this.suppliedDataSource = props.dataSource ?? null
        this.ownedSortEmitter = this.suppliedDataSource == null
            ? new Emitter<TableSort | null>(null, {owner: this, purpose: 'table sort'})
            : null
        this.ownedFiltersEmitter = this.suppliedDataSource == null
            ? new Emitter<TableFilters>({}, {owner: this, purpose: 'table filters'})
            : null
        this.sortEmitter = this.suppliedDataSource?.sortEmitter ?? this.ownedSortEmitter!
        this.filtersEmitter = this.suppliedDataSource?.filtersEmitter ?? this.ownedFiltersEmitter!
        this.selectionHandler = props.multiSelect === true
            ? createSelectionHandler({
                owner: this,
                multiSelect: true,
                ...(props.selectedItemsEmitter == null
                    ? {}
                    : {selectedItemsEmitter: props.selectedItemsEmitter}),
                getItems: () => this.query?.get() ?? [],
                getKey: this.rowKey,
            })
            : createSelectionHandler({
                owner: this,
                ...(props.selectedItemEmitter == null
                    ? {}
                    : {selectedItemEmitter: props.selectedItemEmitter}),
                getItems: () => this.query?.get() ?? [],
                getKey: this.rowKey,
            })
        this.selectedItemsEmitter = this.selectionHandler.selectedItemsEmitter
        this.selectedItemEmitter = this.selectionHandler instanceof SingleSelectionHandler
            ? this.selectionHandler.selectedItemEmitter
            : null
    }

    initialize(): void {
        if (this.suppliedDataSource != null) {
            this.dataSource = this.suppliedDataSource
        } else if (this.props.rest != null) {
            this.ownedDataSource = createRestTableDataSource({
                ...this.props.rest,
                sortEmitter: this.sortEmitter,
                filtersEmitter: this.filtersEmitter,
                owner: this,
            })
            this.dataSource = this.ownedDataSource
        } else {
            this.ownedDataSource = createLocalTableDataSource({
                data: this.props.data ?? [],
                sortEmitter: this.sortEmitter,
                filtersEmitter: this.filtersEmitter,
                owner: this,
            })
            this.dataSource = this.ownedDataSource
        }
        this.query = this.dataSource.query
        this.watch(this.query, this.selectedItemsEmitter)
    }

    render(): FrayChild {
        const rows = this.query?.get() ?? []
        if (!Array.isArray(rows)) throw new TypeError('DataTable query value must be an array')
        const status = this.query?.getFetchState() ?? FetchState.Initial
        const error = this.query?.getError()
        const isLoading = status === FetchState.Initial || status === FetchState.Loading
        const selectedKeys = new Set(
            this.selectedItemsEmitter.get().map((item, index) => this.rowKey(item, index)),
        )
        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
            data-loading={isLoading ? '' : null}
            data-error={status === FetchState.Error ? '' : null}
        >
            {isLoading ? <p role="status" data-part="status">Loading rows…</p> : null}
            {status === FetchState.Error ? <div data-part="error" role="alert">
                <span>{errorMessage(error, 'Unable to load rows')}</span>
                {typeof this.dataSource?.retry === 'function'
                    ? <button
                        type="button"
                        onClick={() => this.dataSource?.retry?.('table retry')}
                    >Retry</button>
                    : null}
            </div> : null}
            <table data-part="table" aria-busy={isLoading ? 'true' : null}>
                {this.props.caption == null ? null : <caption>{this.props.caption}</caption>}
                <TableHeader
                    key="header"
                    columns={this.columns}
                    sortEmitter={this.sortEmitter}
                    filtersEmitter={this.filtersEmitter}
                    {...(this.props.filterModes == null
                        ? {}
                        : {filterModes: this.props.filterModes})}
                    {...(this.props.defaultSemanticState == null
                        ? {}
                        : {defaultSemanticState: this.props.defaultSemanticState})}
                    {...(this.props.onFilterChange == null
                        ? {}
                        : {onFilterChange: this.props.onFilterChange})}
                />
                <tbody>
                    {rows.length > 0
                        ? rows.map((row, index) =>
                            this.renderRow(row, index, selectedKeys))
                        : isLoading
                            ? this.renderPlaceholders()
                            : status === FetchState.Error
                                ? null
                                : <tr key="empty">
                                    <td colSpan={this.columns.length}>
                                        {this.props.emptyMessage ?? 'No rows'}
                                    </td>
                                </tr>}
                </tbody>
            </table>
        </Host>
    }

    private renderRow(
        row: TRow,
        index: number,
        selectedKeys: ReadonlySet<unknown>,
    ): FrayChild {
        const key = this.rowKey(row, index)
        const selected = selectedKeys.has(key)
        return <tr
            key={String(key)}
            data-fray-selectable-row=""
            data-index={index}
            aria-selected={String(selected)}
            tabIndex={index === 0 ? 0 : -1}
        >
            {this.columns.map((column) => <td key={String(column.field)}>
                {column.render
                    ? column.render(row, index)
                    : renderCellValue(row[column.field])}
            </td>)}
        </tr>
    }

    private renderPlaceholders(): FrayChild[] {
        const count = this.props.placeholderCount ?? 5
        return Array.from({length: count}, (_, rowIndex) =>
            <tr key={`placeholder-${rowIndex}`}>
                {this.columns.map((column, columnIndex) =>
                    <td key={String(column.field)}>
                        <Placeholder
                            width={45 + ((rowIndex + columnIndex) % 6) * 8}
                        />
                    </td>)}
            </tr>)
    }

    afterUpdate(dom: ChildNode | null): void {
        const rows = dom instanceof Element
            ? dom.querySelectorAll<HTMLElement>('tbody [data-fray-selectable-row]')
            : []
        this.selectionHandler.rowsUpdated(rows)
    }

    getSelectedRows(): TRow[] {
        return this.selectionHandler.getSelectedItems()
    }

    getSelectedRowsEmitter(): ValueEmitter<TRow[]> {
        return this.selectedItemsEmitter
    }

    getSelectedRow(): TRow | null {
        return this.selectedItemEmitter?.get() ?? null
    }

    getSelectedRowEmitter(): ValueEmitter<TRow | null> | null {
        return this.selectedItemEmitter
    }

    onDestroy(): void {
        this.selectionHandler.destroy()
        this.ownedDataSource?.dispose()
        this.ownedSortEmitter?.dispose()
        this.ownedFiltersEmitter?.dispose()
    }

    static dependencies = [Placeholder, TableHeader]

    static override hostName = 'data-table'
    static override standaloneHostName = 'data-table'

    static css = css`
        & {
            overflow: auto;
            color: var(--ui-text-color);
        }

        & > table {
            width: 100%;
            border-collapse: collapse;
        }

        & thead:has([data-fray-component="filter-panel"]) {
            position: relative;
            z-index: 1100;
        }

        & th,
        & td {
            padding: var(--ui-padding-v) var(--ui-padding-h);
            text-align: start;
        }

        & tbody tr[data-fray-selectable-row] {
            cursor: default;
            user-select: none;
        }

        & tbody tr:nth-child(odd) {
            background: var(--fray-table-row-background, transparent);
        }

        & tbody tr:nth-child(even) {
            background: var(--fray-table-row-alt-background, transparent);
        }

        & tbody tr[data-fray-selectable-row]:hover {
            background: var(--fray-row-hover-background, var(--button-background-hover));
        }

        & tbody tr[data-fray-selectable-row]:focus-visible {
            outline: 2px solid var(--fray-color-focus, var(--ui-accent-color));
            outline-offset: -2px;
        }

        & tbody tr[data-fray-selectable-row][aria-selected="true"] {
            color: var(--fray-selection-color, var(--toggle-selected-text));
            background: var(--fray-selection-background, var(--toggle-selected-bg));
        }

        & > [data-part="error"] {
            color: var(--error-color);
        }
    `
}

function normalizeColumns<TRow extends TableRow>(
    columns: unknown,
): readonly TableColumn<TRow>[] {
    if (!Array.isArray(columns) || columns.length === 0) {
        throw new TypeError('DataTable columns must be a non-empty array')
    }
    const fields = new Set<string>()
    return columns.map((column: unknown) => {
        if (column == null || typeof column !== 'object') {
            throw new TypeError('Every DataTable column requires a field')
        }
        const field = Reflect.get(column, 'field')
        if (typeof field !== 'string' || field.length === 0) {
            throw new TypeError('Every DataTable column requires a field')
        }
        if (fields.has(field)) throw new Error(`Duplicate DataTable column: ${field}`)
        fields.add(field)
        const render = Reflect.get(column, 'render')
        if (render != null && typeof render !== 'function') {
            throw new TypeError(`DataTable column ${field} render must be a function`)
        }
        // Runtime validation above proves the structural column boundary; the
        // row-specific callback relationship is checked at the public API.
        return column as TableColumn<TRow>
    })
}

function assertDataTableInput<TRow extends TableRow>(props: DataTableProps<TRow>): void {
    const legacyNames = ['mode', 'query', 'queryHandler', 'queryUrl', 'baseUrl', 'fetch',
        'serializeQuery']
    const legacy = legacyNames.find((name) => Object.hasOwn(props, name))
    if (legacy != null) {
        throw new TypeError(
            `DataTable ${legacy} moved to dataSource/rest; see the 0.3 migration guide`,
        )
    }
    const hasData = props.data !== undefined
    const hasDataSource = props.dataSource !== undefined
    const hasRest = props.rest !== undefined
    if (Number(hasData) + Number(hasDataSource) + Number(hasRest) > 1) {
        throw new TypeError('DataTable accepts exactly one of data, dataSource, or rest')
    }
    if (hasDataSource) {
        const source = props.dataSource
        if (source == null
            || typeof source !== 'object'
            || source.query == null
            || typeof source.sortEmitter?.set !== 'function'
            || typeof source.filtersEmitter?.set !== 'function'
            || typeof source.dispose !== 'function') {
            throw new TypeError('DataTable dataSource must implement the table data-source contract')
        }
    }
}

function normalizeRowKey<TRow extends TableRow>(
    rowKey: DataTableProps<TRow>['rowKey'],
): ItemKeyGetter<TRow> {
    if (rowKey == null) return defaultItemKey
    if (typeof rowKey === 'function') return rowKey
    if (typeof rowKey === 'string' && rowKey.length > 0) {
        return (row, index) => {
            const key = row[rowKey]
            if (key == null) {
                throw new TypeError(`DataTable row at index ${index} lacks ${rowKey}`)
            }
            return key
        }
    }
    throw new TypeError('DataTable rowKey must be a function or property name')
}

function renderCellValue(value: unknown): FrayChild {
    if (value == null || typeof value === 'string' || typeof value === 'number') return value
    return String(value)
}

function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message
    return error == null ? fallback : String(error)
}
