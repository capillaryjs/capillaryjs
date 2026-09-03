import {Emitter} from '@sylwellsoftware/glue'
import type {
    EmitterNotification,
    SubscribeOptions,
} from '@sylwellsoftware/glue'

import type {ValueEmitter} from '../controlUtils.js'

export type ItemKeyGetter<TItem> = (item: TItem, index: number) => unknown

interface SelectionHandlerCommonConfig<TItem> {
    getItems: () => readonly TItem[]
    getKey?: ItemKeyGetter<TItem>
    owner?: unknown
}

export interface SingleSelectionHandlerConfig<TItem>
extends SelectionHandlerCommonConfig<TItem> {
    multiSelect?: false
    selectedItemEmitter?: ValueEmitter<TItem | null>
    selectedItemsEmitter?: never
}

export interface MultiSelectionHandlerConfig<TItem>
extends SelectionHandlerCommonConfig<TItem> {
    multiSelect: true
    selectedItemsEmitter?: ValueEmitter<TItem[]>
    selectedItemEmitter?: never
}

export type SelectionHandlerConfig<TItem> =
    | SingleSelectionHandlerConfig<TItem>
    | MultiSelectionHandlerConfig<TItem>

interface BaseSelectionHandlerConfig<TItem> extends SelectionHandlerCommonConfig<TItem> {
    selectedItemsEmitter?: ValueEmitter<TItem[]>
}

type SelectionEvent = MouseEvent | KeyboardEvent

/**
 * DOM selection behavior backed by an explicit row-data provider.
 *
 * Construction is side-effect free. Row listeners are installed by
 * `rowsUpdated()` and are always released before the next row set is wired.
 */
export class BaseSelectionHandler<TItem = unknown> {
    readonly getItems: () => readonly TItem[]
    readonly getKey: ItemKeyGetter<TItem>
    readonly selectedItemsEmitter: ValueEmitter<TItem[]>
    readonly selectedItems$: ValueEmitter<TItem[]>
    readonly ownsSelectedItemsEmitter: boolean
    protected rows: HTMLElement[] = []
    private readonly rowCleanups: Array<() => void> = []
    protected activeIndex = 0
    protected anchorIndex: number | null = null
    private dragStartIndex: number | null = null
    private dragOriginEvent: MouseEvent | null = null
    private dragMoved = false
    private dragCleanup: (() => void) | null = null
    private suppressNextClick = false
    private suppressClickTimer: ReturnType<typeof setTimeout> | null = null
    private destroyed = false
    private readonly ownedSelectedItemsEmitter: Emitter<TItem[]> | null

    constructor({
        getItems,
        getKey = defaultItemKey,
        selectedItemsEmitter,
        owner = null,
    }: BaseSelectionHandlerConfig<TItem>) {
        if (typeof getItems !== 'function') {
            throw new TypeError('Selection handler getItems must be a function')
        }
        if (typeof getKey !== 'function') {
            throw new TypeError('Selection handler getKey must be a function')
        }
        this.getItems = getItems
        this.getKey = getKey
        this.ownedSelectedItemsEmitter = selectedItemsEmitter == null
            ? new Emitter<TItem[]>([], {owner, purpose: 'selected items'})
            : null
        this.selectedItemsEmitter = selectedItemsEmitter
            ?? this.ownedSelectedItemsEmitter!
        this.selectedItems$ = this.selectedItemsEmitter
        this.ownsSelectedItemsEmitter = this.ownedSelectedItemsEmitter != null
    }

    rowsUpdated(rows: Iterable<HTMLElement> | ArrayLike<HTMLElement> | null): void {
        if (this.destroyed) return
        this.releaseRows()
        this.rows = Array.from(rows ?? [])
        this.rows.forEach((row, index) => this.wireRow(row, index))
        this.activeIndex = clampIndex(this.activeIndex, this.rows.length)
        this.reconcileSelectedItems()
        this.syncRows()
    }

