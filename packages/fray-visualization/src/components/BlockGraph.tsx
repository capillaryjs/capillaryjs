import {FetchState} from '@sylwellsoftware/glue'
import {Component, css} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'

import type {BlockNode, BlockPath} from '../block.js'
import {BlockSelectionModel, findBlock} from '../block.js'

export interface BlockGraphProps<TItem> extends ComponentProps {
    readonly model: BlockSelectionModel<TItem>
    readonly label?: string
    readonly description?: string
    readonly emptyMessage?: string
}

/** Accessible nested proportional mosaic backed by an explicit selection model. */
export class BlockGraph<TItem = unknown> extends Component<BlockGraphProps<TItem>> {
    render(): FrayChild {
        const {
            model,
            label = 'Block graph',
            description = 'Area is proportional to item count.',
            emptyMessage = 'No items are available.',
        } = this.props
        const layoutSnapshot = this.snapshot(model.layout$)
        const selectedPath = this.read(model.selectedPath$)
        const layout = layoutSnapshot.value
        const selected = findBlock(layout.root, selectedPath)
        const nodes = layout.root.children.length === 0
            ? [layout.root]
            : layout.root.children
        const firstKey = nodes[0]?.key
        return <section
            className={`datacomponentlike ${this.props.className ?? this.props.class ?? ''}`.trim()}
            data-fray-visualization="block-graph"
            aria-label={label}
            aria-busy={layoutSnapshot.fetchState !== FetchState.Ready ? 'true' : null}
        >
            <header>
                <div>
                    <h2>{label}</h2>
                    <p>{description} {layout.root.count} items.</p>
                    <output>
                        <strong>Selection:</strong>{' '}
                        {selected == null ? 'None' : selected.path.length === 0
                            ? selected.label
                            : selected.path.map((segment, index) => {
                                const path = selected.path.slice(0, index + 1)
                                return findBlock(layout.root, path)?.label ?? segment.categoryKey
                            }).join(' → ')}
                    </output>
                </div>
                <button
                    type="button"
                    disabled={selectedPath == null}
                    onClick={() => model.clear()}
                >Clear selection</button>
            </header>
            {layoutSnapshot.fetchState === FetchState.Error
                ? <p role="alert">The block graph could not be calculated.</p>
                : layoutSnapshot.fetchState !== FetchState.Ready
                    ? <p role="status" aria-live="polite">Loading block graph…</p>
                    : !layout.valid
                        ? this.renderPartitionError(layout.issues)
                        : layout.root.count === 0
                            ? <p role="status">{emptyMessage}</p>
                            : <div
                                className="datacomponentshell"
                                data-part="scroller"
                                tabIndex={0}
                                aria-label={`Scrollable ${label}`}
                            ><div
                                role="tree"
                                aria-label={label}
                                data-orientation={layout.root.childOrientation}
                                onClick={(event: MouseEvent) => {
                                    if (event.target === event.currentTarget) model.clear()
                                }}
                            >{nodes.map((node) => this.renderBlock(
                                node,
                                selectedPath,
                                selected?.key ?? firstKey ?? null,
                            ))}</div></div>}
        </section>
    }

    static css = css`
        section[data-fray-visualization="block-graph"] {
            display: flex;
            min-width: 0;
            min-height: var(--viz-block-graph-min-height, 24rem);
            flex-direction: column;
            padding: var(--viz-space, 0.7rem);
            overflow: hidden;
        }

        section[data-fray-visualization="block-graph"] > header {
            display: flex;
            flex: 0 0 auto;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0.5rem;
            margin-block-end: 0.6rem;
        }

        section[data-fray-visualization="block-graph"] h2,
        section[data-fray-visualization="block-graph"] p {
            margin: 0;
        }

        section[data-fray-visualization="block-graph"] header output {
            display: block;
            margin-block-start: 0.25rem;
        }

        section[data-fray-visualization="block-graph"] [data-part="scroller"] {
            flex: 1;
            min-width: 0;
            min-height: 20rem;
            overflow: auto;
        }

        section[data-fray-visualization="block-graph"] [role="tree"],
        section[data-fray-visualization="block-graph"] [role="group"] {
            display: flex;
            min-width: 0;
            min-height: 0;
            align-items: stretch;
        }

        section[data-fray-visualization="block-graph"] [role="tree"] {
            width: 100%;
            min-width: 34rem;
            height: 100%;
            min-height: 24rem;
        }

        section[data-fray-visualization="block-graph"] [data-orientation="horizontal"] {
            flex-direction: row;
        }

        section[data-fray-visualization="block-graph"] [data-orientation="vertical"] {
            flex-direction: column;
        }

        section[data-fray-visualization="block-graph"] [role="treeitem"] {
            position: relative;
            display: flex;
            min-width: 0;
            min-height: 0;
            flex-basis: 0;
            flex-direction: column;
            overflow: hidden;
        }

        section[data-fray-visualization="block-graph"] [role="treeitem"] > .coloredinner {
            z-index: 1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas: "criterion count" "label count";
            gap: 0 0.35rem;
            width: 100%;
            min-height: 2.5rem;
            padding: 0.25rem 0.4rem;
            overflow: hidden;
            text-align: start;
            border: 0;
            cursor: pointer;
        }

        section[data-fray-visualization="block-graph"]
        [role="treeitem"][aria-selected="true"] > .coloredinner {
            outline: 3px solid var(--viz-selection-color, var(--colored-contrast, Highlight));
            outline-offset: -3px;
        }

        section[data-fray-visualization="block-graph"] [role="treeitem"]:focus {
            z-index: 2;
            outline: 3px solid var(--viz-focus-color, Highlight);
            outline-offset: -3px;
        }

        section[data-fray-visualization="block-graph"] .coloredinner > small {
            grid-area: criterion;
            overflow: hidden;
            font-size: 0.68rem;
            opacity: 0.82;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        section[data-fray-visualization="block-graph"] .coloredinner > strong {
            grid-area: label;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        section[data-fray-visualization="block-graph"] .coloredinner > data {
            grid-area: count;
            align-self: center;
            font-weight: 750;
        }

        section[data-fray-visualization="block-graph"] [role="group"] {
            flex: 1;
        }

        @media (forced-colors: active) {
            section[data-fray-visualization="block-graph"] [role="treeitem"] {
                color: CanvasText;
                background: Canvas;
                border-color: CanvasText;
                forced-color-adjust: auto;
            }

            section[data-fray-visualization="block-graph"] [role="treeitem"] > .coloredinner {
                color: ButtonText;
                background: ButtonFace;
            }
        }
    `

