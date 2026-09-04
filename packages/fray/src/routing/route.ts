import type {WritableEmitter} from '../Components/component.js'

const routeDescriptors = new WeakSet<object>()
const routeTargets = new WeakSet<object>()

export interface RouteCodec<TValue> {
    parse(value: string): TValue
    format(value: TValue): string
}

export interface RouteQueryCodec<TValue> {
    parse(values: readonly string[]): TValue
    format(value: TValue): readonly string[]
}

export interface LiteralRouteDescriptor {
    readonly id: string
    readonly kind: 'literal'
    readonly path: string
}

export interface ParameterRouteDescriptor<TValue> {
    readonly id: string
    readonly kind: 'parameter'
    readonly name: string
    readonly codec: RouteCodec<TValue>
}

export type RouteDescriptor<TValue = never> =
    | LiteralRouteDescriptor
    | ParameterRouteDescriptor<TValue>

export type AnyRouteDescriptor = RouteDescriptor<unknown>

export interface RouteParameterValue<TValue = unknown> {
    readonly route: ParameterRouteDescriptor<TValue>
    readonly value: TValue
}

export interface RouteTarget {
    readonly routes: readonly (LiteralRouteDescriptor | RouteParameterValue)[]
    readonly query?: Readonly<Record<string, string | readonly string[] | null | undefined>>
}

export interface RouteValueBinding<TValue> {
    readonly valueEmitter: WritableEmitter<TValue | null>
    readonly resolve?: RouteValueResolver<TValue>
}

export interface RouteResolveContext {
    readonly requestedLocation: string
    readonly resolvedValues: ReadonlyMap<AnyRouteDescriptor, unknown>
}

export type RouteValueResolver<TValue> = (
    value: TValue,
    context: RouteResolveContext,
    signal: AbortSignal,
) => TValue | RouteRedirect | Promise<TValue | RouteRedirect>

export class RouteRedirect {
    constructor(readonly target: RouteTarget) {
        assertRouteTarget(target)
        Object.freeze(this)
    }
}

export class RouteUnavailableError extends Error {
    override readonly name = 'RouteUnavailableError'

    constructor(message = 'The requested route is unavailable') {
        super(message)
    }
}

export const stringRouteCodec: RouteCodec<string> = Object.freeze({
    parse: (value: string) => value,
    format: (value: string) => value,
})

export const stringRouteQueryCodec: RouteQueryCodec<string> = Object.freeze({
    parse(values: readonly string[]) {
        if (values.length !== 1) throw new TypeError('Expected one query value')
        return values[0] ?? ''
    },
    format: (value: string) => [value],
})

export const booleanRouteQueryCodec: RouteQueryCodec<boolean> = Object.freeze({
    parse(values: readonly string[]) {
        if (values.length !== 1 || (values[0] !== 'true' && values[0] !== 'false')) {
            throw new TypeError('Expected one boolean query value')
        }
        return values[0] === 'true'
    },
    format: (value: boolean) => [String(value)],
})

export function defineRoute(id: string, path = id): LiteralRouteDescriptor {
    const normalizedId = routeName(id, 'Route id')
    const normalizedPath = routeSegment(path, 'Route path')
    const descriptor = Object.freeze({
        id: normalizedId,
        kind: 'literal' as const,
        path: normalizedPath,
    })
    routeDescriptors.add(descriptor)
    return descriptor
}

export function defineRouteParameter<TValue>(
    id: string,
    codec: RouteCodec<TValue>,
    name = id,
): ParameterRouteDescriptor<TValue> {
    const normalizedId = routeName(id, 'Route id')
    const normalizedName = routeName(name, 'Route parameter name')
    assertRouteCodec(codec)
    const descriptor = Object.freeze({
        id: normalizedId,
        kind: 'parameter' as const,
        name: normalizedName,
        codec,
    })
    routeDescriptors.add(descriptor)
    return descriptor
}

export function routeParameter<TValue>(
    route: ParameterRouteDescriptor<TValue>,
    value: TValue,
): RouteParameterValue<TValue> {
    assertRouteDescriptor(route)
    if (route.kind !== 'parameter') {
        throw new TypeError('routeParameter requires a parameter route')
    }
    const formatted = route.codec.format(value)
    assertFormattedSegment(formatted, route.name)
    return Object.freeze({route, value})
}

