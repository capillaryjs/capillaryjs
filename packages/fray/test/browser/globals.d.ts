interface DataTableBenchmarkMetrics {
    rowCount: number
    columnCount: number
    initialRenderMs: number
    rerenderMs: number
    sortMs: number
    filterMs: number
    selectionMs: number
    renderedRows: number
    selectedRows: number
}

interface FrayBrowserTestAPI {
    setRevision(value: number): void
    readonly clicks: number
    readonly inputNodePreserved: boolean
    setBoolean(value: boolean): void
    reorder(keys: string[]): void
    keyedNodesPreserved(): boolean
    hideChild(): void
    destroyParentTwice(): void
    readonly lifecycleCounts: {initialize: number; destroy: number}
    readonly childSubscribers: number
    setProgress(value: number | null): void
    destroyRouting(): number
    measureDataTable(rowCount: number): DataTableBenchmarkMetrics
}

declare var frayTest: FrayBrowserTestAPI
declare var frayTestReady: boolean