    private wireRow(row: HTMLElement, index: number): void {
        const onClick = (event: MouseEvent): void => this.handleClick(index, event)
        const onKeyDown = (event: KeyboardEvent): void => this.handleKeyDown(index, event)
        const onMouseDown = (event: MouseEvent): void => this.handleMouseDown(index, event, row)
        const onMouseEnter = (event: MouseEvent): void => this.handleMouseEnter(index, event)
        row.addEventListener('click', onClick)
        row.addEventListener('keydown', onKeyDown)
        row.addEventListener('mousedown', onMouseDown)
        row.addEventListener('mouseenter', onMouseEnter)
        this.rowCleanups.push(() => {
            row.removeEventListener('click', onClick)
            row.removeEventListener('keydown', onKeyDown)
            row.removeEventListener('mousedown', onMouseDown)
            row.removeEventListener('mouseenter', onMouseEnter)
        })
    }

    private handleClick(index: number, event: MouseEvent): void {
        event.preventDefault()
        if (this.suppressNextClick) {
            this.clearClickSuppression()
            return
        }
        this.activeIndex = index
        this.selectIndex(index, event)
        this.rows[index]?.focus()
    }

    private handleMouseDown(index: number, event: MouseEvent, row: HTMLElement): void {
        if (event.button !== 0 || !this.supportsDragSelection()) return
        this.finishDrag(false)
        this.clearClickSuppression()
        this.dragStartIndex = index
        this.dragOriginEvent = event
        this.dragMoved = false
        const ownerDocument = row.ownerDocument
        const onMouseUp = (): void => this.finishDrag(this.dragMoved)
        ownerDocument.addEventListener('mouseup', onMouseUp)
        this.dragCleanup = () => ownerDocument.removeEventListener('mouseup', onMouseUp)
    }

    private handleMouseEnter(index: number, event: MouseEvent): void {
        if (this.dragStartIndex == null) return
        if (index === this.dragStartIndex && !this.dragMoved) return
        if (index === this.activeIndex && this.dragMoved) return
        event.preventDefault()
        this.dragMoved = true
        this.activeIndex = index
        this.selectDragRange(this.dragStartIndex, index, this.dragOriginEvent ?? event)
        this.rows[index]?.focus()
    }

    private handleKeyDown(index: number, event: KeyboardEvent): void {
        const lastIndex = this.rows.length - 1
        let nextIndex: number
        if (event.key === 'ArrowDown') nextIndex = Math.min(index + 1, lastIndex)
        else if (event.key === 'ArrowUp') nextIndex = Math.max(index - 1, 0)
        else if (event.key === 'Home') nextIndex = 0
        else if (event.key === 'End') nextIndex = lastIndex
        else if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            this.activeIndex = index
            this.selectIndex(index, event)
            return
        } else return

