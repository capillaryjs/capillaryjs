import {BaseEmitter, DerivedEmitter, Emitter} from '@sylwellsoftware/glue'
import type {EmitterNotification, ReadableEmitter} from '@sylwellsoftware/glue'

import type {CategoryVisibility, VisualizationValueEmitter} from './grouping.js'
import {GroupingCriterion} from './grouping.js'

export interface SplitPreset {
    readonly key: string
    readonly label: string
    readonly active: readonly string[]
    readonly inactive?: readonly string[]
}

interface SplitState {
    readonly order: readonly string[]
    readonly active: ReadonlySet<string>
}

/** Ordered split selection shared by controls, presets, and block models. */
export class SplitSelectionModel<TItem> {
    readonly criteria: readonly GroupingCriterion<TItem>[]
    readonly presets: readonly SplitPreset[]
    readonly order$: ReadableEmitter<readonly GroupingCriterion<TItem>[]>
    readonly activeSplits$: ReadableEmitter<readonly GroupingCriterion<TItem>[]>
    readonly activePreset$: Emitter<string | null>
    private readonly byKey: ReadonlyMap<string, GroupingCriterion<TItem>>
    private readonly state$: Emitter<SplitState>
    private readonly orderEmitter: DerivedEmitter<
        readonly GroupingCriterion<TItem>[],
        readonly [Emitter<SplitState>]
    >
    private readonly activeSplitsEmitter: DerivedEmitter<
        readonly GroupingCriterion<TItem>[],
        readonly [Emitter<SplitState>]
    >
    private readonly activeEmitters = new Map<string, ActiveSplitEmitter<TItem>>()
    private disposed = false

    constructor(
        criteria: readonly GroupingCriterion<TItem>[],
        options: {
            readonly active?: readonly string[]
            readonly presets?: readonly SplitPreset[]
        } = {},
    ) {
        if (!Array.isArray(criteria) || criteria.some((item) => !(item instanceof GroupingCriterion))) {
            throw new TypeError('Split criteria must contain GroupingCriterion instances')
        }
        const byKey = new Map<string, GroupingCriterion<TItem>>(
            criteria.map((criterion) => [criterion.key, criterion]),
        )
        if (byKey.size !== criteria.length) throw new Error('Split criteria keys must be unique')
        this.criteria = Object.freeze([...criteria])
        this.byKey = byKey
        this.presets = freezePresets(options.presets ?? [], byKey)
        const order = this.criteria.map(({key}) => key)
        const active = options.active ?? order
        validateKnownUniqueKeys(active, byKey, 'Active split keys')
        this.state$ = new Emitter<SplitState>(freezeState(order, new Set(active)), {
            owner: this,
            purpose: 'split selection state',
            equals: splitStatesEqual,
        })
        this.orderEmitter = new DerivedEmitter<
            readonly GroupingCriterion<TItem>[],
            readonly [Emitter<SplitState>]
        >(
            [this.state$] as const,
            ([state]) => Object.freeze(
                state.order.map((key) => requiredCriterion(byKey, key)),
            ),
            {owner: this, purpose: 'ordered visualization criteria'},
        )
        this.order$ = this.orderEmitter
        this.activeSplitsEmitter = new DerivedEmitter<
            readonly GroupingCriterion<TItem>[],
            readonly [Emitter<SplitState>]
        >(
            [this.state$] as const,
            ([state]) => Object.freeze(state.order
                .filter((key) => state.active.has(key))
                .map((key) => requiredCriterion(byKey, key))),
            {owner: this, purpose: 'active ordered visualization splits'},
        )
        this.activeSplits$ = this.activeSplitsEmitter
        this.activePreset$ = new Emitter<string | null>(null, {
            owner: this,
            purpose: 'active visualization split preset',
        })
    }

    activeState(criterionKey: string): VisualizationValueEmitter<CategoryVisibility> {
        this.assertActive()
        const key = this.requireKey(criterionKey)
        let emitter = this.activeEmitters.get(key)
        if (emitter == null) {
            emitter = new ActiveSplitEmitter(this, key)
            this.activeEmitters.set(key, emitter)
        }
        return emitter
    }