export function routeTarget(
    ...routes: readonly (LiteralRouteDescriptor | RouteParameterValue)[]
): RouteTarget {
    if (routes.length === 0) throw new TypeError('routeTarget requires at least one route')
    for (const part of routes) {
        if (isRouteParameterValue(part)) {
            assertRouteDescriptor(part.route)
        } else {
            assertRouteDescriptor(part)
            if (part.kind !== 'literal') {
                throw new TypeError('Parameter routes require routeParameter(route, value)')
            }
        }
    }
    const target = Object.freeze({routes: Object.freeze([...routes])})
    routeTargets.add(target)
    return target
}

export function withRouteQuery(
    target: RouteTarget,
    query: Readonly<Record<string, string | readonly string[] | null | undefined>>,
): RouteTarget {
    assertRouteTarget(target)
    if (query == null || typeof query !== 'object' || Array.isArray(query)) {
        throw new TypeError('Route target query must be an object')
    }
    const next = Object.freeze({routes: target.routes, query: Object.freeze({...query})})
    routeTargets.add(next)
    return next
}

export function redirectTo(target: RouteTarget): RouteRedirect {
    return new RouteRedirect(target)
}

export function isRouteDescriptor(value: unknown): value is AnyRouteDescriptor {
    return value != null && typeof value === 'object' && routeDescriptors.has(value)
}

export function assertRouteDescriptor(value: unknown): asserts value is AnyRouteDescriptor {
    if (!isRouteDescriptor(value)) {
        throw new TypeError('Expected a route created by defineRoute() or defineRouteParameter()')
    }
}

export function isRouteTarget(value: unknown): value is RouteTarget {
    return value != null && typeof value === 'object' && routeTargets.has(value)
}

export function assertRouteTarget(value: unknown): asserts value is RouteTarget {
    if (!isRouteTarget(value)) throw new TypeError('Expected a target created by routeTarget()')
}

export function assertRouteCodec<TValue>(
    codec: RouteCodec<TValue>,
): asserts codec is RouteCodec<TValue> {
    if (codec == null
        || typeof codec !== 'object'
        || typeof codec.parse !== 'function'
        || typeof codec.format !== 'function') {
        throw new TypeError('Route codec requires parse and format functions')
    }
}

export function assertRouteQueryCodec<TValue>(
    codec: RouteQueryCodec<TValue>,
): asserts codec is RouteQueryCodec<TValue> {
    if (codec == null
        || typeof codec !== 'object'
        || typeof codec.parse !== 'function'
        || typeof codec.format !== 'function') {
        throw new TypeError('Route query codec requires parse and format functions')
    }
}

export function formatRouteTarget(target: RouteTarget): string {
    assertRouteTarget(target)
    const segments = target.routes.map((part) => {
        if (isRouteParameterValue(part)) {
            const formatted = part.route.codec.format(part.value)
            assertFormattedSegment(formatted, part.route.name)
            return encodeURIComponent(formatted)
        }
        return encodeURIComponent(part.path)
    })
    const search = new URLSearchParams()
    for (const [name, raw] of Object.entries(target.query ?? {}).sort(([left], [right]) =>
        left.localeCompare(right))) {
        if (raw == null) continue
        const values = Array.isArray(raw) ? raw : [raw]
        for (const value of values) search.append(name, value)
    }
    const query = search.toString()
    return `/${segments.join('/')}${query === '' ? '' : `?${query}`}`
}

function isRouteParameterValue(value: unknown): value is RouteParameterValue {
    return value != null
        && typeof value === 'object'
        && 'route' in value
        && 'value' in value
        && isRouteDescriptor(value.route)
        && value.route.kind === 'parameter'
}

function routeName(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
        throw new TypeError(`${label} must be a lowercase kebab-case name`)
    }
    return value
}

function routeSegment(value: unknown, label: string): string {
    if (typeof value !== 'string'
        || value === ''
        || value === '.'
        || value === '..'
        || value.includes('/')
        || value.includes('?')
        || value.includes('#')) {
        throw new TypeError(`${label} must be one non-empty path segment`)
    }
    try {
        assertFormattedSegment(decodeURIComponent(value), label)
    } catch {
        throw new TypeError(`${label} must use valid percent encoding`)
    }
    return value
}

function assertFormattedSegment(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || value === '' || value.includes('/')) {
        throw new TypeError(`${label} codec must format one non-empty path segment`)
    }
}
