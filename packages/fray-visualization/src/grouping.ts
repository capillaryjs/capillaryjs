import {BaseEmitter, DerivedEmitter, Emitter} from '@sylwellsoftware/glue'
import type {
    EmitterNotification,
    ReadableEmitter,
} from '@sylwellsoftware/glue'

export type CategoryColors = readonly [low: string, middle: string, high: string]
export type CategoryVisibility = 'hidden' | 'visible'

export interface VisualizationValueEmitter<TValue> extends ReadableEmitter<TValue> {
    set(value: TValue, eventOrCause?: unknown): boolean
}

export interface Category<TItem> {
    readonly key: string
    readonly label: string
    readonly predicate: (item: TItem) => boolean
    readonly colors: CategoryColors
    readonly colorKey?: string
    readonly hiddenByDefault?: boolean
    readonly generated?: boolean
}

export interface CategoryDescriptor {
    readonly label: string
    readonly colors: CategoryColors
    readonly colorKey?: string
    readonly hiddenByDefault?: boolean
}

export interface CriterionOptions<TItem> {
    readonly key: string
    readonly label: string
    readonly categories$: ReadableEmitter<readonly Category<TItem>[]>
    readonly allowResorting?: boolean
    readonly initialHiddenKeys?: ReadonlySet<string> | readonly string[]
    /** @internal The factory-created source released with the criterion. */
    readonly ownedCategories?: {dispose(): void}
}

export interface StaticCriterionOptions<TItem>
extends Omit<CriterionOptions<TItem>, 'categories$' | 'ownedCategories'> {
    readonly categories: readonly Category<TItem>[]
}

export interface DerivedCategorySummary {
    readonly key: string
    readonly count: number
    readonly label: string
}

export interface DerivedCriterionOptions<TItem>
extends Omit<CriterionOptions<TItem>, 'categories$' | 'ownedCategories'> {
    readonly source$: ReadableEmitter<readonly TItem[]>
    readonly extractKeys: (item: TItem) => string | readonly string[] | null | undefined
    readonly describe: (key: string, count: number) => CategoryDescriptor
    readonly unmatched?: CategoryDescriptor & {readonly key: string}
    readonly compare?: (
        left: DerivedCategorySummary,
        right: DerivedCategorySummary,
    ) => number
}

/** One grouping dimension with reactive categories and stable-key visibility state. */
export class GroupingCriterion<TItem> {
    readonly key: string
    readonly label: string
    readonly categories$: ReadableEmitter<readonly Category<TItem>[]>
    readonly hidden$: Emitter<ReadonlySet<string>>
    readonly visibleCategories$: ReadableEmitter<readonly Category<TItem>[]>
    readonly allowResorting: boolean
    private readonly ownedCategories: {dispose(): void} | undefined
    private readonly visibleCategoriesEmitter: DerivedEmitter<
        readonly Category<TItem>[],
        readonly [
            ReadableEmitter<readonly Category<TItem>[]>,
            Emitter<ReadonlySet<string>>,
        ]
    >
    private readonly seenKeys = new Set<string>()
    private readonly visibilityEmitters = new Map<string, VisibilityEmitter>()
    private readonly releaseCategoryDefaults: () => void
    private disposed = false

    constructor(options: CriterionOptions<TItem>) {
        assertObject(options, 'Criterion options')
        this.key = assertKey(options.key, 'Criterion key')
        this.label = assertLabel(options.label, 'Criterion label')
        assertReadableEmitter(options.categories$, 'Criterion categories$')
        this.categories$ = options.categories$
        this.allowResorting = options.allowResorting ?? false
        this.ownedCategories = options.ownedCategories
        this.hidden$ = new Emitter<ReadonlySet<string>>(
            new Set(options.initialHiddenKeys ?? []),
            {owner: this, purpose: `${this.key} hidden categories`, equals: setsEqual},
        )
        this.visibleCategoriesEmitter = new DerivedEmitter<
            readonly Category<TItem>[],
            readonly [
                ReadableEmitter<readonly Category<TItem>[]>,
                Emitter<ReadonlySet<string>>,
            ]
        >(
            [this.categories$, this.hidden$] as const,
            ([categories, hidden]) => Object.freeze(
                categories.filter(({key}) => !hidden.has(key)),
            ),
            {owner: this, purpose: `${this.key} visible categories`},
        )
        this.visibleCategories$ = this.visibleCategoriesEmitter
        this.releaseCategoryDefaults = this.categories$.subscribe(({value}) => {
            if (!Array.isArray(value)) return
            this.applyFirstSeenDefaults(value)
        })
    }

