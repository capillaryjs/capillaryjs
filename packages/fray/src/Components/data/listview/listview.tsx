import {Emitter, FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'

import {Placeholder} from '../../Placeholder.js'
import {Component, css} from '../../component.js'
import type {ComponentProps, FrayChild} from '../../component.js'
import {componentClass} from '../../controlUtils.js'
import type {ValueEmitter} from '../../controlUtils.js'
import {
    createSelectionHandler,
    defaultItemKey,
    SingleSelectionHandler,
} from '../selectionhandler.js'
import type {
    BaseSelectionHandler,
    ItemKeyGetter,
} from '../selectionhandler.js'

interface ListViewCommonProps<TItem> extends ComponentProps {
    items?: readonly TItem[] | ReadableEmitter<readonly TItem[], unknown>
    itemKey?: string | ItemKeyGetter<TItem>
    label?: string
    placeholderCount?: number
    renderItem?: (item: TItem, index: number) => FrayChild
}

export type ListViewProps<TItem = unknown> = ListViewCommonProps<TItem> & (
    | {
        multiSelect?: false
        selectedItemEmitter?: ValueEmitter<TItem | null>
        selectedItemsEmitter?: never
    }
    | {
        multiSelect: true
        selectedItemsEmitter?: ValueEmitter<TItem[]>
        selectedItemEmitter?: never
    }
)

/** Accessible listbox with stable-key selection. */
export class ListView<TItem = unknown> extends Component<ListViewProps<TItem>> {
    static override liveProps: readonly string[] = []
    readonly itemsEmitter: ReadableEmitter<readonly TItem[], unknown>
    readonly items$: ReadableEmitter<readonly TItem[], unknown>
    readonly selectedItemsEmitter: ValueEmitter<TItem[]>
    readonly selectedItems$: ValueEmitter<TItem[]>
    readonly selectedItemEmitter: ValueEmitter<TItem | null> | null
    readonly selectedItem$: ValueEmitter<TItem | null> | null
    readonly getItemKey: ItemKeyGetter<TItem>
    readonly selectionHandler: BaseSelectionHandler<TItem>
    private readonly ownedItemsEmitter: Emitter<readonly TItem[]> | null

    constructor(props: ListViewProps<TItem> = {}) {
        super(props)
        if (isReadableEmitter<readonly TItem[]>(props.items)) {
            this.itemsEmitter = props.items
            this.ownedItemsEmitter = null
        } else {
            this.ownedItemsEmitter = new Emitter<readonly TItem[]>(props.items ?? [], {
                owner: this,
                purpose: 'list items',
            })
            this.itemsEmitter = this.ownedItemsEmitter
        }
        this.items$ = this.itemsEmitter
        this.getItemKey = normalizeKeyGetter(props.itemKey)
        this.selectionHandler = props.multiSelect === true
            ? createSelectionHandler({
                owner: this,
                multiSelect: true,
                ...(props.selectedItemsEmitter == null
                    ? {}
                    : {selectedItemsEmitter: props.selectedItemsEmitter}),
                getItems: () => this.itemsEmitter.get(),
                getKey: this.getItemKey,
            })
            : createSelectionHandler({
                owner: this,
                ...(props.selectedItemEmitter == null
                    ? {}
                    : {selectedItemEmitter: props.selectedItemEmitter}),
                getItems: () => this.itemsEmitter.get(),
                getKey: this.getItemKey,
            })
        this.selectedItemsEmitter = this.selectionHandler.selectedItemsEmitter
        this.selectedItems$ = this.selectedItemsEmitter
        this.selectedItemEmitter = this.selectionHandler instanceof SingleSelectionHandler
            ? this.selectionHandler.selectedItemEmitter
            : null
        this.selectedItem$ = this.selectedItemEmitter
    }

    override setProps(nextProps: ListViewProps<TItem>): this {
        if (this.ownedItemsEmitter != null) {
            if (isReadableEmitter(nextProps.items)) {
                throw new TypeError(
                    'ListView cannot replace static or declarative items with an emitter',
                )
            }
            this.ownedItemsEmitter.set(nextProps.items ?? [], 'list items changed')
        }
        return super.setProps(nextProps)
    }

    initialize(): void {
        this.watch(this.itemsEmitter, this.selectedItemsEmitter)
    }

    render(): FrayChild {
        const rows = this.itemsEmitter.get()
        if (!Array.isArray(rows)) throw new TypeError('ListView items must be an array')
        const status = this.itemsEmitter.getFetchState()
        const error = this.itemsEmitter.getError()
        const isLoading = status === FetchState.Initial || status === FetchState.Loading
        const selectedKeys = new Set(this.selectedItemsEmitter.get()
            .map((item, index) => this.getItemKey(item, index)))

        const Host = this.Host
        return <Host
            className={componentClass(this.props) || null}
        >
            {status === FetchState.Error
                ? <p role="alert">
                    {errorMessage(error, 'Unable to load items')}
                </p>
                : null}
            {isLoading && rows.length === 0
                ? <>
                    <p role="status">Loading items…</p>
                    <ul aria-hidden="true">
                        {Array.from({length: this.props.placeholderCount ?? 5}, (_, index) =>
                            <li key={`placeholder-${index}`}>
                                <Placeholder width={45 + index * 7} />
                            </li>)}
                    </ul>
                </>
                : null}
            {status === FetchState.Ready && rows.length === 0
                ? <p role="status">No items</p>
                : null}
            {rows.length > 0
                ? <ul
                    role="listbox"
                    aria-label={this.props.label ?? 'Items'}
                    aria-busy={isLoading ? 'true' : null}
                    aria-multiselectable={this.props.multiSelect ? 'true' : null}
                >{rows.map((item, index) => {
                    const key = this.getItemKey(item, index)
                    const selected = selectedKeys.has(key)
                    const content = this.props.renderItem
                        ? this.props.renderItem(item, index)
                        : defaultItemLabel(item)
                    return <li
                        key={String(key)}
                        role="option"
                        data-fray-selectable-row=""
                        aria-selected={String(selected)}
                        tabIndex={index === 0 ? 0 : -1}
                    >{content}</li>
                })}</ul>
                : null}
        </Host>
    }

    afterUpdate(dom: ChildNode | null): void {
        const rows = dom instanceof Element
            ? dom.querySelectorAll<HTMLElement>('[data-fray-selectable-row]')
            : []
        this.selectionHandler.rowsUpdated(rows)
    }

    getSelectedItems(): TItem[] {
        return this.selectionHandler.getSelectedItems()
    }

    getSelectedItemsEmitter(): ValueEmitter<TItem[]> {
        return this.selectedItemsEmitter
    }

    getSelectedItem(): TItem | null {
        return this.selectedItemEmitter?.get() ?? null
    }

    getSelectedItemEmitter(): ValueEmitter<TItem | null> | null {
        return this.selectedItemEmitter
    }

    onDestroy(): void {
        this.selectionHandler.destroy()
        this.ownedItemsEmitter?.dispose()
    }

    static dependencies = [Placeholder]

    static override hostName = 'listview'

    static override css = css`
        & {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            height: 100%;
            padding: var(--ui-padding-v) var(--ui-padding-h);
            color: var(--ui-text-color);
            background: var(--ui-input-bg);
            border: var(--ui-input-border);
            border-radius: var(--ui-border-radius);
            box-shadow: var(--input-shadow);
            box-sizing: border-box;
            pointer-events: all;
            user-select: none;
            white-space: nowrap;
        }

        & > [role="listbox"],
        & > ul[aria-hidden="true"] {
            display: flex;
            flex-direction: column;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        & > [role="listbox"] > [role="option"] {
            display: flex;
            flex-flow: row nowrap;
            position: relative;
            min-height: calc(var(--ui-font-size) + var(--ui-padding-h) + var(--ui-padding-h));
            line-height: calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding));
            font-size: var(--ui-font-size);
            color: var(--ui-text-color);
            border-radius: var(--ui-border-radius);
            box-sizing: border-box;
            user-select: none;
        }

        & > [role="listbox"] > [role="option"]:hover {
            background: var(--hover-bg-color, #f5f5f5);
        }

        & > [role="listbox"] > [role="option"][aria-selected="true"] {
            background: var(--selected-bg-color, #e0e7ff);
        }

        & > [role="status"],
        & > [role="alert"] {
            margin: 0;
            padding: var(--ui-padding);
        }
    `
}

function normalizeKeyGetter<TItem>(
    itemKey: ListViewProps<TItem>['itemKey'],
): ItemKeyGetter<TItem> {
    if (itemKey == null) return defaultItemKey
    if (typeof itemKey === 'function') return itemKey
    if (typeof itemKey === 'string' && itemKey.length > 0) {
        return (item, index) => {
            if (item == null || (typeof item !== 'object' && typeof item !== 'function')) {
                throw new TypeError(`ListView item at index ${index} lacks ${itemKey}`)
            }
            const key = Reflect.get(item, itemKey)
            if (key == null) {
                throw new TypeError(`ListView item at index ${index} lacks ${itemKey}`)
            }
            return key
        }
    }
    throw new TypeError('ListView itemKey must be a function or property name')
}

function isReadableEmitter<TValue>(value: unknown): value is ReadableEmitter<TValue, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}

function defaultItemLabel(item: unknown): FrayChild {
    if (item != null && (typeof item === 'object' || typeof item === 'function')) {
        const label = Reflect.get(item, 'label')
        if (isRenderablePrimitive(label)) return label
    }
    return String(item)
}

function isRenderablePrimitive(value: unknown): value is string | number | null | undefined {
    return value == null || typeof value === 'string' || typeof value === 'number'
}

function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message
    return error == null ? fallback : String(error)
}