    isActive(criterionKey: string): boolean {
        return this.state$.get().active.has(this.requireKey(criterionKey))
    }

    toggle(criterionKey: string, eventOrCause?: unknown): boolean {
        this.assertActive()
        const key = this.requireKey(criterionKey)
        const state = this.state$.get()
        const active = new Set(state.active)
        if (active.has(key)) active.delete(key)
        else active.add(key)
        this.activePreset$.set(null, 'split selection customized')
        return this.state$.set(
            freezeState(state.order, active),
            eventOrCause ?? `${key} split toggled`,
        )
    }

    move(criterionKey: string, targetIndex: number, eventOrCause?: unknown): boolean {
        this.assertActive()
        const key = this.requireKey(criterionKey)
        if (!Number.isInteger(targetIndex)) throw new TypeError('Split target index must be an integer')
        const state = this.state$.get()
        const from = state.order.indexOf(key)
        const to = Math.max(0, Math.min(targetIndex, state.order.length - 1))
        if (from === to) return false
        const order = [...state.order]
        order.splice(from, 1)
        order.splice(to, 0, key)
        this.activePreset$.set(null, 'split order customized')
        return this.state$.set(
            freezeState(order, state.active),
            eventOrCause ?? `${key} split moved`,
        )
    }

    moveBy(criterionKey: string, offset: number, eventOrCause?: unknown): boolean {
        if (!Number.isInteger(offset)) throw new TypeError('Split move offset must be an integer')
        const key = this.requireKey(criterionKey)
        return this.move(
            key,
            this.state$.get().order.indexOf(key) + offset,
            eventOrCause,
        )
    }

    setSplits(
        active: readonly string[],
        inactive?: readonly string[],
        eventOrCause?: unknown,
    ): boolean {
        this.assertActive()
        validateKnownUniqueKeys(active, this.byKey, 'Active split keys')
        const activeSet = new Set(active)
        const inactiveKeys = inactive ?? this.state$.get().order.filter((key) => !activeSet.has(key))
        validateKnownUniqueKeys(inactiveKeys, this.byKey, 'Inactive split keys')
        const combined = [...active, ...inactiveKeys]
        if (new Set(combined).size !== this.criteria.length
            || combined.length !== this.criteria.length) {
            throw new Error('Active and inactive split keys must cover every criterion exactly once')
        }
        this.activePreset$.set(null, 'split selection replaced')
        return this.state$.set(
            freezeState(combined, activeSet),
            eventOrCause ?? 'split selection replaced',
        )
    }

    applyPreset(presetKey: string): boolean {
        this.assertActive()
        const preset = this.presets.find(({key}) => key === presetKey)
        if (preset == null) throw new Error(`Unknown split preset "${presetKey}"`)
        const changed = this.setSplits(preset.active, preset.inactive, `${preset.key} preset applied`)
        this.activePreset$.set(preset.key, `${preset.key} preset applied`)
        return changed
    }

    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        for (const emitter of this.activeEmitters.values()) emitter.dispose()
        this.activeEmitters.clear()
        this.activePreset$.dispose()
        this.activeSplitsEmitter.dispose()
        this.orderEmitter.dispose()
        this.state$.dispose()
    }

    private requireKey(value: string): string {
        if (typeof value !== 'string' || !this.byKey.has(value)) {
            throw new Error(`Unknown criterion key "${String(value)}"`)
        }
        return value
    }

    private assertActive(): void {
        if (this.disposed) throw new Error('Split selection model is disposed')
    }
}

export function createSplitSelection<TItem>(
    criteria: readonly GroupingCriterion<TItem>[],
    options: {
        readonly active?: readonly string[]
        readonly presets?: readonly SplitPreset[]
    } = {},
): SplitSelectionModel<TItem> {
    return new SplitSelectionModel(criteria, options)
}