        event.preventDefault()
        this.activeIndex = nextIndex
        this.onKeyboardMove(nextIndex, event)
        this.syncRows()
        this.rows[nextIndex]?.focus()
    }

    protected onKeyboardMove(index: number, event: KeyboardEvent): void {
        this.selectIndex(index, event)
    }

    protected supportsDragSelection(): boolean {
        return false
    }

    protected selectDragRange(
        _startIndex: number,
        _endIndex: number,
        _event: MouseEvent,
    ): void {}

    protected selectIndex(_index: number, _event: SelectionEvent): void {}

    protected setSelectedItems(items: TItem[], cause = 'selection changed'): void {
        this.selectedItemsEmitter.set(items, cause)
        this.syncRows()
    }

    getSelectedItems(): TItem[] {
        return this.selectedItemsEmitter.get() ?? []
    }

    getSelectedItemsEmitter(): ValueEmitter<TItem[]> {
        return this.selectedItemsEmitter
    }

    private reconcileSelectedItems(): void {
        const selected = this.getSelectedItems()
        if (selected.length === 0) return
        const selectedKeys = new Set(selected.map((item, index) => this.getKey(item, index)))
        const current = this.getItems().filter((item, index) =>
            selectedKeys.has(this.getKey(item, index)))
        if (current.length !== selected.length
            || current.some((item, index) => !Object.is(item, selected[index]))) {
            this.selectedItemsEmitter.set([...current], 'selection reconciled with rows')
        }
    }

    private syncRows(): void {
        const selectedKeys = new Set(this.getSelectedItems().map((item, index) =>
            this.getKey(item, index)))
        const items = this.getItems()
        this.rows.forEach((row, index) => {
            const item = items[index]
            const selected = item !== undefined
                && selectedKeys.has(this.getKey(item, index))
            row.classList.toggle('selected', selected)
            row.setAttribute('aria-selected', String(selected))
            row.tabIndex = index === this.activeIndex ? 0 : -1
        })
    }

    private releaseRows(): void {
        for (const cleanup of this.rowCleanups.splice(0)) cleanup()
        this.rows = []
    }

    private finishDrag(suppressClick: boolean): void {
        this.dragCleanup?.()
        this.dragCleanup = null
        this.dragStartIndex = null
        this.dragOriginEvent = null
        this.dragMoved = false
        if (!suppressClick) return
        this.suppressNextClick = true
        if (this.suppressClickTimer != null) clearTimeout(this.suppressClickTimer)
        this.suppressClickTimer = setTimeout(() => this.clearClickSuppression(), 0)
    }

    private clearClickSuppression(): void {
        this.suppressNextClick = false
        if (this.suppressClickTimer != null) clearTimeout(this.suppressClickTimer)
        this.suppressClickTimer = null
    }

    destroy(): void {
        if (this.destroyed) return
        this.destroyed = true
        this.finishDrag(false)
        this.clearClickSuppression()
        this.releaseRows()
        this.ownedSelectedItemsEmitter?.dispose()
    }
}

export class SingleSelectionHandler<TItem = unknown> extends BaseSelectionHandler<TItem> {
    readonly selectedItemEmitter: ValueEmitter<TItem | null>
    readonly selectedItem$: ValueEmitter<TItem | null>
    private readonly ownedSelectedItemEmitter: Emitter<TItem | null> | null

    constructor(config: SingleSelectionHandlerConfig<TItem>) {
        const owned = config.selectedItemEmitter == null
            ? new Emitter<TItem | null>(null, {
                owner: config.owner,
                purpose: 'selected item',
            })
            : null
        const selectedItemEmitter = config.selectedItemEmitter ?? owned!
        super({
            getItems: config.getItems,
            ...(config.getKey == null ? {} : {getKey: config.getKey}),
            ...(config.owner === undefined ? {} : {owner: config.owner}),
            selectedItemsEmitter: new SingleSelectionArrayView(selectedItemEmitter),
        })
        this.ownedSelectedItemEmitter = owned
        this.selectedItemEmitter = selectedItemEmitter
        this.selectedItem$ = selectedItemEmitter
    }

    protected selectIndex(index: number): void {
        const item = this.getItems()[index]
        if (item === undefined) return
        this.anchorIndex = index
        this.setSelectedItems([item], 'single selection changed')
    }

    getSelectedItem(): TItem | null {
        return this.selectedItemEmitter.get()
    }

    override destroy(): void {
        super.destroy()
        this.ownedSelectedItemEmitter?.dispose()
    }
}

