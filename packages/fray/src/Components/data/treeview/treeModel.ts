import {DerivedEmitter} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'

import type {Key} from '../../component.js'
import type {ValueEmitter} from '../../controlUtils.js'
import type {TreeNode} from './treeitem.js'

/** Validate a tree snapshot and reject keys that are not globally unique. */
export function assertTreeNodes<TValue>(
    value: unknown,
): asserts value is readonly TreeNode<TValue>[] {
    if (!Array.isArray(value)) throw new TypeError('Tree nodes must be an array')
    const keys = new Set<Key>()
    const visit = (nodes: readonly TreeNode<TValue>[]): void => {
        for (const node of nodes) {
            if (node == null || typeof node !== 'object' || node.id == null) {
                throw new TypeError('Each tree node requires an id')
            }
            if (keys.has(node.id)) throw new Error(`Duplicate tree item id: ${String(node.id)}`)
            keys.add(node.id)
            if (!Array.isArray(node.children ?? [])) {
                throw new TypeError(`Tree node ${String(node.id)} children must be an array`)
            }
            visit(node.children ?? [])
        }
    }
    visit(value as readonly TreeNode<TValue>[])
}

export function findTreeNode<TValue>(
    nodes: readonly TreeNode<TValue>[],
    key: Key,
): TreeNode<TValue> | null {
    assertTreeNodes(nodes)
    return findValidatedTreeNode(nodes, key)
}

/**
 * Project the current node for a key from complete root snapshots.
 *
 * The projection is read-only: application commands update the authoritative
 * source, which causes the full tree and then this projection to recompute.
 */
export function deriveTreeNode<TValue>(
    nodes: ReadableEmitter<readonly TreeNode<TValue>[], unknown>,
    key: ReadableEmitter<Key | null, unknown>,
    owner: unknown = null,
): DerivedEmitter<
    TreeNode<TValue> | null,
    readonly [
        ReadableEmitter<readonly TreeNode<TValue>[], unknown>,
        ReadableEmitter<Key | null, unknown>,
    ]
> {
    return new DerivedEmitter(
        [nodes, key] as const,
        ([currentNodes, currentKey]) => {
            assertTreeNodes(currentNodes)
            return currentKey == null ? null : findValidatedTreeNode(currentNodes, currentKey)
        },
        {owner, purpose: 'tree node projection'},
    )
}

/** Return a path-copied root snapshot, or the original array when no key exists. */
export function updateTreeNode<TValue>(
    nodes: readonly TreeNode<TValue>[],
    key: Key,
    update: (node: TreeNode<TValue>) => TreeNode<TValue>,
): readonly TreeNode<TValue>[] {
    assertTreeNodes(nodes)
    if (typeof update !== 'function') throw new TypeError('Tree node update must be a function')

    const visit = (items: readonly TreeNode<TValue>[]): readonly TreeNode<TValue>[] => {
        for (let index = 0; index < items.length; index += 1) {
            const node = items[index]!
            if (Object.is(node.id, key)) {
                const updated = update(node)
                if (updated == null || typeof updated !== 'object') {
                    throw new TypeError('Tree node update must return a tree node')
                }
                if (!Object.is(updated.id, node.id)) {
                    throw new Error('Tree node update cannot change the stable id')
                }
                if (Object.is(updated, node)) return items
                const result = [...items]
                result[index] = updated
                return result
            }
            const children = node.children ?? []
            const updatedChildren = visit(children)
            if (!Object.is(updatedChildren, children)) {
                const result = [...items]
                result[index] = {...node, children: updatedChildren}
                return result
            }
        }
        return items
    }

    const result = visit(nodes)
    if (!Object.is(result, nodes)) assertTreeNodes(result)
    return result
}

/** Apply a path-copy update to an authoritative writable root emitter. */
export function updateWritableTreeNode<TValue>(
    nodes: ValueEmitter<readonly TreeNode<TValue>[]>,
    key: Key,
    update: (node: TreeNode<TValue>) => TreeNode<TValue>,
    cause: unknown = 'tree node updated',
): boolean {
    const current = nodes.get()
    const next = updateTreeNode(current, key, update)
    return Object.is(next, current) ? false : nodes.set(next, cause)
}

function findValidatedTreeNode<TValue>(
    nodes: readonly TreeNode<TValue>[],
    key: Key,
): TreeNode<TValue> | null {
    for (const node of nodes) {
        if (Object.is(node.id, key)) return node
        const found = findValidatedTreeNode(node.children ?? [], key)
        if (found != null) return found
    }
    return null
}