class ActiveSplitEmitter<TItem> extends BaseEmitter<CategoryVisibility>
implements VisualizationValueEmitter<CategoryVisibility> {
    private readonly release: () => void

    constructor(
        private readonly model: SplitSelectionModel<TItem>,
        private readonly criterionKey: string,
    ) {
        super(model.isActive(criterionKey) ? 'visible' : 'hidden', {
            owner: model,
            purpose: `${criterionKey} split enabled`,
            fetchState: model.activeSplits$.getFetchState(),
            error: model.activeSplits$.getError(),
        })
        this.release = model.activeSplits$.subscribe(
            (notification) => this.updateFromSource(notification),
            {emitCurrent: false},
        )
    }

    set(value: CategoryVisibility, eventOrCause?: unknown): boolean {
        if (value !== 'hidden' && value !== 'visible') {
            throw new TypeError('Split state must be hidden or visible')
        }
        if ((value === 'visible') === this.model.isActive(this.criterionKey)) return false
        return this.model.toggle(this.criterionKey, eventOrCause)
    }

    override dispose(): void {
        this.release()
        super.dispose()
    }

    private updateFromSource(
        notification: EmitterNotification<readonly GroupingCriterion<TItem>[]>,
    ): void {
        this.setSnapshot({
            value: notification.value.some(({key}) => key === this.criterionKey)
                ? 'visible'
                : 'hidden',
            fetchState: notification.fetchState,
            error: notification.error,
            parentEvent: notification.event,
            cause: 'active split membership changed',
        })
    }
}

function freezePresets<TItem>(
    presets: readonly SplitPreset[],
    criteria: ReadonlyMap<string, GroupingCriterion<TItem>>,
): readonly SplitPreset[] {
    if (!Array.isArray(presets)) throw new TypeError('Split presets must be an array')
    const keys = new Set<string>()
    return Object.freeze(presets.map((preset) => {
        if (preset == null || typeof preset !== 'object' || Array.isArray(preset)) {
            throw new TypeError('Split preset must be an object')
        }
        if (typeof preset.key !== 'string' || preset.key.trim() === '' || keys.has(preset.key)) {
            throw new Error('Split preset keys must be non-empty and unique')
        }
        if (typeof preset.label !== 'string' || preset.label.trim() === '') {
            throw new TypeError('Split preset label must be a non-empty string')
        }
        keys.add(preset.key)
        validateKnownUniqueKeys(preset.active, criteria, `${preset.key} active keys`)
        const active = Object.freeze([...preset.active])
        const inactive = preset.inactive == null
            ? Object.freeze([...criteria.keys()].filter((key) => !active.includes(key)))
            : Object.freeze([...preset.inactive])
        validateKnownUniqueKeys(inactive, criteria, `${preset.key} inactive keys`)
        if (new Set([...active, ...inactive]).size !== criteria.size
            || active.length + inactive.length !== criteria.size) {
            throw new Error(`Split preset "${preset.key}" must cover every criterion exactly once`)
        }
        return Object.freeze({...preset, active, inactive})
    }))
}

function validateKnownUniqueKeys<TItem>(
    keys: readonly string[],
    criteria: ReadonlyMap<string, GroupingCriterion<TItem>>,
    label: string,
): void {
    if (!Array.isArray(keys)) throw new TypeError(`${label} must be an array`)
    const unique = new Set(keys)
    if (unique.size !== keys.length) throw new Error(`${label} must be unique`)
    for (const key of keys) {
        if (!criteria.has(key)) throw new Error(`${label} contains unknown criterion "${key}"`)
    }
}

function requiredCriterion<TItem>(
    criteria: ReadonlyMap<string, GroupingCriterion<TItem>>,
    key: string,
): GroupingCriterion<TItem> {
    const criterion = criteria.get(key)
    if (criterion == null) throw new Error(`Missing criterion "${key}"`)
    return criterion
}

function freezeState(order: readonly string[], active: ReadonlySet<string>): SplitState {
    return Object.freeze({order: Object.freeze([...order]), active: new Set(active)})
}

function splitStatesEqual(left: SplitState, right: SplitState): boolean {
    return left.order.length === right.order.length
        && left.order.every((key, index) => key === right.order[index])
        && left.active.size === right.active.size
        && [...left.active].every((key) => right.active.has(key))
}