export class MultiSelectionHandler<TItem = unknown> extends BaseSelectionHandler<TItem> {
    protected selectIndex(index: number, event: SelectionEvent): void {
        const items = this.getItems()
        const item = items[index]
        if (item === undefined) return

        if (event.shiftKey && this.anchorIndex != null) {
            const first = Math.min(this.anchorIndex, index)
            const last = Math.max(this.anchorIndex, index)
            const range = items.slice(first, last + 1)
            const next = isCommandPressed(event)
                ? mergeByKey(this.getSelectedItems(), range, this.getKey)
                : [...range]
            this.setSelectedItems(next, 'range selection changed')
            return
        }

        if (isCommandPressed(event) || ('key' in event && event.key === ' ')) {
            const selected = this.getSelectedItems()
            const key = this.getKey(item, index)
            const exists = selected.some((candidate, candidateIndex) =>
                Object.is(this.getKey(candidate, candidateIndex), key))
            const next = exists
                ? selected.filter((candidate, candidateIndex) =>
                    !Object.is(this.getKey(candidate, candidateIndex), key))
                : [...selected, item]
            this.anchorIndex = index
            this.setSelectedItems(next, 'multi selection toggled')
            return
        }

        this.anchorIndex = index
        this.setSelectedItems([item], 'multi selection changed')
    }

    protected onKeyboardMove(index: number, event: KeyboardEvent): void {
        if (event.shiftKey) this.selectIndex(index, event)
    }

    protected supportsDragSelection(): boolean {
        return true
    }

    protected selectDragRange(
        startIndex: number,
        endIndex: number,
        event: MouseEvent,
    ): void {
        const items = this.getItems()
        const first = Math.min(startIndex, endIndex)
        const last = Math.max(startIndex, endIndex)
        const range = items.slice(first, last + 1)
        const next = isCommandPressed(event)
            ? mergeByKey(this.getSelectedItems(), range, this.getKey)
            : [...range]
        this.anchorIndex = startIndex
        this.setSelectedItems(next, 'drag selection changed')
    }
}

export function createSelectionHandler<TItem>(
    config: MultiSelectionHandlerConfig<TItem>,
): MultiSelectionHandler<TItem>
export function createSelectionHandler<TItem>(
    config: SingleSelectionHandlerConfig<TItem>,
): SingleSelectionHandler<TItem>
export function createSelectionHandler<TItem>(
    config: SelectionHandlerConfig<TItem>,
): BaseSelectionHandler<TItem> {
    return config.multiSelect
        ? new MultiSelectionHandler(config)
        : new SingleSelectionHandler(config)
}

class SingleSelectionArrayView<TItem> implements ValueEmitter<TItem[]> {
    constructor(private readonly source: ValueEmitter<TItem | null>) {}

    get(): TItem[] {
        const value = this.source.get()
        return value == null ? [] : [value]
    }

    getError(): unknown {
        return this.source.getError()
    }

    getFetchState(): ReturnType<ValueEmitter<TItem | null>['getFetchState']> {
        return this.source.getFetchState()
    }

    set(value: TItem[], eventOrCause?: unknown): boolean {
        return this.source.set(value[0] ?? null, eventOrCause)
    }

    subscribe(
        listener: (notification: EmitterNotification<TItem[], unknown>) => void,
        options?: SubscribeOptions,
    ): () => void {
        return this.source.subscribe((notification) => listener({
            ...notification,
            value: notification.value == null ? [] : [notification.value],
        }), options)
    }
}

export function defaultItemKey<TItem>(item: TItem, index: number): unknown {
    if (item != null && typeof item === 'object') {
        const id = Reflect.get(item, 'id')
        if (id != null) return id
    }
    if (typeof item === 'string' || typeof item === 'number') return item
    throw new TypeError(
        `Selection item at index ${index} needs an id or an explicit itemKey/rowKey`,
    )
}

function isCommandPressed(event: MouseEvent | KeyboardEvent): boolean {
    return Boolean(event.ctrlKey || event.metaKey)
}

function clampIndex(index: number, length: number): number {
    if (length <= 0) return 0
    return Math.min(Math.max(index, 0), length - 1)
}

function mergeByKey<TItem>(
    left: readonly TItem[],
    right: readonly TItem[],
    getKey: ItemKeyGetter<TItem>,
): TItem[] {
    const result = [...left]
    const keys = new Set(left.map((item, index) => getKey(item, index)))
    for (const item of right) {
        const key = getKey(item, result.length)
        if (!keys.has(key)) {
            keys.add(key)
            result.push(item)
        }
    }
    return result
}