    visibility(categoryKey: string): VisualizationValueEmitter<CategoryVisibility> {
        this.assertActive()
        const key = assertKey(categoryKey, 'Category key')
        let emitter = this.visibilityEmitters.get(key)
        if (emitter == null) {
            emitter = new VisibilityEmitter(this.hidden$, key, this)
            this.visibilityEmitters.set(key, emitter)
        }
        return emitter
    }

    setAllVisible(visible: boolean, eventOrCause?: unknown): boolean {
        this.assertActive()
        const currentKeys = new Set(this.categories$.get().map(({key}) => key))
        const next = new Set(this.hidden$.get())
        for (const key of currentKeys) {
            if (visible) next.delete(key)
            else next.add(key)
        }
        return this.hidden$.set(next, eventOrCause ?? `${this.key} category visibility changed`)
    }

    pruneHidden(eventOrCause?: unknown): boolean {
        this.assertActive()
        const currentKeys = new Set(this.categories$.get().map(({key}) => key))
        const next = new Set([...this.hidden$.get()].filter((key) => currentKeys.has(key)))
        return this.hidden$.set(next, eventOrCause ?? `${this.key} hidden categories pruned`)
    }

    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        this.releaseCategoryDefaults()
        for (const emitter of this.visibilityEmitters.values()) emitter.dispose()
        this.visibilityEmitters.clear()
        this.visibleCategoriesEmitter.dispose()
        this.hidden$.dispose()
        this.ownedCategories?.dispose()
    }

    private applyFirstSeenDefaults(categories: readonly Category<TItem>[]): void {
        validateCategories(categories, `${this.label} categories`)
        const next = new Set(this.hidden$.get())
        let changed = false
        for (const category of categories) {
            if (this.seenKeys.has(category.key)) continue
            this.seenKeys.add(category.key)
            if (category.hiddenByDefault === true && !next.has(category.key)) {
                next.add(category.key)
                changed = true
            }
        }
        if (changed) this.hidden$.set(next, `${this.key} first-seen defaults applied`)
    }

    private assertActive(): void {
        if (this.disposed) throw new Error(`Criterion "${this.key}" is disposed`)
    }
}

export function staticCriterion<TItem>(
    options: StaticCriterionOptions<TItem>,
): GroupingCriterion<TItem> {
    assertObject(options, 'Static criterion options')
    const categories = freezeCategories(options.categories, `${options.label} categories`)
    const categories$ = new Emitter<readonly Category<TItem>[]>(categories, {
        purpose: `${options.key} static categories`,
    })
    return new GroupingCriterion({...options, categories$, ownedCategories: categories$})
}

export function derivedCriterion<TItem>(
    options: DerivedCriterionOptions<TItem>,
): GroupingCriterion<TItem> {
    assertObject(options, 'Derived criterion options')
    assertReadableEmitter(options.source$, 'Derived criterion source$')
    if (typeof options.extractKeys !== 'function') {
        throw new TypeError('Derived criterion extractKeys must be a function')
    }
    if (typeof options.describe !== 'function') {
        throw new TypeError('Derived criterion describe must be a function')
    }
    const categories$ = new DerivedEmitter(
        [options.source$] as const,
        ([items]) => deriveCategories(items, options),
        {purpose: `${options.key} derived categories`},
    )
    return new GroupingCriterion({
        ...options,
        allowResorting: options.allowResorting ?? true,
        categories$,
        ownedCategories: categories$,
    })
}

