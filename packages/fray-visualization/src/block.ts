import {
    BaseEmitter,
    DerivedEmitter,
    Emitter,
    FetchState,
    combineFetchStates,
} from '@sylwellsoftware/glue'
import type {
    EventBubble,
    FetchStateValue,
    ReadableEmitter,
} from '@sylwellsoftware/glue'

import type {Category, CategoryColors} from './grouping.js'
import {GroupingCriterion} from './grouping.js'

export type BlockOrientation = 'horizontal' | 'vertical'

export interface BlockPathSegment {
    readonly criterionKey: string
    readonly categoryKey: string
}

export type BlockPath = readonly BlockPathSegment[]

export interface BlockSplit<TItem> {
    readonly key: string
    readonly label: string
    readonly categories: readonly Category<TItem>[]
    readonly allowResorting: boolean
}

export interface BlockNode<TItem> {
    readonly key: string
    readonly path: BlockPath
    readonly criterionKey: string | null
    readonly criterionLabel: string | null
    readonly categoryKey: string | null
    readonly label: string
    readonly colors: CategoryColors | null
    readonly colorKey: string | null
    readonly count: number
    readonly share: number
    readonly totalShare: number
    readonly depth: number
    readonly items: readonly TItem[]
    readonly children: readonly BlockNode<TItem>[]
    readonly childOrientation: BlockOrientation
    readonly childrenSuppressed: boolean
}

export interface BlockPartitionIssue<TItem> {
    readonly kind: 'unmatched' | 'multiple-matches'
    readonly criterionKey: string
    readonly criterionLabel: string
    readonly parentPath: BlockPath
    readonly item: TItem
    readonly itemIndex: number
    readonly matchedCategoryKeys: readonly string[]
}

export interface BlockLayoutResult<TItem> {
    readonly valid: boolean
    readonly root: BlockNode<TItem>
    readonly issues: readonly BlockPartitionIssue<TItem>[]
}

export interface BlockLayoutOptions {
    readonly rootLabel?: string
    readonly readabilityThreshold?: number
}

/** Build a true recursive partition. Invalid zero/multiple matches are reported. */
export function buildBlockLayout<TItem>(
    items: readonly TItem[],
    splits: readonly BlockSplit<TItem>[],
    options: BlockLayoutOptions = {},
): BlockLayoutResult<TItem> {
    if (!Array.isArray(items)) throw new TypeError('Block layout items must be an array')
    if (!Array.isArray(splits)) throw new TypeError('Block layout splits must be an array')
    const readabilityThreshold = options.readabilityThreshold ?? 0.02
    if (!Number.isFinite(readabilityThreshold)
        || readabilityThreshold < 0
        || readabilityThreshold > 1) {
        throw new RangeError('Block readability threshold must be between zero and one')
    }
    const issues: BlockPartitionIssue<TItem>[] = []
    const rootItems = Object.freeze([...items])
    const root: BlockNode<TItem> = buildNode({
        items: rootItems,
        splits,
        splitIndex: 0,
        path: Object.freeze([]),
        criterion: null,
        category: null,
        parentCount: rootItems.length,
        totalShare: 1,
        readabilityThreshold,
        issues,
        rootLabel: options.rootLabel ?? 'All items',
    })
    return Object.freeze({valid: issues.length === 0, root, issues: Object.freeze(issues)})
}

export function criterionSnapshot<TItem>(criterion: GroupingCriterion<TItem>): BlockSplit<TItem> {
    if (!(criterion instanceof GroupingCriterion)) {
        throw new TypeError('criterionSnapshot requires a GroupingCriterion')
    }
    return Object.freeze({
        key: criterion.key,
        label: criterion.label,
        categories: criterion.categories$.get(),
        allowResorting: criterion.allowResorting,
    })
}

export function findBlock<TItem>(
    root: BlockNode<TItem>,
    path: BlockPath | null,
): BlockNode<TItem> | null {
    if (path == null) return null
    let current = root
    for (const segment of path) {
        const child = current.children.find((candidate) =>
            candidate.criterionKey === segment.criterionKey
            && candidate.categoryKey === segment.categoryKey)
        if (child == null) return null
        current = child
    }
    return current
}

