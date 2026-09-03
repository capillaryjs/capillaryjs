import {
    DerivedEmitter,
    Emitter,
    FetchState,
    LiveQuery,
    QueryArg,
    RestQueryHandler,
} from '@sylwellsoftware/glue'
import type {
    FetchLike,
    QueryHandlerLike,
    QuerySerializer,
    ReadableEmitter,
} from '@sylwellsoftware/glue'

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
} from '../selectionhandler.js'
import type {
    BaseSelectionHandler,
    ItemKeyGetter,
} from '../selectionhandler.js'
import {TableHeader} from './TableHeader.js'
import type {TableColumn, TableRow} from './TableHeaderCell.js'
import {applyLocalTableState, serializeTableQuery} from './tableQuery.js'
import type {TableFilters, TableSort} from './tableQuery.js'

export type TableQueryArguments = {
    sort: TableSort | null
    filters: TableFilters
}

export type TableQueryInput<TRow extends TableRow = TableRow> = ReadableEmitter<
    readonly TRow[] | undefined,
    unknown
> & {
    retry?: (cause?: unknown) => unknown
    dispose?: () => void
}

export interface DataTableProps<TRow extends TableRow = TableRow> extends ComponentProps {
    mode: 'local' | 'remote'
    columns: readonly TableColumn<TRow>[]
    data?: readonly TRow[] | ReadableEmitter<readonly TRow[], unknown>
    query?: TableQueryInput<TRow>
    queryHandler?: QueryHandlerLike<TableQueryArguments, readonly TRow[]>
    queryUrl?: string
    baseUrl?: string
    fetch?: FetchLike<readonly TRow[]>
    serializeQuery?: QuerySerializer<TableQueryArguments>
    selectedItemsEmitter?: ValueEmitter<TRow[]>
    rowKey?: Extract<keyof TRow, string> | ItemKeyGetter<TRow>
    multiSelect?: boolean
    caption?: FrayChild
    emptyMessage?: FrayChild
    placeholderCount?: number
    filterModes?: readonly CheckboxSymbol<FilterModeValue>[]
    defaultSemanticState?: FilterModeValue
    onFilterChange?: (filters: TableFilters, event: Event | null) => void
}

