import {FetchState} from '@sylwellsoftware/glue'
import {Button, Component, css} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'

import type {BlockNode, BlockPath} from '../block.js'
import {BlockSelectionModel, findBlock} from '../block.js'
import {categoryColorVariables} from '../grouping.js'

const fallbackCategoryColors = [
    'var(--colored-dark)',
    'var(--colored-base)',
    'var(--colored-light)',
] as const

export interface BlockGraphProps<TItem> extends ComponentProps {
    readonly model: BlockSelectionModel<TItem>
    readonly label?: string
    readonly description?: string
    readonly emptyMessage?: string
}

/** Accessible nested proportional mosaic backed by an explicit selection model. */
export class BlockGraph<TItem = unknown> extends Component<BlockGraphProps<TItem>> {
    static override liveProps: readonly string[] = []
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
        const Host = this.Host
        return <Host
            className={(this.props.className ?? this.props.class ?? '') || null}
            aria-label={label}
            aria-busy={layoutSnapshot.fetchState !== FetchState.Ready ? 'true' : null}
        >
            <header>
                <fray-summary>
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
                </fray-summary>
                <Button
                    label="Clear selection"
                    disabled={selectedPath == null}
                    onClick={() => model.clear()}
                />
            </header>
            {layoutSnapshot.fetchState === FetchState.Error
                ? <p role="alert">The block graph could not be calculated.</p>
                : layoutSnapshot.fetchState !== FetchState.Ready
                    ? <p role="status" aria-live="polite">Loading block graph…</p>
                    : !layout.valid
                        ? this.renderPartitionError(layout.issues)
                        : layout.root.count === 0
                            ? <p role="status">{emptyMessage}</p>
                            : <fray-scroller
                                tabIndex={0}
                                aria-label={`Scrollable ${label}`}
                            ><fray-blocks
                                role="tree"
                                aria-label={label}
                                className={layout.root.childOrientation}
                                onClick={(event: MouseEvent) => {
                                    if (event.target === event.currentTarget) model.clear()
                                }}
                            >{nodes.map((node) => this.renderBlock(
                                node,
                                selectedPath,
                                selected?.key ?? firstKey ?? null,
                            ))}</fray-blocks></fray-scroller>}
        </Host>
    }

    static override hostName = 'block-graph'
    static override dependencies = [Button]

    static css = css`
        & {
            display: flex;
            min-width: 0;
            min-height: var(--viz-block-graph-min-height, 24rem);
            flex-direction: column;
            padding: var(--viz-space, 0.7rem);
            overflow: hidden;
        }

        & > header {
            display: flex;
            flex: 0 0 auto;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0.5rem;
            margin-block-end: 0.6rem;
        }

        & h2,
        & p {
            margin: 0;
        }

        & header output {
            display: block;
            margin-block-start: 0.25rem;
        }

        & > fray-scroller {
            flex: 1;
            min-width: 0;
            min-height: 20rem;
            overflow: auto;
        }

        & fray-blocks,
        & fray-blockgroup {
            display: flex;
            min-width: 0;
            min-height: 0;
            align-items: stretch;
        }

        & fray-blocks {
            width: 100%;
            min-width: 34rem;
            height: 100%;
            min-height: 24rem;
        }

        & .horizontal {
            flex-direction: row;
        }

        & .vertical {
            flex-direction: column;
        }

        & [role="treeitem"] {
            position: relative;
            display: flex;
            min-width: 0;
            min-height: 0;
            flex-basis: 0;
            flex-direction: column;
            overflow: hidden;
            border: var(--block-graph-block-border, 1px solid var(--c1, var(--colored-dark)));
            border-radius: var(--block-graph-block-radius, 0.25em);
            box-shadow: var(--block-graph-block-shadow, none);
            color: var(--colored-contrast);
        }

        & [role="treeitem"] > fray-blocklabel {
            position: absolute;
            z-index: 1;
            inset-block-start: 0;
            inset-inline-start: 0;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas: "label count";
            align-items: center;
            gap: 0 0.35rem;
            width: 100%;
            padding: 0.25rem 0.4rem;
            overflow: hidden;
            text-align: start;
            border: 0;
            cursor: pointer;
        }

        & [role="treeitem"][aria-selected="true"] {
            z-index: 3;
            outline: 3px solid var(--viz-selection-color, var(--colored-contrast, Highlight));
            outline-offset: -3px;
        }

        & [role="treeitem"]:focus-visible {
            z-index: 2;
            outline: 3px solid var(--viz-focus-color, Highlight);
            outline-offset: -3px;
        }

        & fray-blocklabel > fray-blockname {
            grid-area: label;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: baseline;
            gap: 0.2rem;
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
        }

        & fray-blockname > small {
            overflow: hidden;
            font-size: 0.68rem;
            opacity: 0.82;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        & fray-blockname > strong {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        & fray-blocklabel > data {
            grid-area: count;
            align-self: center;
            font-weight: 750;
        }

        & fray-blockgroup {
            position: relative;
            z-index: 1;
            box-sizing: border-box;
            flex: 1;
            padding: var(--viz-block-graph-child-inset, 1.6em);
        }

        & [role="treeitem"]:hover:not(:has([role="treeitem"]:hover)) {
            filter: saturate(1.35) brightness(1.15);
        }

        @media (forced-colors: active) {
            & [role="treeitem"] {
                color: CanvasText;
                background: Canvas;
                border-color: CanvasText;
                forced-color-adjust: auto;
            }

            & [role="treeitem"] > fray-blocklabel {
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
        const colorVariables = categoryColorVariables(colors ?? fallbackCategoryColors)
        return <article
            key={node.key}
            role="treeitem"
            className="colored"
            tabIndex={(selected || (selectedPath == null && node.key === tabbableKey)) ? 0 : -1}
            aria-level={Math.max(1, node.depth + 1)}
            aria-selected={selected ? 'true' : 'false'}
            aria-label={`${node.criterionLabel ?? 'Items'}: ${node.label}, ${node.count} ${node.count === 1 ? 'item' : 'items'}`}
            data-block-key={node.key}
            onClick={(event: MouseEvent) => {
                if ((event.target as Element).closest('[role="treeitem"]') === event.currentTarget) {
                    this.props.model.select(node.path)
                }
            }}
            onKeyDown={(event: KeyboardEvent) => this.blockKeyDown(event, node)}
            style={{
                flexGrow: node.count,
                ...colorVariables,
                ...(colors == null ? {} : {
                    borderColor: colors[0],
                }),
            }}
        >
            <fray-blocklabel>
                <fray-blockname>
                    <small>{node.criterionLabel ?? 'Items'}:</small>
                    <strong>{node.label}</strong>
                </fray-blockname>
                <data value={String(node.count)}>{node.count}</data>
            </fray-blocklabel>
            {node.children.length === 0 ? null : <fray-blockgroup
                role="group"
                className={node.childOrientation}
            >{node.children.map((child) => this.renderBlock(
                child,
                selectedPath,
                tabbableKey,
            ))}</fray-blockgroup>}
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