/** Reactive layout and rebuild-safe selected subset shared by graph and application. */
export class BlockSelectionModel<TItem> {
    readonly layout$: ReadableEmitter<BlockLayoutResult<TItem>, readonly unknown[]>
    readonly selectedPath$: Emitter<BlockPath | null>
    readonly selectedBlock$: ReadableEmitter<BlockNode<TItem> | null>
    readonly selectedItems$: ReadableEmitter<readonly TItem[]>
    private readonly layoutEmitter: ReactiveBlockLayout<TItem>
    private readonly selectedBlockEmitter: DerivedEmitter<
        BlockNode<TItem> | null,
        readonly [
            ReadableEmitter<BlockLayoutResult<TItem>, readonly unknown[]>,
            Emitter<BlockPath | null>,
        ]
    >
    private readonly selectedItemsEmitter: DerivedEmitter<
        readonly TItem[],
        readonly [ReadableEmitter<BlockNode<TItem> | null>]
    >
    private readonly releases: Array<() => void> = []
    private disposed = false

    constructor(
        items$: ReadableEmitter<readonly TItem[]>,
        splits$: ReadableEmitter<readonly GroupingCriterion<TItem>[]>,
        readonly options: BlockLayoutOptions = {},
    ) {
        this.layoutEmitter = new ReactiveBlockLayout(items$, splits$, options)
        this.layout$ = this.layoutEmitter
        this.selectedPath$ = new Emitter<BlockPath | null>(null, {
            owner: this,
            purpose: 'selected block path',
            equals: blockPathsEqual,
        })
        this.selectedBlockEmitter = new DerivedEmitter<
            BlockNode<TItem> | null,
            readonly [
                ReadableEmitter<BlockLayoutResult<TItem>, readonly unknown[]>,
                Emitter<BlockPath | null>,
            ]
        >(
            [this.layout$, this.selectedPath$] as const,
            ([layout, path]) => findBlock(layout.root, path),
            {owner: this, purpose: 'selected block'},
        )
        this.selectedBlock$ = this.selectedBlockEmitter
        this.selectedItemsEmitter = new DerivedEmitter<
            readonly TItem[],
            readonly [ReadableEmitter<BlockNode<TItem> | null>]
        >(
            [this.selectedBlock$] as const,
            ([block]) => block?.items ?? Object.freeze([]),
            {owner: this, purpose: 'selected block items'},
        )
        this.selectedItems$ = this.selectedItemsEmitter
        this.releases.push(
            this.layout$.subscribe(() => this.reconcileSelection(), {emitCurrent: false}),
            this.selectedPath$.subscribe(() => this.reconcileSelection(), {emitCurrent: false}),
        )
    }

    select(path: BlockPath, eventOrCause?: unknown): boolean {
        this.assertActive()
        const frozen = freezePath(path)
        if (findBlock(this.layout$.get().root, frozen) == null) {
            throw new Error('Cannot select a path absent from the current block layout')
        }
        return this.selectedPath$.set(frozen, eventOrCause ?? 'block selected')
    }

    clear(eventOrCause?: unknown): boolean {
        this.assertActive()
        return this.selectedPath$.set(null, eventOrCause ?? 'block selection cleared')
    }

    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        for (const release of this.releases.splice(0)) release()
        this.selectedItemsEmitter.dispose()
        this.selectedBlockEmitter.dispose()
        this.selectedPath$.dispose()
        this.layoutEmitter.dispose()
    }

    private reconcileSelection(): void {
        const path = this.selectedPath$.get()
        if (path == null || findBlock(this.layout$.get().root, path) != null) return
        this.selectedPath$.set(null, 'block selection no longer exists')
    }

    private assertActive(): void {
        if (this.disposed) throw new Error('Block selection model is disposed')
    }
}

export function createBlockSelection<TItem>(
    items$: ReadableEmitter<readonly TItem[]>,
    splits$: ReadableEmitter<readonly GroupingCriterion<TItem>[]>,
    options: BlockLayoutOptions = {},
): BlockSelectionModel<TItem> {
    return new BlockSelectionModel(items$, splits$, options)
}

