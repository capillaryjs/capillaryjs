let nextEventId = 1

export interface EventOptions<TValue = unknown> {
    owner?: unknown
    purpose?: string
    value?: TValue
    cause?: unknown
    parent?: EventBubble<unknown> | null
    timestamp?: number
}

/** A causal diagnostic event. EventBus deliberately stores no history. */
export class EventBubble<TValue = unknown> {
    readonly id: string
    readonly timestamp: number
    readonly purpose: string
    readonly cause: unknown
    readonly value: TValue | undefined
    readonly parent: EventBubble<unknown> | null
    readonly parentBubble: EventBubble<unknown> | null
    readonly children: EventBubble<unknown>[] = []
    readonly ownerType: string | null
    private readonly ownerRef: WeakRef<object> | null
    private readonly strongOwner: unknown

    constructor(options: EventOptions<TValue> = {}) {
        if (options == null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('EventBubble options must be an object')
        }

        this.id = `event-${nextEventId++}`
        this.timestamp = options.timestamp ?? Date.now()
        this.purpose = options.purpose ?? 'unspecified'
        this.cause = options.cause ?? null
        this.value = options.value
        this.parent = options.parent ?? null
        this.parentBubble = this.parent

        const owner = options.owner
        this.ownerType = owner == null
            ? null
            : getConstructorName(owner) ?? typeof owner
        if (canBeWeaklyReferenced(owner) && typeof WeakRef === 'function') {
            this.ownerRef = new WeakRef(owner)
            this.strongOwner = undefined
        } else {
            this.ownerRef = null
            this.strongOwner = owner
        }

        this.parent?.registerChild(this)
    }

    get owner(): unknown {
        return this.ownerRef?.deref() ?? this.strongOwner
    }

    registerChild(child: EventBubble<unknown>): void {
        if (!(child instanceof EventBubble)) {
            throw new TypeError('EventBubble children must be EventBubble instances')
        }
        if (!this.children.includes(child)) this.children.push(child)
    }
}

function canBeWeaklyReferenced(value: unknown): value is object {
    return (typeof value === 'object' && value !== null) || typeof value === 'function'
}

function getConstructorName(value: object): string | undefined {
    const constructor = Reflect.get(value, 'constructor')
    if (constructor == null || (typeof constructor !== 'object' && typeof constructor !== 'function')) {
        return undefined
    }
    const name = Reflect.get(constructor, 'name')
    return typeof name === 'string' ? name : undefined
}