    private renderBlock(
        node: BlockNode<TItem>,
        selectedPath: BlockPath | null,
        tabbableKey: string | null,
    ): FrayChild {
        const selected = pathsEqual(node.path, selectedPath)
        const colors = node.colors
        return <article
            className="coloredlike"
            key={node.key}
            role="treeitem"
            tabIndex={(selected || (selectedPath == null && node.key === tabbableKey)) ? 0 : -1}
            aria-level={Math.max(1, node.depth + 1)}
            aria-selected={selected ? 'true' : 'false'}
            aria-label={`${node.criterionLabel ?? 'Items'}: ${node.label}, ${node.count} ${node.count === 1 ? 'item' : 'items'}`}
            data-block-key={node.key}
            data-count={node.count}
            data-depth={node.depth}
            data-color-key={node.colorKey}
            data-children-suppressed={node.childrenSuppressed ? '' : null}
            onClick={(event: MouseEvent) => {
                if ((event.target as Element).closest('[role="treeitem"]') === event.currentTarget) {
                    this.props.model.select(node.path)
                }
            }}
            onKeyDown={(event: KeyboardEvent) => this.blockKeyDown(event, node)}
            style={{
                flexGrow: node.count,
                ...(colors == null ? {} : {
                    '--colored-light': colors[0],
                    '--colored-base': colors[1],
                    '--colored-dark': colors[2],
                }),
            }}
        >
            <div
                className="coloredinner"
            >
                <small>{node.criterionLabel ?? 'Items'}</small>
                <strong>{node.label}</strong>
                <data value={String(node.count)}>{node.count}</data>
            </div>
            {node.children.length === 0 ? null : <div
                role="group"
                data-orientation={node.childOrientation}
            >{node.children.map((child) => this.renderBlock(
                child,
                selectedPath,
                tabbableKey,
            ))}</div>}
        </article>
    }

    private renderPartitionError(issues: readonly {kind: string; criterionLabel: string}[]): FrayChild {
        const first = issues[0]
        const detail = first == null
            ? 'The selected criteria do not form a complete partition.'
            : first.kind === 'unmatched'
                ? `${first.criterionLabel} has an item with no category.`
                : `${first.criterionLabel} has an item matching multiple categories.`
        return <div role="alert">
            <strong>Invalid block partition</strong>
            <p>{detail} {issues.length} partition issue{issues.length === 1 ? '' : 's'} detected.</p>
        </div>
    }

    private blockKeyDown(event: KeyboardEvent, node: BlockNode<TItem>): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this.props.model.select(node.path, 'block selected by keyboard')
            return
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            this.props.model.clear('block selection cleared by keyboard')
            return
        }
        const root = this.props.model.layout$.get().root
        const all = flattenBlocks(root.children.length === 0 ? [root] : root.children)
        const index = all.findIndex(({key}) => key === node.key)
        let target: BlockNode<TItem> | undefined
        if (event.key === 'ArrowDown') target = all[index + 1]
        else if (event.key === 'ArrowUp') target = all[index - 1]
        else if (event.key === 'Home') target = all[0]
        else if (event.key === 'End') target = all.at(-1)
        else if (event.key === 'ArrowRight') target = node.children[0] ?? all[index + 1]
        else if (event.key === 'ArrowLeft') {
            target = node.path.length <= 1
                ? all[index - 1]
                : findBlock(root, node.path.slice(0, -1)) ?? undefined
        } else return
        if (target == null) return
        event.preventDefault()
        this.focusBlock(target.key)
    }

    private focusBlock(key: string): void {
        if (!(this.dom instanceof Element)) return
        for (const element of this.dom.querySelectorAll<HTMLElement>('[role="treeitem"]')) {
            if (element.dataset.blockKey === key) {
                element.focus()
                return
            }
        }
    }
}

export function flattenBlocks<TItem>(nodes: readonly BlockNode<TItem>[]): BlockNode<TItem>[] {
    return nodes.flatMap((node) => [node, ...flattenBlocks(node.children)])
}

function pathsEqual(left: BlockPath, right: BlockPath | null): boolean {
    return right != null
        && left.length === right.length
        && left.every((segment, index) => segment.criterionKey === right[index]?.criterionKey
            && segment.categoryKey === right[index]?.categoryKey)
}