class ReactiveBlockLayout<TItem>
extends BaseEmitter<BlockLayoutResult<TItem>, readonly unknown[]> {
    private readonly releases: Array<() => void> = []
    private categoryReleases: Array<() => void> = []

    constructor(
        private readonly items$: ReadableEmitter<readonly TItem[]>,
        private readonly splits$: ReadableEmitter<readonly GroupingCriterion<TItem>[]>,
        private readonly options: BlockLayoutOptions,
    ) {
        super(buildBlockLayout<TItem>([], [], options), {
            purpose: 'reactive block layout',
            fetchState: FetchState.Initial,
        })
        assertReadableEmitter(items$, 'Block selection items$')
        assertReadableEmitter(splits$, 'Block selection splits$')
        this.releases.push(
            items$.subscribe(({event}) => this.recompute(event), {emitCurrent: false}),
            splits$.subscribe(({event}) => {
                this.subscribeCategories()
                this.recompute(event)
            }, {emitCurrent: false}),
        )
        this.subscribeCategories()
        this.recompute(null)
    }

    override dispose(): void {
        for (const release of this.releases.splice(0)) release()
        this.releaseCategories()
        super.dispose()
    }

    private subscribeCategories(): void {
        this.releaseCategories()
        this.categoryReleases = this.splits$.get().map((criterion) =>
            criterion.categories$.subscribe(
                ({event}) => this.recompute(event),
                {emitCurrent: false},
            ))
    }

    private releaseCategories(): void {
        for (const release of this.categoryReleases.splice(0)) release()
    }

    private recompute(parentEvent: EventBubble<unknown> | null): void {
        const splits = this.splits$.get()
        const sources: ReadableEmitter<unknown, unknown>[] = [
            this.items$,
            this.splits$,
            ...splits.map(({categories$}) => categories$),
        ]
        const states = sources.map((source) => source.getFetchState())
        const sourceErrors = sources.map((source) => source.getError()).filter(nonNull)
        let value: BlockLayoutResult<TItem>
        let computeError: unknown = null
        try {
            value = buildBlockLayout(
                this.items$.get(),
                splits.map(criterionSnapshot),
                this.options,
            )
        } catch (error) {
            computeError = error
            value = buildBlockLayout<TItem>([], [], this.options)
        }
        const errors = computeError == null ? sourceErrors : [...sourceErrors, computeError]
        const fetchState: FetchStateValue = errors.length > 0
            ? FetchState.Error
            : combineFetchStates(states)
        this.setSnapshot({
            value,
            fetchState,
            error: errors.length === 0 ? null : Object.freeze(errors),
            parentEvent,
            cause: 'block layout source changed',
        })
    }
}

interface BuildNodeArguments<TItem> {
    readonly items: readonly TItem[]
    readonly splits: readonly BlockSplit<TItem>[]
    readonly splitIndex: number
    readonly path: BlockPath
    readonly criterion: BlockSplit<TItem> | null
    readonly category: Category<TItem> | null
    readonly parentCount: number
    readonly totalShare: number
    readonly readabilityThreshold: number
    readonly issues: BlockPartitionIssue<TItem>[]
    readonly rootLabel: string
}

function buildNode<TItem>(arguments_: BuildNodeArguments<TItem>): BlockNode<TItem> {
    const {
        items,
        splits,
        splitIndex,
        path,
        criterion,
        category,
        parentCount,
        totalShare,
        readabilityThreshold,
        issues,
        rootLabel,
    } = arguments_
    const nextSplit = splits[splitIndex]
    const childrenSuppressed = nextSplit != null
        && path.length > 0
        && totalShare < readabilityThreshold
    const children = nextSplit == null || childrenSuppressed
        ? []
        : partitionChildren({
            items,
            splits,
            splitIndex,
            path,
            criterion: nextSplit,
            totalShare,
            readabilityThreshold,
            issues,
            rootLabel,
        })
    const share = parentCount === 0 ? 0 : items.length / parentCount
    return Object.freeze({
        key: pathKey(path),
        path,
        criterionKey: criterion?.key ?? null,
        criterionLabel: criterion?.label ?? null,
        categoryKey: category?.key ?? null,
        label: category?.label ?? rootLabel,
        colors: category?.colors ?? null,
        colorKey: category?.colorKey ?? null,
        count: items.length,
        share,
        totalShare,
        depth: path.length - 1,
        items,
        children: Object.freeze(children),
        childOrientation: path.length % 2 === 0 ? 'horizontal' : 'vertical',
        childrenSuppressed,
    })
}

