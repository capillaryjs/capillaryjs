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
            data-fray-visualization="block-graph"
            aria-label={label}
            aria-busy={layoutSnapshot.fetchState !== FetchState.Ready ? 'true' : null}
        >
            <header>
                <div>
                    <h2>{label}</h2>
                    <p>{description} {layout.root.count} items.</p>
                    <p data-part="selection">
                        <strong>Selection:</strong>{' '}
                        {selected == null ? 'None' : selected.path.length === 0
                            ? selected.label
                            : selected.path.map((segment, index) => {
                                const path = selected.path.slice(0, index + 1)
                                return findBlock(layout.root, path)?.label ?? segment.categoryKey
                            }).join(' → ')}
                    </p>
                </div>
                <button
                    type="button"
                    data-part="clear-selection"
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
                            ? <p role="status" data-part="empty">{emptyMessage}</p>
                            : <div
                                data-part="scroller"
                                tabIndex={0}
                                aria-label={`Scrollable ${label}`}
                            ><div
                                data-part="mosaic"
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
            min-height: var(--fray-viz-block-graph-min-height, 24rem);
            flex-direction: column;
            padding: var(--fray-viz-space, 0.7rem);
            overflow: hidden;
            color: var(--fray-viz-color, var(--fray-ui-color, var(--ui-text-color)));
            background: var(--fray-viz-panel-background, var(--panel-bg));
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

        section[data-fray-visualization="block-graph"] [data-part="selection"] {
            margin-block-start: 0.25rem;
        }

        section[data-fray-visualization="block-graph"] [data-part="scroller"] {
            flex: 1;
            min-width: 0;
            min-height: 20rem;
            overflow: auto;
            border: 1px solid var(--fray-viz-border-color, var(--ui-border-color));
            border-radius: var(--fray-viz-radius, var(--ui-border-radius));
        }

        section[data-fray-visualization="block-graph"] [data-part="mosaic"],
        section[data-fray-visualization="block-graph"] [data-part="children"] {
            display: flex;
            min-width: 0;
            min-height: 0;
            align-items: stretch;
        }

        section[data-fray-visualization="block-graph"] [data-part="mosaic"] {
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

        section[data-fray-visualization="block-graph"] [data-part="block"] {
            position: relative;
            display: flex;
            min-width: 0;
            min-height: 0;
            flex-basis: 0;
            flex-direction: column;
            overflow: hidden;
            color: var(--fray-viz-block-color, #fff);
            background: linear-gradient(
                135deg,
                var(--fray-viz-color-1, #31516f),
                var(--fray-viz-color-2, #426f98) 55%,
                var(--fray-viz-color-3, #24415c)
            );
            border: 1px solid color-mix(in srgb, currentColor 45%, transparent);
        }

        section[data-fray-visualization="block-graph"] [data-part="block-label"] {
            z-index: 1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas: "criterion count" "label count";
            gap: 0 0.35rem;
            width: 100%;
            min-height: 2.5rem;
            padding: 0.25rem 0.4rem;
            overflow: hidden;
            color: inherit;
            text-align: start;
            border: 0;
            border-block-end: 1px solid color-mix(in srgb, currentColor 45%, transparent);
            background: color-mix(in srgb, #000 24%, transparent);
            cursor: pointer;
        }

        section[data-fray-visualization="block-graph"]
        [data-part="block"][aria-selected="true"] > [data-part="block-label"] {
            outline: 3px solid var(--fray-viz-selection-color, #fff);
            outline-offset: -3px;
        }

        section[data-fray-visualization="block-graph"] [data-part="block"]:focus {
            z-index: 2;
            outline: 3px solid var(--fray-viz-focus-color, Highlight);
            outline-offset: -3px;
        }

        section[data-fray-visualization="block-graph"] [data-part="criterion"] {
            grid-area: criterion;
            overflow: hidden;
            font-size: 0.68rem;
            opacity: 0.82;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        section[data-fray-visualization="block-graph"] [data-part="label"] {
            grid-area: label;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        section[data-fray-visualization="block-graph"] [data-part="count"] {
            grid-area: count;
            align-self: center;
            font-weight: 750;
        }

        section[data-fray-visualization="block-graph"] [data-part="children"] {
            flex: 1;
        }

        section[data-fray-visualization="block-graph"] [data-part="partition-error"] {
            padding: 0.75rem;
            border: 2px solid var(--fray-color-error, var(--error-color));
        }

        @media (forced-colors: active) {
            section[data-fray-visualization="block-graph"] [data-part="block"] {
                color: CanvasText;
                background: Canvas;
                border-color: CanvasText;
                forced-color-adjust: auto;
            }

            section[data-fray-visualization="block-graph"] [data-part="block-label"] {
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
        const colors = node.colors ?? ['#31516f', '#426f98', '#24415c']
        return <article
            key={node.key}
            role="treeitem"
            tabIndex={(selected || (selectedPath == null && node.key === tabbableKey)) ? 0 : -1}
            aria-level={Math.max(1, node.depth + 1)}
            aria-selected={selected ? 'true' : 'false'}
            aria-label={`${node.criterionLabel ?? 'Items'}: ${node.label}, ${node.count} ${node.count === 1 ? 'item' : 'items'}`}
            data-part="block"
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
                '--fray-viz-color-1': colors[0],
                '--fray-viz-color-2': colors[1],
                '--fray-viz-color-3': colors[2],
            }}
        >
            <div
                data-part="block-label"
                data-block-key={node.key}
            >
                <span data-part="criterion">{node.criterionLabel ?? 'Items'}</span>
                <strong data-part="label">{node.label}</strong>
                <span data-part="count">{node.count}</span>
            </div>
            {node.children.length === 0 ? null : <div
                role="group"
                data-part="children"
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
        return <div role="alert" data-part="partition-error">
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
        for (const element of this.dom.querySelectorAll<HTMLElement>('[data-part="block"]')) {
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
