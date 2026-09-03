declare const serviceType: unique symbol
declare const serviceProviderType: unique symbol

/** Typed identity for one application service contract. */
export interface ServiceKey<TService> {
    readonly name: string
    readonly [serviceType]: TService
}

/** Read-only service access exposed to service factories. */
export interface ServiceResolver {
    has(key: ServiceKey<unknown>): boolean
    require<TService>(key: ServiceKey<TService>): TService
}

export type ServiceFactory<TService> = (services: ServiceResolver) => TService

/** Immutable registration for a lazily created, scope-shared service. */
export interface ServiceProvider<TService> {
    readonly key: ServiceKey<TService>
    readonly create: ServiceFactory<TService>
    readonly [serviceProviderType]: true
}

const serviceKeys = new WeakSet<object>()
const serviceProviders = new WeakSet<object>()

/** Declare a typed service identity without selecting an implementation. */
export function defineService<TService>(name: string): ServiceKey<TService> {
    if (typeof name !== 'string' || name.trim() === '') {
        throw new TypeError('Service name must be a non-empty string')
    }
    const key = Object.freeze({name: name.trim()}) as ServiceKey<TService>
    serviceKeys.add(key)
    return key
}

/** Select the factory for a service in one application composition root. */
export function provideService<TService>(
    key: ServiceKey<TService>,
    create: ServiceFactory<TService>,
): ServiceProvider<TService> {
    assertServiceKey(key)
    if (typeof create !== 'function') {
        throw new TypeError(`Service provider "${key.name}" requires a factory function`)
    }
    const provider = Object.freeze({key, create}) as ServiceProvider<TService>
    serviceProviders.add(provider)
    return provider
}

/**
 * Explicit application service scope.
 *
 * Providers are fixed at construction. Each service is created lazily at most
 * once, shared inside this scope, and disposed in reverse creation order.
 */
export class ServiceScope implements ServiceResolver {
    private readonly providers = new Map<ServiceKey<unknown>, ServiceProvider<unknown>>()
    private readonly instances = new Map<ServiceKey<unknown>, unknown>()
    private readonly creationOrder: ServiceKey<unknown>[] = []
    private readonly resolving: ServiceKey<unknown>[] = []
    private disposed = false

    constructor(providers: readonly ServiceProvider<unknown>[] = []) {
        if (!Array.isArray(providers)) {
            throw new TypeError('ServiceScope providers must be an array')
        }
        for (const provider of providers) {
            assertServiceProvider(provider)
            if (this.providers.has(provider.key)) {
                throw new Error(`Service "${provider.key.name}" is registered more than once`)
            }
            this.providers.set(provider.key, provider)
        }
    }

    get isDisposed(): boolean {
        return this.disposed
    }

    has(key: ServiceKey<unknown>): boolean {
        this.assertActive()
        assertServiceKey(key)
        return this.providers.has(key)
    }

    require<TService>(key: ServiceKey<TService>): TService {
        this.assertActive()
        assertServiceKey(key)
        if (this.instances.has(key)) return this.instances.get(key) as TService

        const provider = this.providers.get(key) as ServiceProvider<TService> | undefined
        if (provider == null) throw new Error(`Service "${key.name}" is not registered`)

        const cycleStart = this.resolving.indexOf(key)
        if (cycleStart >= 0) {
            const cycle = [...this.resolving.slice(cycleStart), key]
                .map((entry) => entry.name)
                .join(' -> ')
            throw new Error(`Circular service dependency: ${cycle}`)
        }

        this.resolving.push(key)
        try {
            const instance = provider.create(this)
            this.instances.set(key, instance)
            this.creationOrder.push(key)
            return instance
        } finally {
            this.resolving.pop()
        }
    }

    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        const errors: unknown[] = []
        for (const key of [...this.creationOrder].reverse()) {
            const instance = this.instances.get(key)
            try {
                const dispose = readDispose(instance)
                if (dispose != null) dispose.call(instance)
            } catch (error) {
                errors.push(error)
            }
        }
        this.instances.clear()
        this.creationOrder.length = 0
        this.resolving.length = 0
        if (errors.length === 1) throw errors[0]
        if (errors.length > 1) {
            throw new AggregateError(errors, 'Several services failed during disposal')
        }
    }

    private assertActive(): void {
        if (this.disposed) throw new Error('ServiceScope has been disposed')
    }
}

export function createServiceScope(
    providers: readonly ServiceProvider<unknown>[] = [],
): ServiceScope {
    return new ServiceScope(providers)
}

function isServiceKey(value: unknown): value is ServiceKey<unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && serviceKeys.has(value as object)
}

function assertServiceKey(value: unknown): asserts value is ServiceKey<unknown> {
    if (!isServiceKey(value)) throw new TypeError('Expected a service key created by defineService()')
}

function assertServiceProvider(
    value: unknown,
): asserts value is ServiceProvider<unknown> {
    if (value == null
        || (typeof value !== 'object' && typeof value !== 'function')
        || !serviceProviders.has(value as object)) {
        throw new TypeError('Expected a service provider created by provideService()')
    }
}

function readDispose(value: unknown): (() => void) | null {
    if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return null
    const dispose = Reflect.get(value, 'dispose')
    return typeof dispose === 'function' ? dispose as () => void : null
}