/** Experimental table with explicit local and remote data modes. */
export class DataTable<TRow extends TableRow = TableRow>
    extends Component<DataTableProps<TRow>> {
    readonly columns: readonly TableColumn<TRow>[]
    readonly rowKey: ItemKeyGetter<TRow>
    readonly sortEmitter: Emitter<TableSort | null>
    readonly filtersEmitter: Emitter<TableFilters>
    readonly selectedItemsEmitter: ValueEmitter<TRow[]>
    readonly selectionHandler: BaseSelectionHandler<TRow>
    query: TableQueryInput<TRow> | null = null
    private dataSource: ReadableEmitter<readonly TRow[], unknown> | null = null
    private readonly ownedSelectedItemsEmitter: Emitter<TRow[]> | null
    private ownedDataSource: Emitter<readonly TRow[]> | null = null
    private ownsQuery = false
    private readonly queryArgs: Array<QueryArg<TableSort | null> | QueryArg<TableFilters>> = []

    constructor(props: DataTableProps<TRow>) {
        super(props)
        if (props.mode !== 'local' && props.mode !== 'remote') {
            throw new TypeError('DataTable mode must be local or remote')
        }
        this.columns = normalizeColumns(props.columns)
        this.rowKey = normalizeRowKey(props.rowKey)
        this.sortEmitter = new Emitter<TableSort | null>(null, {
            owner: this,
            purpose: 'table sort',
        })
        this.filtersEmitter = new Emitter<TableFilters>({}, {
            owner: this,
            purpose: 'table filters',
        })
        this.ownedSelectedItemsEmitter = props.selectedItemsEmitter == null
            ? new Emitter<TRow[]>([], {owner: this, purpose: 'selected table rows'})
            : null
        this.selectedItemsEmitter = props.selectedItemsEmitter
            ?? this.ownedSelectedItemsEmitter!
        this.selectionHandler = createSelectionHandler({
            owner: this,
            multiSelect: props.multiSelect ?? false,
            selectedItemsEmitter: this.selectedItemsEmitter,
            getItems: () => this.query?.get() ?? [],
            getKey: this.rowKey,
        })
    }

    initialize(): void {
        this.query = this.props.mode === 'local'
            ? this.createLocalQuery()
            : this.createRemoteQuery()
        this.watch(this.query, this.selectedItemsEmitter)
    }

    private createLocalQuery(): TableQueryInput<TRow> {
        const suppliedData = this.props.data ?? []
        let source: ReadableEmitter<readonly TRow[], unknown>
        if (isReadableEmitter<readonly TRow[]>(suppliedData)) {
            source = suppliedData
        } else {
            this.ownedDataSource = new Emitter<readonly TRow[]>(suppliedData, {
                owner: this,
                purpose: 'local table data',
            })
            source = this.ownedDataSource
        }
        this.dataSource = source
        this.ownsQuery = true
        return new DerivedEmitter(
            [source, this.sortEmitter, this.filtersEmitter] as const,
            ([rows, sort, filters]) => applyLocalTableState(rows, sort, filters),
            {owner: this, purpose: 'local table view'},
        )
    }

    private createRemoteQuery(): TableQueryInput<TRow> {
        if (this.props.query != null) {
            assertTableQuery(this.props.query)
            return this.props.query
        }

        const handler = this.props.queryHandler ?? this.createRestHandler()
        if (handler == null || typeof handler.fetch !== 'function') {
            throw new TypeError('Remote DataTable requires query, queryHandler, or queryUrl')
        }
        const sort = new QueryArg<TableSort | null>('sort', this.sortEmitter, {
            owner: this,
            purpose: 'remote table sort argument',
        })
        const filters = new QueryArg<TableFilters>('filters', this.filtersEmitter, {
            owner: this,
            purpose: 'remote table filters argument',
        })
        this.queryArgs.push(sort, filters)
        this.ownsQuery = true
        const args = {sort, filters}
        return new LiveQuery<readonly TRow[], typeof args>({
            handler,
            args,
            owner: this,
            purpose: 'remote table query',
            keepPreviousValue: true,
        })
    }

    private createRestHandler(): RestQueryHandler<
        TableQueryArguments,
        readonly TRow[]
    > | null {
        if (this.props.queryUrl == null) return null
        const options: {
            url: string
            baseUrl?: string
            fetch?: FetchLike<readonly TRow[]>
            serialize: QuerySerializer<TableQueryArguments>
        } = {
            url: this.props.queryUrl,
            serialize: this.props.serializeQuery ?? serializeTableQuery,
        }
        if (this.props.baseUrl != null) options.baseUrl = this.props.baseUrl
        if (this.props.fetch != null) options.fetch = this.props.fetch
        return new RestQueryHandler<TableQueryArguments, readonly TRow[]>(options)
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
                {typeof this.query?.retry === 'function'
                    ? <button
                        type="button"
                        onClick={() => this.query?.retry?.('table retry')}
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

    onDestroy(): void {
        this.selectionHandler.destroy()
        if (this.ownsQuery) this.query?.dispose?.()
        for (const argument of this.queryArgs) argument.dispose()
        this.ownedDataSource?.dispose()
        this.ownedSelectedItemsEmitter?.dispose()
        this.sortEmitter.dispose()
        this.filtersEmitter.dispose()
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

function isReadableEmitter<TValue>(value: unknown): value is ReadableEmitter<TValue, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
        && typeof Reflect.get(value, 'getFetchState') === 'function'
        && typeof Reflect.get(value, 'getError') === 'function'
}

function assertTableQuery<TRow extends TableRow>(
    value: unknown,
): asserts value is TableQueryInput<TRow> {
    if (!isReadableEmitter<readonly TRow[] | undefined>(value)) {
        throw new TypeError('DataTable query must be an emitter')
    }
}

function renderCellValue(value: unknown): FrayChild {
    if (value == null || typeof value === 'string' || typeof value === 'number') return value
    return String(value)
}

function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message
    return error == null ? fallback : String(error)
}
