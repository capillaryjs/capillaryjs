import {
    DerivedEmitter,
    Emitter,
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

import type {ValueEmitter} from '../../controlUtils.js'
import type {TableRow} from './TableHeaderCell.js'
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

export interface TableDataSource<TRow extends TableRow = TableRow> {
    readonly query: TableQueryInput<TRow>
    readonly sortEmitter: ValueEmitter<TableSort | null>
    readonly filtersEmitter: ValueEmitter<TableFilters>
    readonly retry?: (cause?: unknown) => unknown
    dispose(): void
}

interface TableStateOptions {
    sortEmitter?: ValueEmitter<TableSort | null>
    filtersEmitter?: ValueEmitter<TableFilters>
    owner?: unknown
}

export interface LocalTableDataSourceOptions<TRow extends TableRow>
extends TableStateOptions {
    data: readonly TRow[] | ReadableEmitter<readonly TRow[], unknown>
}

export interface QueryTableDataSourceOptions<TRow extends TableRow>
extends TableStateOptions {
    query: TableQueryInput<TRow>
}

export interface HandlerTableDataSourceOptions<TRow extends TableRow>
extends TableStateOptions {
    handler: QueryHandlerLike<TableQueryArguments, readonly TRow[]>
}

export interface RestTableDataSourceOptions<TRow extends TableRow>
extends TableStateOptions {
    url: string
    baseUrl?: string
    fetch?: FetchLike<readonly TRow[]>
    serializeQuery?: QuerySerializer<TableQueryArguments>
}

/** Create a source that applies table state to local data. The caller owns it. */
export function createLocalTableDataSource<TRow extends TableRow>(
    options: LocalTableDataSourceOptions<TRow>,
): TableDataSource<TRow> {
    const state = createState(options)
    const ownedData = isReadableEmitter<readonly TRow[]>(options.data)
        ? null
        : new Emitter<readonly TRow[]>(options.data, {
            owner: options.owner,
            purpose: 'local table data',
        })
    const data = ownedData ?? options.data as ReadableEmitter<readonly TRow[], unknown>
    const query = new DerivedEmitter(
        [data, state.sortEmitter, state.filtersEmitter] as const,
        ([rows, sort, filters]) => applyLocalTableState(rows, sort, filters),
        {owner: options.owner, purpose: 'local table view'},
    )
    return new ManagedTableDataSource(query, state, () => {
        query.dispose()
        ownedData?.dispose()
    })
}

/** Package a caller-owned query with the sort/filter emitters that drive it. */
export function createQueryTableDataSource<TRow extends TableRow>(
    options: QueryTableDataSourceOptions<TRow>,
): TableDataSource<TRow> {
    assertTableQuery<TRow>(options.query)
    const state = createState(options)
    return new ManagedTableDataSource(options.query, state)
}

/** Create a LiveQuery-backed source from an application-supplied handler. */
export function createHandlerTableDataSource<TRow extends TableRow>(
    options: HandlerTableDataSourceOptions<TRow>,
): TableDataSource<TRow> {
    if (options.handler == null || typeof options.handler.fetch !== 'function') {
        throw new TypeError('Table data-source handler must implement fetch')
    }
    const state = createState(options)
    const sort = new QueryArg<TableSort | null>('sort', state.sortEmitter, {
        owner: options.owner,
        purpose: 'table sort argument',
    })
    const filters = new QueryArg<TableFilters>('filters', state.filtersEmitter, {
        owner: options.owner,
        purpose: 'table filters argument',
    })
    const query = new LiveQuery<readonly TRow[], {sort: typeof sort; filters: typeof filters}>({
        handler: options.handler,
        args: {sort, filters},
        owner: options.owner,
        purpose: 'table query',
        keepPreviousValue: true,
    })
    return new ManagedTableDataSource(query, state, () => {
        query.dispose()
        sort.dispose()
        filters.dispose()
    })
}

/** Create the convenient REST-backed source. The caller owns the result. */
export function createRestTableDataSource<TRow extends TableRow>(
    options: RestTableDataSourceOptions<TRow>,
): TableDataSource<TRow> {
    if (typeof options.url !== 'string' || options.url.length === 0) {
        throw new TypeError('REST table data source requires a URL')
    }
    const handlerOptions: {
        url: string
        baseUrl?: string
        fetch?: FetchLike<readonly TRow[]>
        serialize: QuerySerializer<TableQueryArguments>
    } = {
        url: options.url,
        serialize: options.serializeQuery ?? serializeTableQuery,
    }
    if (options.baseUrl != null) handlerOptions.baseUrl = options.baseUrl
    if (options.fetch != null) handlerOptions.fetch = options.fetch
    return createHandlerTableDataSource({
        handler: new RestQueryHandler<TableQueryArguments, readonly TRow[]>(handlerOptions),
        ...(options.sortEmitter == null ? {} : {sortEmitter: options.sortEmitter}),
        ...(options.filtersEmitter == null ? {} : {filtersEmitter: options.filtersEmitter}),
        ...(options.owner === undefined ? {} : {owner: options.owner}),
    })
}

interface ManagedState {
    sortEmitter: ValueEmitter<TableSort | null>
    filtersEmitter: ValueEmitter<TableFilters>
    ownedSortEmitter: Emitter<TableSort | null> | null
    ownedFiltersEmitter: Emitter<TableFilters> | null
}

class ManagedTableDataSource<TRow extends TableRow> implements TableDataSource<TRow> {
    readonly sortEmitter: ValueEmitter<TableSort | null>
    readonly filtersEmitter: ValueEmitter<TableFilters>
    readonly retry?: (cause?: unknown) => unknown
    private disposed = false

    constructor(
        readonly query: TableQueryInput<TRow>,
        private readonly state: ManagedState,
        private readonly disposeQuery: (() => void) | null = null,
    ) {
        this.sortEmitter = state.sortEmitter
        this.filtersEmitter = state.filtersEmitter
        if (query.retry != null) this.retry = (cause?: unknown) => query.retry?.(cause)
    }

    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        this.disposeQuery?.()
        this.state.ownedSortEmitter?.dispose()
        this.state.ownedFiltersEmitter?.dispose()
    }
}

function createState(options: TableStateOptions): ManagedState {
    const ownedSortEmitter = options.sortEmitter == null
        ? new Emitter<TableSort | null>(null, {
            owner: options.owner,
            purpose: 'table sort',
        })
        : null
    const ownedFiltersEmitter = options.filtersEmitter == null
        ? new Emitter<TableFilters>({}, {
            owner: options.owner,
            purpose: 'table filters',
        })
        : null
    return {
        sortEmitter: options.sortEmitter ?? ownedSortEmitter!,
        filtersEmitter: options.filtersEmitter ?? ownedFiltersEmitter!,
        ownedSortEmitter,
        ownedFiltersEmitter,
    }
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
        throw new TypeError('Table query must be an emitter')
    }
}
