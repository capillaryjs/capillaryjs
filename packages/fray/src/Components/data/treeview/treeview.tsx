import {Emitter, FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'

import {Component, css, isVNode} from '../../component.js'
import type {ComponentProps, FrayChild, Key} from '../../component.js'
import {classNames, componentClass, invoke} from '../../controlUtils.js'
import type {ValueEmitter} from '../../controlUtils.js'
import {TreeItem} from './treeitem.js'
import type {TreeItemProps, TreeNode} from './treeitem.js'
import {assertTreeNodes} from './treeModel.js'

export interface TreeViewProps<TValue = unknown> extends ComponentProps {
    nodes?: readonly TreeNode<TValue>[] | ReadableEmitter<readonly TreeNode<TValue>[], unknown>
    label: string
    selectedKeyEmitter?: ValueEmitter<Key | null>
    expandedKeysEmitter?: ValueEmitter<Key[]>
    renderItem?: (node: TreeNode<TValue>, depth: number) => FrayChild
    onSelect?: (node: TreeNode<TValue>, event: Event) => void
}

interface VisibleNode<TValue> {
    node: TreeNode<TValue>
    depth: number
    parentId: Key | null
    position: number
    setSize: number
}

/** Single-select ARIA tree with controlled expansion and selection. */
export class TreeView<TValue = unknown> extends Component<TreeViewProps<TValue>> {
    static override liveProps: readonly string[] = []
    readonly nodesEmitter: ReadableEmitter<readonly TreeNode<TValue>[], unknown>
    readonly selectedKeyEmitter: ValueEmitter<Key | null>
    readonly expandedKeysEmitter: ValueEmitter<Key[]>
    private readonly ownedNodesEmitter: Emitter<readonly TreeNode<TValue>[]> | null
    private readonly ownedSelectedEmitter: Emitter<Key | null> | null
    private readonly ownedExpandedEmitter: Emitter<Key[]> | null
    private focusedKey: Key | null = null
    private typeahead = ''
    private typeaheadTimer: ReturnType<typeof setTimeout> | null = null

    constructor(props: TreeViewProps<TValue>) {
        super(props)
        if (isReadableEmitter<readonly TreeNode<TValue>[]>(props.nodes)) {
            this.nodesEmitter = props.nodes
            this.ownedNodesEmitter = null
        } else {
            const nodes = props.nodes ?? extractDeclarativeNodes<TValue>(props.children)
            this.ownedNodesEmitter = new Emitter(nodes, {
                owner: this,
                purpose: 'tree nodes',
            })
            this.nodesEmitter = this.ownedNodesEmitter
        }
        this.ownedSelectedEmitter = props.selectedKeyEmitter == null
            ? new Emitter<Key | null>(null, {owner: this, purpose: 'selected tree key'})
            : null
        this.selectedKeyEmitter = props.selectedKeyEmitter ?? this.ownedSelectedEmitter!
        this.ownedExpandedEmitter = props.expandedKeysEmitter == null
            ? new Emitter<Key[]>([], {owner: this, purpose: 'expanded tree keys'})
            : null
        this.expandedKeysEmitter = props.expandedKeysEmitter ?? this.ownedExpandedEmitter!
    }

    initialize(): void {
        this.reconcile(this.nodesEmitter.get())
        this.watch(this.nodesEmitter, this.selectedKeyEmitter, this.expandedKeysEmitter)
        this.onCleanup(this.nodesEmitter.subscribe(({value}) => this.reconcile(value), {
            emitCurrent: false,
        }))
    }

    render(): FrayChild {
        const nodes = this.nodesEmitter.get()
        assertTreeNodes(nodes)
        const fetchState = this.nodesEmitter.getFetchState()
        const sourceError = this.nodesEmitter.getError()
        const expanded = new Set(this.expandedKeysEmitter.get())
        const visible = flattenVisible(nodes, expanded)
        const selected = this.selectedKeyEmitter.get()
        const active = visible.find(({node}) => Object.is(node.id, this.focusedKey))
            ?? visible.find(({node}) => Object.is(node.id, selected))
            ?? visible[0]
            ?? null
        this.focusedKey = active?.node.id ?? null

        const Host = this.Host
        return <Host className={classNames('datacomponentlike', componentClass(this.props))}>
            {fetchState === FetchState.Error
                ? <p role="alert">{errorMessage(sourceError, 'Unable to load tree items')}</p>
                : null}
            {fetchState !== FetchState.Error && visible.length === 0
                ? <p role="status">No tree items</p>
                : <div role="tree" aria-label={this.props.label}>
                    {visible.map((item, index) => {
                        const {node, depth, position, setSize} = item
                        const hasChildren = (node.children?.length ?? 0) > 0
                        const isExpanded = hasChildren && expanded.has(node.id)
                        const isSelected = Object.is(node.id, selected)
                        const label = this.props.renderItem?.(node, depth) ?? node.label
                        return <div
                            key={node.id}
                            role="treeitem"
                            data-index={index}
                            data-depth={depth}
                            aria-level={depth + 1}
                            aria-posinset={position}
                            aria-setsize={setSize}
                            aria-expanded={hasChildren ? String(isExpanded) : null}
                            aria-selected={String(isSelected)}
                            tabIndex={Object.is(node.id, active?.node.id) ? 0 : -1}
                            style={{'--tree-depth': depth}}
                            onClick={(event: MouseEvent) => {
                                this.focusedKey = node.id
                                if (isExpanderTarget(event.target) && hasChildren) {
                                    this.toggleExpanded(node.id)
                                    this.focusRow(node.id)
                                    return
                                }
                                this.selectNode(node, event)
                            }}
                            onFocus={() => this.focusedKey = node.id}
                            onKeyDown={(event: KeyboardEvent) =>
                                this.handleKeyDown(event, index, visible)}
                        >
                            <span
                                data-part="expander"
                                data-expandable={hasChildren ? '' : null}
                                aria-hidden="true"
                            >{hasChildren ? (isExpanded ? '▾' : '▸') : '•'}</span>
                            <span data-part="label">{label}</span>
                        </div>
                    })}
                </div>}
        </Host>
    }

    onDestroy(): void {
        if (this.typeaheadTimer != null) clearTimeout(this.typeaheadTimer)
        this.ownedNodesEmitter?.dispose()
        this.ownedSelectedEmitter?.dispose()
        this.ownedExpandedEmitter?.dispose()
    }

    static dependencies = [TreeItem]

    static override hostName = 'tree-view'
    static override standaloneHostName = 'tree-view'

    static css = css`
        & {
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: auto;
        }

        & > [role="tree"] {
            display: grid;
            align-content: start;
        }

        & [role="treeitem"] {
            display: flex;
            align-items: flex-start;
            gap: 0.35rem;
            min-width: 0;
            padding: 0.38rem 0.5rem;
            padding-inline-start: calc(0.5rem + var(--tree-depth) * 1.1rem);
            cursor: default;
            user-select: none;
        }

        & [data-part="expander"] {
            flex: 0 0 1rem;
            text-align: center;
        }

        & [data-part="expander"][data-expandable] {
            cursor: pointer;
        }

        & [data-part="label"] {
            min-width: 0;
            overflow-wrap: anywhere;
        }

        & > [role="status"] {
            margin: 0;
            padding: var(--ui-padding, 0.75rem);
        }

        @media (forced-colors: active) {
            & [role="treeitem"][aria-selected="true"] {
                outline: 2px solid Highlight;
                forced-color-adjust: auto;
            }
        }
    `

    private reconcile(nodes: readonly TreeNode<TValue>[]): void {
        assertTreeNodes(nodes)
        const allKeys = new Set(flattenAll(nodes).map(({node}) => node.id))
        const selected = this.selectedKeyEmitter.get()
        if (this.ownedSelectedEmitter != null && selected != null && !allKeys.has(selected)) {
            this.selectedKeyEmitter.set(null, 'selected tree item removed')
        }
        const expanded = this.expandedKeysEmitter.get()
        const retained = expanded.filter((key) => allKeys.has(key))
        if (this.ownedExpandedEmitter != null && !sameKeys(expanded, retained)) {
            this.expandedKeysEmitter.set(retained, 'removed tree expansions reconciled')
        }
        if (this.focusedKey != null && !allKeys.has(this.focusedKey)) this.focusedKey = null
    }

    private selectNode(node: TreeNode<TValue>, event: Event): void {
        this.selectedKeyEmitter.set(node.id, 'tree item selected')
        invoke(this.props.onSelect, node, event)
        this.focusRow(node.id)
    }

    private toggleExpanded(key: Key): void {
        const expanded = this.expandedKeysEmitter.get()
        const contains = expanded.some((candidate) => Object.is(candidate, key))
        this.expandedKeysEmitter.set(
            contains
                ? expanded.filter((candidate) => !Object.is(candidate, key))
                : [...expanded, key],
            contains ? 'tree item collapsed' : 'tree item expanded',
        )
    }

    private handleKeyDown(
        event: KeyboardEvent,
        index: number,
        visible: readonly VisibleNode<TValue>[],
    ): void {
        const current = visible[index]
        if (current == null) return
        if (event.key === 'ArrowDown') return this.move(event, visible[index + 1]?.node.id)
        if (event.key === 'ArrowUp') return this.move(event, visible[index - 1]?.node.id)
        if (event.key === 'Home') return this.move(event, visible[0]?.node.id)
        if (event.key === 'End') return this.move(event, visible.at(-1)?.node.id)
        if (event.key === 'ArrowRight') {
            event.preventDefault()
            const children = current.node.children ?? []
            if (children.length === 0) return
            const expanded = this.expandedKeysEmitter.get().some((key) =>
                Object.is(key, current.node.id))
            if (!expanded) this.toggleExpanded(current.node.id)
            else this.focusRow(children[0]!.id)
            return
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault()
            const expanded = this.expandedKeysEmitter.get().some((key) =>
                Object.is(key, current.node.id))
            if (expanded) this.toggleExpanded(current.node.id)
            else if (current.parentId != null) this.focusRow(current.parentId)
            return
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this.selectNode(current.node, event)
            return
        }
        if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
            this.handleTypeahead(event, visible, index)
        }
    }

    private move(event: KeyboardEvent, key: Key | undefined): void {
        if (key === undefined) return
        event.preventDefault()
        this.focusRow(key)
    }

    private focusRow(key: Key): void {
        this.focusedKey = key
        const rows = this.dom instanceof Element
            ? [...this.dom.querySelectorAll<HTMLElement>('[role="treeitem"]')]
            : []
        for (const row of rows) {
            const index = Number(row.dataset.index)
            const visible = flattenVisible(
                this.nodesEmitter.get(),
                new Set(this.expandedKeysEmitter.get()),
            )
            const matches = Object.is(visible[index]?.node.id, key)
            row.tabIndex = matches ? 0 : -1
            if (matches) row.focus()
        }
    }

    private handleTypeahead(
        event: KeyboardEvent,
        visible: readonly VisibleNode<TValue>[],
        index: number,
    ): void {
        event.preventDefault()
        if (this.typeaheadTimer != null) clearTimeout(this.typeaheadTimer)
        this.typeahead += event.key.toLocaleLowerCase()
        this.typeaheadTimer = setTimeout(() => {
            this.typeahead = ''
            this.typeaheadTimer = null
        }, 650)
        const candidates = [...visible.slice(index + 1), ...visible.slice(0, index + 1)]
        const match = candidates.find(({node}) => textValue(node)
            .toLocaleLowerCase()
            .startsWith(this.typeahead))
        if (match != null) this.focusRow(match.node.id)
    }
}