function partitionChildren<TItem>(arguments_: {
    readonly items: readonly TItem[]
    readonly splits: readonly BlockSplit<TItem>[]
    readonly splitIndex: number
    readonly path: BlockPath
    readonly criterion: BlockSplit<TItem>
    readonly totalShare: number
    readonly readabilityThreshold: number
    readonly issues: BlockPartitionIssue<TItem>[]
    readonly rootLabel: string
}): BlockNode<TItem>[] {
    const {items, criterion, path, issues} = arguments_
    const groups = new Map(criterion.categories.map((category) => [category.key, {
        category,
        items: [] as TItem[],
    }]))
    let valid = true
    items.forEach((item, itemIndex) => {
        const matches = criterion.categories.filter((category) => category.predicate(item))
        if (matches.length !== 1) {
            valid = false
            issues.push(Object.freeze({
                kind: matches.length === 0 ? 'unmatched' : 'multiple-matches',
                criterionKey: criterion.key,
                criterionLabel: criterion.label,
                parentPath: path,
                item,
                itemIndex,
                matchedCategoryKeys: Object.freeze(matches.map(({key}) => key)),
            }))
            return
        }
        groups.get(matches[0]!.key)!.items.push(item)
    })
    if (!valid) return []
    let populated = [...groups.values()].filter((group) => group.items.length > 0)
    if (criterion.allowResorting) {
        populated = populated.sort((left, right) =>
            right.items.length - left.items.length
            || left.category.label.localeCompare(right.category.label)
            || left.category.key.localeCompare(right.category.key))
    }
    return populated.map(({category, items: childItems}) => {
        const childPath = freezePath([...path, {
            criterionKey: criterion.key,
            categoryKey: category.key,
        }])
        const share = items.length === 0 ? 0 : childItems.length / items.length
        return buildNode({
            ...arguments_,
            items: Object.freeze(childItems),
            splitIndex: arguments_.splitIndex + 1,
            path: childPath,
            criterion,
            category,
            parentCount: items.length,
            totalShare: arguments_.totalShare * share,
        })
    })
}

function freezePath(path: BlockPath): BlockPath {
    if (!Array.isArray(path)) throw new TypeError('Block path must be an array')
    return Object.freeze(path.map((segment) => {
        if (segment == null || typeof segment !== 'object') {
            throw new TypeError('Block path segments must be objects')
        }
        if (typeof segment.criterionKey !== 'string' || segment.criterionKey === ''
            || typeof segment.categoryKey !== 'string' || segment.categoryKey === '') {
            throw new TypeError('Block path keys must be non-empty strings')
        }
        return Object.freeze({...segment})
    }))
}

function blockPathsEqual(left: BlockPath | null, right: BlockPath | null): boolean {
    return left === right || (left != null && right != null
        && left.length === right.length
        && left.every((segment, index) => {
            const other = right[index]
            return segment.criterionKey === other?.criterionKey
                && segment.categoryKey === other.categoryKey
        }))
}

function pathKey(path: BlockPath): string {
    return path.length === 0 ? 'root' : path.map(({criterionKey, categoryKey}) =>
        `${encodeURIComponent(criterionKey)}=${encodeURIComponent(categoryKey)}`).join('/')
}

function nonNull<TValue>(value: TValue | null): value is TValue {
    return value != null
}

function assertReadableEmitter(value: unknown, label: string): void {
    if (value == null || (typeof value !== 'object' && typeof value !== 'function')
        || typeof Reflect.get(value, 'get') !== 'function'
        || typeof Reflect.get(value, 'getFetchState') !== 'function'
        || typeof Reflect.get(value, 'getError') !== 'function'
        || typeof Reflect.get(value, 'subscribe') !== 'function') {
        throw new TypeError(`${label} must be a readable emitter`)
    }
}
