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
} from '../selectionhandler.js'
import type {
    BaseSelectionHandler,
    ItemKeyGetter,
} from '../selectionhandler.js'

export interface ListViewProps<TItem = unknown> extends ComponentProps {
    items?: readonly TItem[] | ReadableEmitter<readonly TItem[], unknown>
    selectedItemsEmitter?: ValueEmitter<TItem[]>
    itemKey?: string | ItemKeyGetter<TItem>
    multiSelect?: boolean
    label?: string
    placeholderCount?: number
    renderItem?: (item: TItem, index: number) => FrayChild
}

/** Experimental accessible listbox with stable-key selection. */
export class ListView<TItem = unknown> extends Component<ListViewProps<TItem>> {
    readonly itemsEmitter: ReadableEmitter<readonly TItem[], unknown>
    readonly items$: ReadableEmitter<readonly TItem[], unknown>
    readonly selectedItemsEmitter: ValueEmitter<TItem[]>
    readonly selectedItems$: ValueEmitter<TItem[]>
    readonly getItemKey: ItemKeyGetter<TItem>
    readonly selectionHandler: BaseSelectionHandler<TItem>
    private readonly ownedItemsEmitter: Emitter<readonly TItem[]> | null
    private readonly ownedSelectedItemsEmitter: Emitter<TItem[]> | null

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
        this.ownedSelectedItemsEmitter = props.selectedItemsEmitter == null
            ? new Emitter<TItem[]>([], {owner: this, purpose: 'selected list items'})
            : null
        this.selectedItemsEmitter = props.selectedItemsEmitter
            ?? this.ownedSelectedItemsEmitter!
        this.selectedItems$ = this.selectedItemsEmitter
        this.getItemKey = normalizeKeyGetter(props.itemKey)
        this.selectionHandler = createSelectionHandler({
            owner: this,
            multiSelect: props.multiSelect ?? false,
            selectedItemsEmitter: this.selectedItemsEmitter,
            getItems: () => this.itemsEmitter.get(),
            getKey: this.getItemKey,
        })
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
                ? <p role="alert" data-part="error">
                    {errorMessage(error, 'Unable to load items')}
                </p>
                : null}
            {isLoading && rows.length === 0
                ? <div role="status" data-part="loading">
                    <span>Loading items…</span>
                    {Array.from({length: this.props.placeholderCount ?? 5}, (_, index) =>
                        <div key={`placeholder-${index}`} data-part="placeholder-row">
                            <Placeholder width={45 + index * 7} />
                        </div>)}
                </div>
                : null}
            {status === FetchState.Ready && rows.length === 0
                ? <p role="status" data-part="empty">No items</p>
                : null}
            {rows.length > 0
                ? <div
                    role="listbox"
                    data-part="list"
                    aria-label={this.props.label ?? 'Items'}
                    aria-busy={isLoading ? 'true' : null}
                    aria-multiselectable={this.props.multiSelect ? 'true' : null}
                >{rows.map((item, index) => {
                    const key = this.getItemKey(item, index)
                    const selected = selectedKeys.has(key)
                    const content = this.props.renderItem
                        ? this.props.renderItem(item, index)
                        : defaultItemLabel(item)
                    return <div
                        key={String(key)}
                        role="option"
                        data-part="row"
                        data-fray-selectable-row=""
                        data-index={index}
                        aria-selected={String(selected)}
                        tabIndex={index === 0 ? 0 : -1}
                    >{content}</div>
                })}</div>
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

    onDestroy(): void {
        this.selectionHandler.destroy()
        this.ownedItemsEmitter?.dispose()
        this.ownedSelectedItemsEmitter?.dispose()
    }

    static dependencies = [Placeholder]

    static override hostName = 'list-view'
    static override standaloneHostName = 'list-view'

    static baseStyles = [
        ['&', 'inputlike'],
        ['& > [data-part="list"] > [data-part="row"]', 'inputline'],
    ]

    static css = css`
        & {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            min-height: 0;
        }

        & > [data-part="list"],
        & > [data-part="loading"] {
            display: flex;
            flex-direction: column;
        }

        & > [data-part="list"] > [data-part="row"] {
            cursor: default;
            user-select: none;
        }

        & > [data-part="list"] > [data-part="row"]:hover,
        & > [data-part="list"] > [data-part="row"]:focus-visible {
            background: var(--button-background-hover);
            outline: 2px solid var(--ui-accent-color);
            outline-offset: -2px;
        }

        & > [data-part="list"] > [data-part="row"][aria-selected="true"] {
            color: var(--toggle-selected-text);
            background: var(--toggle-selected-bg);
        }

        & > [data-part="empty"],
        & > [data-part="error"] {
            margin: 0;
            padding: var(--ui-padding);
        }

        & > [data-part="error"] {
            color: var(--error-color);
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