export function deriveCategories<TItem>(
    items: readonly TItem[],
    options: Pick<
        DerivedCriterionOptions<TItem>,
        'extractKeys' | 'describe' | 'unmatched' | 'compare'
    >,
): readonly Category<TItem>[] {
    if (!Array.isArray(items)) throw new TypeError('Derived category items must be an array')
    const counts = new Map<string, number>()
    let unmatchedCount = 0
    for (const item of items) {
        const keys = normalizedKeys(options.extractKeys(item))
        if (keys.length === 0) {
            unmatchedCount += 1
            continue
        }
        for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const summaries: DerivedCategorySummary[] = [...counts]
        .filter(([, count]) => count > 0)
        .map(([key, count]) => ({key, count, label: options.describe(key, count).label}))
    summaries.sort(options.compare ?? ((left, right) =>
        right.count - left.count || left.label.localeCompare(right.label)
        || left.key.localeCompare(right.key)))

    const categories: Category<TItem>[] = summaries.map(({key, count}) => {
        const descriptor = options.describe(key, count)
        return freezeCategory({
            key,
            ...descriptor,
            generated: true,
            predicate: (item) => normalizedKeys(options.extractKeys(item)).includes(key),
        }, 'Derived category')
    })
    if (unmatchedCount > 0 && options.unmatched != null) {
        const {key, ...descriptor} = options.unmatched
        categories.push(freezeCategory({
            key,
            ...descriptor,
            generated: true,
            predicate: (item) => normalizedKeys(options.extractKeys(item)).length === 0,
        }, 'Derived unmatched category'))
    }
    return freezeCategories(categories, 'Derived categories')
}

/** Derive items rejected by none of the currently hidden category predicates. */
export function filterByHidden<TItem>(
    items$: ReadableEmitter<readonly TItem[]>,
    criteria: readonly GroupingCriterion<TItem>[],
): DerivedEmitter<readonly TItem[]> {
    assertReadableEmitter(items$, 'filterByHidden items$')
    validateCriteria(criteria)
    const sources: ReadableEmitter<unknown>[] = [items$]
    for (const criterion of criteria) sources.push(criterion.categories$, criterion.hidden$)
    return new DerivedEmitter<readonly TItem[]>(
        sources,
        (values) => {
            const items = values[0] as readonly TItem[]
            return items.filter((item) => !criteria.some((_criterion, index) => {
                const categories = values[index * 2 + 1] as readonly Category<TItem>[]
                const hidden = values[index * 2 + 2] as ReadonlySet<string>
                return categories.some((category) =>
                    hidden.has(category.key) && category.predicate(item))
            }))
        },
        {purpose: 'items filtered by hidden visualization categories'},
    )
}

/** Count matches against the unfiltered item source for one criterion. */
export function categoryCounts<TItem>(
    items$: ReadableEmitter<readonly TItem[]>,
    criterion: GroupingCriterion<TItem>,
): DerivedEmitter<ReadonlyMap<string, number>> {
    assertReadableEmitter(items$, 'categoryCounts items$')
    if (!(criterion instanceof GroupingCriterion)) {
        throw new TypeError('categoryCounts criterion must be a GroupingCriterion')
    }
    return new DerivedEmitter<ReadonlyMap<string, number>>(
        [items$, criterion.categories$] as const,
        (values) => {
            const items = values[0] as readonly TItem[]
            const categories = values[1] as readonly Category<TItem>[]
            return new Map(categories.map((category) => [
            category.key,
            items.filter((item) => category.predicate(item)).length,
            ]))
        },
        {purpose: `${criterion.key} unfiltered category counts`},
    )
}

export function setsEqual<TValue>(left: ReadonlySet<TValue>, right: ReadonlySet<TValue>): boolean {
    return left === right || (left.size === right.size && [...left].every((value) => right.has(value)))
}

class VisibilityEmitter extends BaseEmitter<CategoryVisibility>
implements VisualizationValueEmitter<CategoryVisibility> {
    private readonly release: () => void

    constructor(
        private readonly source: Emitter<ReadonlySet<string>>,
        private readonly categoryKey: string,
        owner: unknown,
    ) {
        super(source.get().has(categoryKey) ? 'hidden' : 'visible', {
            owner,
            purpose: `${categoryKey} category visibility`,
            fetchState: source.getFetchState(),
            error: source.getError(),
        })
        this.release = source.subscribe((notification) => this.updateFromSource(notification), {
            emitCurrent: false,
        })
    }

    set(value: CategoryVisibility, eventOrCause?: unknown): boolean {
        if (value !== 'hidden' && value !== 'visible') {
            throw new TypeError('Category visibility must be hidden or visible')
        }
        const next = new Set(this.source.get())
        if (value === 'hidden') next.add(this.categoryKey)
        else next.delete(this.categoryKey)
        return this.source.set(next, eventOrCause ?? `${this.categoryKey} visibility changed`)
    }

    override dispose(): void {
        this.release()
        super.dispose()
    }

    private updateFromSource(notification: EmitterNotification<ReadonlySet<string>>): void {
        this.setSnapshot({
            value: notification.value.has(this.categoryKey) ? 'hidden' : 'visible',
            fetchState: notification.fetchState,
            error: notification.error,
            parentEvent: notification.event,
            cause: 'hidden category membership changed',
        })
    }
}

function normalizedKeys(value: string | readonly string[] | null | undefined): string[] {
    const values = value == null ? [] : typeof value === 'string' ? [value] : [...value]
    const keys = values.map((entry) => assertKey(entry, 'Extracted category key'))
    return [...new Set(keys)]
}

function freezeCategories<TItem>(
    categories: readonly Category<TItem>[],
    label: string,
): readonly Category<TItem>[] {
    validateCategories(categories, label)
    return Object.freeze(categories.map((category) => freezeCategory(category, label)))
}

function freezeCategory<TItem>(category: Category<TItem>, label: string): Category<TItem> {
    assertObject(category, label)
    const frozen: Category<TItem> = {
        ...category,
        key: assertKey(category.key, `${label} key`),
        label: assertLabel(category.label, `${label} label`),
        colors: freezeColors(category.colors, `${label} colors`),
    }
    if (typeof category.predicate !== 'function') {
        throw new TypeError(`${label} predicate must be a function`)
    }
    if (category.colorKey !== undefined) assertKey(category.colorKey, `${label} colorKey`)
    return Object.freeze(frozen)
}

function validateCategories<TItem>(categories: readonly Category<TItem>[], label: string): void {
    if (!Array.isArray(categories)) throw new TypeError(`${label} must be an array`)
    const keys = new Set<string>()
    for (const category of categories) {
        assertObject(category, label)
        const key = assertKey(category.key, `${label} key`)
        if (keys.has(key)) throw new Error(`${label} contains duplicate key "${key}"`)
        keys.add(key)
        assertLabel(category.label, `${label} label`)
        freezeColors(category.colors as CategoryColors, `${label} colors`)
        if (typeof category.predicate !== 'function') {
            throw new TypeError(`${label} predicate must be a function`)
        }
    }
}

function validateCriteria<TItem>(criteria: readonly GroupingCriterion<TItem>[]): void {
    if (!Array.isArray(criteria)) throw new TypeError('Criteria must be an array')
    const keys = new Set<string>()
    for (const criterion of criteria) {
        if (!(criterion instanceof GroupingCriterion)) {
            throw new TypeError('Criteria must contain GroupingCriterion instances')
        }
        if (keys.has(criterion.key)) throw new Error(`Duplicate criterion key "${criterion.key}"`)
        keys.add(criterion.key)
    }
}

function freezeColors(colors: CategoryColors, label: string): CategoryColors {
    if (!Array.isArray(colors) || colors.length !== 3
        || colors.some((color) => typeof color !== 'string' || color.trim() === '')) {
        throw new TypeError(`${label} must contain three non-empty CSS color values`)
    }
    return Object.freeze([...colors]) as unknown as CategoryColors
}

function assertReadableEmitter(value: unknown, label: string): asserts value is ReadableEmitter<unknown> {
    if (value == null || (typeof value !== 'object' && typeof value !== 'function')
        || typeof Reflect.get(value, 'get') !== 'function'
        || typeof Reflect.get(value, 'getFetchState') !== 'function'
        || typeof Reflect.get(value, 'getError') !== 'function'
        || typeof Reflect.get(value, 'subscribe') !== 'function') {
        throw new TypeError(`${label} must be a readable emitter`)
    }
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${label} must be an object`)
    }
}

function assertKey(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${label} must be a non-empty string`)
    }
    return value
}

function assertLabel(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${label} must be a non-empty string`)
    }
    return value
}