function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message
    return error == null ? fallback : String(error)
}

function extractDeclarativeNodes<TValue>(children: ComponentProps['children']): TreeNode<TValue>[] {
    const values = Array.isArray(children) ? children : children == null ? [] : [children]
    return values.filter((child) => isVNode(child) && child.type === TreeItem).map((child) => {
        if (!isVNode(child)) throw new TypeError('TreeView children must be TreeItem nodes')
        const props = child.props as unknown as TreeItemProps<TValue>
        return {
            id: props.id,
            label: props.label,
            ...(props.textValue == null ? {} : {textValue: props.textValue}),
            ...(props.value === undefined ? {} : {value: props.value}),
            children: extractDeclarativeNodes<TValue>(props.children),
        }
    })
}

function flattenVisible<TValue>(
    nodes: readonly TreeNode<TValue>[],
    expanded: ReadonlySet<Key>,
): VisibleNode<TValue>[] {
    const result: VisibleNode<TValue>[] = []
    const visit = (items: readonly TreeNode<TValue>[], depth: number, parentId: Key | null) => {
        items.forEach((node, index) => {
            result.push({node, depth, parentId, position: index + 1, setSize: items.length})
            if ((node.children?.length ?? 0) > 0 && expanded.has(node.id)) {
                visit(node.children ?? [], depth + 1, node.id)
            }
        })
    }
    visit(nodes, 0, null)
    return result
}

function flattenAll<TValue>(nodes: readonly TreeNode<TValue>[]): VisibleNode<TValue>[] {
    const allKeys = new Set<Key>()
    const result: VisibleNode<TValue>[] = []
    const visit = (items: readonly TreeNode<TValue>[], depth: number, parentId: Key | null) => {
        items.forEach((node, index) => {
            if (allKeys.has(node.id)) throw new Error(`Duplicate tree item id: ${String(node.id)}`)
            allKeys.add(node.id)
            result.push({node, depth, parentId, position: index + 1, setSize: items.length})
            visit(node.children ?? [], depth + 1, node.id)
        })
    }
    visit(nodes, 0, null)
    return result
}

function textValue<TValue>(node: TreeNode<TValue>): string {
    if (node.textValue != null) return node.textValue
    if (typeof node.label === 'string' || typeof node.label === 'number') return String(node.label)
    return String(node.id)
}

function sameKeys(left: readonly Key[], right: readonly Key[]): boolean {
    return left.length === right.length
        && left.every((value, index) => Object.is(value, right[index]))
}

function isReadableEmitter<TValue>(value: unknown): value is ReadableEmitter<TValue, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}

function isExpanderTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('[data-part="expander"]') != null
}
