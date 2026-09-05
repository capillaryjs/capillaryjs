import type {
    EventBubble,
    FetchStateValue,
    ReadableEmitter,
} from '@sylwellsoftware/glue'

import {FrayRuntime, defaultFrayRuntime} from '../runtime.js'
import type {ServiceKey} from '../services.js'
import type {ResolvedRoute} from '../routing/router.js'

export const Fragment = Symbol.for('@sylwellsoftware/fray.Fragment')

export type Key = string | number

export interface ComponentProps {
    key?: Key | null
    children?: FrayChild | readonly FrayChild[]
    class?: string | null
    className?: string | null
    [name: string]: unknown
}

export type Ref<TNode extends Node = Node> =
    | ((value: TNode | null) => void)
    | {current: TNode | null}

export type FunctionComponent<TProps extends ComponentProps = ComponentProps> = (
    props: TProps,
) => FrayChild

export type ComponentConstructor<
    TProps extends ComponentProps = ComponentProps,
    TInstance extends Component<TProps> = Component<TProps>,
> = new(props: TProps) => TInstance

type AnyComponentConstructor = new(props?: never) => Component
type ConcreteComponentConstructor = new(...args: never[]) => Component

export type VNodeType<TProps extends ComponentProps = ComponentProps> =
    | string
    | typeof Fragment
    | ComponentConstructor<TProps>
    | FunctionComponent<TProps>

export interface VNode<TProps extends ComponentProps = ComponentProps> {
    readonly type: string | typeof Fragment | Function
    readonly key: Key | null
    readonly props: TProps & {children: NormalizedChild[]}
}

export type FrayChild =
    | string
    | number
    | boolean
    | null
    | undefined
    | VNode
    | Component
    | ReadableEmitter<FrayChild, unknown>
    | readonly FrayChild[]

type NormalizedChild = string | number | VNode | Component | ReadableEmitter<FrayChild, unknown>

declare const liveBindingBrand: unique symbol

/** Explicitly subscribe a DOM or component property to an emitter's current value. */
export interface LiveBinding<TValue> {
    readonly emitter: ReadableEmitter<TValue, unknown>
    readonly [liveBindingBrand]: true
}

/** Minimal writable Glue contract used by native `bind:value` and `bind:checked`. */
export interface WritableEmitter<TValue, TError = unknown>
extends ReadableEmitter<TValue, TError> {
    set(value: TValue, eventOrCause?: unknown): unknown
}

export interface EmitterSnapshot<TValue, TError = unknown> {
    readonly value: TValue
    readonly fetchState: FetchStateValue
    readonly error: TError | null
}

declare const livePropContract: unique symbol

/** Type-only declaration of the component props that accept `live()` bindings. */
export interface LivePropContract<TName extends string> {
    readonly [livePropContract]?: TName
}

/** Components opt in to every supported `live()` prop through LivePropContract. */
type DefaultLivePropName<_TProps extends ComponentProps> = never

type DeclaredLivePropName<TProps extends ComponentProps> =
    typeof livePropContract extends keyof TProps
        ? Extract<Exclude<TProps[typeof livePropContract], undefined>, keyof TProps>
        : DefaultLivePropName<TProps>

export type TemplateProps<TProps extends ComponentProps> = {
    [TName in keyof TProps as TName extends typeof livePropContract ? never : TName]:
        TName extends 'key' | 'children'
        ? TProps[TName]
        : TName extends DeclaredLivePropName<TProps>
            ? TProps[TName] | LiveBinding<Exclude<TProps[TName], undefined>>
            : TProps[TName]
}

export type BaseStyleNames = string | readonly string[]
export type BaseStyles =
    | Readonly<Record<string, BaseStyleNames>>
    | ReadonlyArray<readonly [string, BaseStyleNames]>

export interface ComponentDependency {
    registerStyles(runtime?: FrayRuntime, seen?: Set<ComponentDependency>): void
}

interface Watchable {
    subscribe(
        listener: (notification: {event: EventBubble<unknown> | null}) => void,
        options?: {emitCurrent?: boolean},
    ): () => void
}

const liveBindingValues = new WeakSet<object>()

const BOOLEAN_ATTRIBUTES = new Set([
    'allowFullScreen',
    'async',
    'autoFocus',
    'autoPlay',
    'checked',
    'controls',
    'default',
    'defer',
    'disabled',
    'formNoValidate',
    'hidden',
    'inert',
    'loop',
    'multiple',
    'muted',
    'noModule',
    'noValidate',
    'open',
    'playsInline',
    'readOnly',
    'required',
    'reversed',
    'selected',
])

const PROPERTY_PROPS = new Set([
    'checked',
    'defaultChecked',
    'defaultValue',
    'disabled',
    'indeterminate',
    'multiple',
    'muted',
    'readOnly',
    'required',
    'selected',
    'selectedIndex',
    'tabIndex',
    'value',
])

const FRAY_RENDERER_ATTRIBUTE = 'data-fray'

/** Mark an emitter as a one-way live value for a DOM or component property. */
export function live<TValue>(emitter: ReadableEmitter<TValue, unknown>): LiveBinding<TValue> {
    assertReadableEmitter(emitter, 'live')
    const binding = Object.freeze({emitter}) as LiveBinding<TValue>
    liveBindingValues.add(binding)
    return binding
}

/** Build a Fray virtual node. */
export function h<TProps extends ComponentProps = ComponentProps>(
    type: VNodeType<TProps>,
    props: TemplateProps<TProps> | null = null,
    ...children: FrayChild[]
): VNode<TProps> {
    const suppliedProps = props ?? {} as TemplateProps<TProps>
    if (typeof suppliedProps !== 'object' || Array.isArray(suppliedProps)) {
        throw new TypeError('VNode props must be an object or null')
    }
    const {
        children: propChildren,
        key = null,
        ...restProps
    } = suppliedProps
    return {
        type,
        key,
        props: {
            ...restProps,
            children: normalizeChildren([propChildren, children]),
        } as TProps & {children: NormalizedChild[]},
    }
}

type LiveValue<TValue> = TValue | LiveBinding<Exclude<TValue, undefined>>

type AriaAttributes = {
    [TName in `aria-${string}`]?: LiveValue<string | number | boolean | null | undefined>
}

type DataAttributes = {
    [TName in `data-${string}`]?: LiveValue<string | number | boolean | null | undefined>
}

interface DOMEvents<TElement extends HTMLElement> {
    onClick?: ((event: MouseEvent & {currentTarget: TElement}) => void) | undefined
    onInput?: ((event: InputEvent & {currentTarget: TElement}) => void) | undefined
    onChange?: ((event: Event & {currentTarget: TElement}) => void) | undefined
    onKeyDown?: ((event: KeyboardEvent & {currentTarget: TElement}) => void) | undefined
    onKeyUp?: ((event: KeyboardEvent & {currentTarget: TElement}) => void) | undefined
    onFocus?: ((event: FocusEvent & {currentTarget: TElement}) => void) | undefined
    onBlur?: ((event: FocusEvent & {currentTarget: TElement}) => void) | undefined
}

type FrayDOMProps<TElement extends HTMLElement> =
Omit<ComponentProps, 'class' | 'className'>
& DOMEvents<TElement>
& AriaAttributes
& DataAttributes
& {
    class?: LiveValue<string | undefined>
    className?: LiveValue<string | undefined>
    for?: string | undefined
    htmlFor?: string | undefined
    ref?: Ref<TElement> | undefined
    style?: LiveValue<string | Record<string, string | number | null | undefined> | undefined>
}

type LiveDOMProperties<TElement extends HTMLElement> = {
    [TName in keyof Omit<TElement, keyof ComponentProps | 'style' | 'children'>]?:
        LiveValue<TElement[TName] | undefined>
}

type NativeValueBinding<TElement extends HTMLElement> =
    TElement extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        ? {'bind:value'?: WritableEmitter<string> | undefined}
        : {}

type NativeCheckedBinding<TElement extends HTMLElement> =
    TElement extends HTMLInputElement
        ? {'bind:checked'?: WritableEmitter<boolean> | undefined}
        : {}

export type FrayIntrinsicElements = {
    [TTag in keyof HTMLElementTagNameMap]: FrayDOMProps<HTMLElementTagNameMap[TTag]>
        & LiveDOMProperties<HTMLElementTagNameMap[TTag]>
        & NativeValueBinding<HTMLElementTagNameMap[TTag]>
        & NativeCheckedBinding<HTMLElementTagNameMap[TTag]>
}

/** Classic JSX type namespace for consumers configured with `jsxFactory: "h"`. */
export namespace h {
    export namespace JSX {
        export type Element = VNode | Component
        export interface ElementClass extends Component {}
        export interface ElementAttributesProperty {
            props: {}
        }
        export interface ElementChildrenAttribute {
            children: {}
        }
        export interface IntrinsicAttributes {
            key?: Key
        }
        export type LibraryManagedAttributes<_TComponent, TProps extends ComponentProps> =
            TemplateProps<TProps>
        export type IntrinsicElements = FrayIntrinsicElements
    }
}

export function css(strings: TemplateStringsArray, ...values: unknown[]): string {
    return strings.reduce((result, string, index) =>
        result + string + String(values[index] ?? ''), '')
}

export class Component<TProps extends ComponentProps = ComponentProps> {
    static dependencies: ComponentDependency[] = []
    static requiredServices: readonly ServiceKey<unknown>[] = []
    /** Component `live()` bindings are opt-in; subclasses declare their allowlist. */
    static liveProps: readonly string[] | null = []
    static css = ''
    static hostName: string | null = null

    static new<TConstructor extends ConcreteComponentConstructor>(
        this: TConstructor,
        ...args: ConstructorParameters<TConstructor>
    ): InstanceType<TConstructor> {
        const instance = new this(...args)
        if (!(instance instanceof Component)) {
            throw new TypeError('Component.new() requires a Component constructor')
        }
        return instance.mount() as InstanceType<TConstructor>
    }

    static get baseStyles(): unknown {
        return {}
    }

    static registerStyles(
        this: ComponentDependency & {
            css?: string
            baseStyles?: unknown
            dependencies?: ComponentDependency[]
            hostName?: string | null
        },
        runtime: FrayRuntime = defaultFrayRuntime,
        seen: Set<ComponentDependency> = new Set(),
    ): void {
        if (seen.has(this)) return
        seen.add(this)

        const hostName = this.hostName ?? null
        if (this.css) {
            runtime.styleRegistry.registerCSS(hostName == null
                ? this.css
                : runtime.resolveHostCSS(this.css, hostName))
        }
        const baseStyles = normalizeBaseStyles(this.baseStyles)
        for (const [selector, styleNames] of baseStyles) {
            runtime.styleRegistry.registerBaseStyle(hostName == null
                ? selector
                : runtime.resolveHostSelector(selector, hostName), styleNames)
        }
        for (const dependency of this.dependencies ?? []) {
            dependency.registerStyles(runtime, seen)
        }
    }

    props: TProps
    dom: ChildNode | null = null
    /** @internal */
    _rendered: RenderRecord | null = null
    /** @internal */
    readonly _childComponents = new Set<Component>()
    private initialized = false
    private mounted = false
    private destroyed = false
    private updating = false
    private updateRequested = false
    private readonly cleanupFunctions = new Set<() => void>()
    private readonly watched = new Map<Watchable, () => void>()
    private readonly renderReadSubscriptions = new Map<Watchable, () => void>()
    private collectingRenderReads: Set<Watchable> | null = null
    /** @internal */
    _runtime: FrayRuntime = defaultFrayRuntime
    /** @internal Route lineage inherited by nested routed components. */
    _routeContext: ResolvedRoute | null = null

    constructor(props: TProps = {} as TProps) {
        if (props == null || typeof props !== 'object' || Array.isArray(props)) {
            throw new TypeError(`${this.constructor.name} props must be an object`)
        }
        this.props = props
    }

    /** One-time setup hook. Constructors must not subscribe or render. */
    initialize(): void {}

    render(): FrayChild {
        throw new Error(`${this.constructor.name} must implement render()`)
    }

    /** Render this component's configured custom host element. */
    protected host(props: ComponentProps | null = null, ...children: FrayChild[]): VNode {
        const componentType = this.constructor as typeof Component
        const hostName = componentType.hostName
        if (hostName == null) {
            throw new Error(`${this.constructor.name} does not declare a custom host name`)
        }
        return h(this._runtime.resolveElementName(hostName), {
            ...props,
            'data-fray-component': hostName,
        }, ...children)
    }

    /** JSX component for this instance's runtime-configured custom host. */
    protected readonly Host: (props: ComponentProps) => VNode = ({
        children = [],
        ...props
    }) => this.host(props, children)

    /** @internal Assign an immutable application runtime before initialization or mounting. */
    _setRuntime(runtime: FrayRuntime): this {
        if (!(runtime instanceof FrayRuntime)) {
            throw new TypeError('Component runtime must be a FrayRuntime')
        }
        if (runtime === this._runtime) return this
        if (this.initialized || this.mounted || this._rendered != null) {
            throw new Error('Cannot change a component runtime after initialization')
        }
        this._runtime = runtime
        if (this._routeContext == null) this._routeContext = runtime.router?.root ?? null
        return this
    }

    /** @internal Assign contextual route lineage before initialization. */
    _setRouteContext(context: ResolvedRoute | null): this {
        if (this.initialized || this.mounted || this._rendered != null) {
            throw new Error('Cannot change a component route context after initialization')
        }
        this._routeContext = context
        return this
    }

    /** @internal Route lineage inherited by component children. */
    _routeContextForChildren(): ResolvedRoute | null {
        return this._routeContext
    }

    mount(parent: ParentNode | null = null, before: Node | null = null): this {
        if (this.destroyed) throw new Error('Cannot mount a destroyed component')
        let mountedNow = false
        if (!this.initialized) {
            this.validateRequiredServices()
            this.initialized = true
            this.initialize()
        }
        if (!this.mounted) {
            this.mounted = true
            this.update()
            mountedNow = true
        }
        if (parent != null) {
            assertParentNode(parent)
            insertRecord(parent, this._rendered, before)
        }
        if (mountedNow) this.afterMount(this.dom)
        return this
    }

    attachTo(parent: ParentNode): this {
        this.mount(parent)
        return this
    }

    update(_event?: unknown): this {
        if (this.destroyed) return this
        if (!this.mounted) return this.mount()
        if (this.updating) {
            this.updateRequested = true
            return this
        }

        this.updating = true
        try {
            do {
                this.updateRequested = false
                const nextReads = new Set<Watchable>()
                this.collectingRenderReads = nextReads
                let nextVNode: NormalizedChild
                try {
                    nextVNode = normalizeRoot(this.render())
                } finally {
                    this.collectingRenderReads = null
                }
                this._rendered = patchRoot(this._rendered, nextVNode, this)
                this.dom = firstNode(this._rendered)
                this.reconcileRenderReads(nextReads)
                this.afterUpdate(this.dom)
            } while (this.updateRequested && !this.destroyed)
        } finally {
            this.updating = false
        }
        return this
    }

    setProps(nextProps: TProps): this {
        if (nextProps == null || typeof nextProps !== 'object' || Array.isArray(nextProps)) {
            throw new TypeError(`${this.constructor.name} props must be an object`)
        }
        this.props = nextProps
        if (this.mounted) this.update()
        return this
    }

    afterMount(_dom: ChildNode | null): void {}
    afterUpdate(_dom: ChildNode | null): void {}

    watch(...observables: Watchable[]): this {
        for (const observable of observables) {
            if (observable == null || typeof observable.subscribe !== 'function') {
                throw new TypeError('watch requires emitter-like values')
            }
            if (this.watched.has(observable)) continue
            const unsubscribe = observable.subscribe(({event}) => {
                if (this.mounted && !this.destroyed) this.update(event)
            }, {emitCurrent: false})
            this.watched.set(observable, unsubscribe)
            this.onCleanup(() => {
                unsubscribe()
                this.watched.delete(observable)
            })
        }
        return this
    }

    watchFutureValues(...observables: Watchable[]): this {
        return this.watch(...observables)
    }

    /** Read an emitter during render and rerender when that dependency changes. */
    read<TValue, TError>(emitter: ReadableEmitter<TValue, TError>): TValue {
        this.trackRenderRead(emitter)
        return emitter.get()
    }

    /** Read a Glue value, fetch state, and error as one tracked render dependency. */
    snapshot<TValue, TError>(
        emitter: ReadableEmitter<TValue, TError>,
    ): EmitterSnapshot<TValue, TError> {
        this.trackRenderRead(emitter)
        return Object.freeze({
            value: emitter.get(),
            fetchState: emitter.getFetchState(),
            error: emitter.getError(),
        })
    }

    onCleanup(cleanup: () => void): () => void {
        if (typeof cleanup !== 'function') throw new TypeError('cleanup must be a function')
        if (this.destroyed) {
            cleanup()
            return () => {}
        }
        this.cleanupFunctions.add(cleanup)
        let active = true
        return () => {
            if (!active) return
            active = false
            this.cleanupFunctions.delete(cleanup)
            cleanup()
        }
    }

    /** Resolve one explicitly declared application service from this component's runtime. */
    protected requireService<TService>(key: ServiceKey<TService>): TService {
        if (!this.initialized) {
            throw new Error('Components may resolve services during initialize() or later')
        }
        const componentType = this.constructor as typeof Component
        if (!componentType.requiredServices.includes(key)) {
            throw new Error(
                `${componentType.name} must declare service "${key.name}" in requiredServices`,
            )
        }
        return this._runtime.services.require(key)
    }

    listen<TEvent extends Event = Event>(
        target: EventTarget,
        type: string,
        listener: (event: TEvent) => void,
        options?: boolean | AddEventListenerOptions,
    ): this {
        if (target == null || typeof target.addEventListener !== 'function') {
            throw new TypeError('listen target must be an EventTarget')
        }
        const eventListener = listener as EventListener
        target.addEventListener(type, eventListener, options)
        this.onCleanup(() => target.removeEventListener(type, eventListener, options))
        return this
    }

    registerChild<TComponent extends Component>(component: TComponent): TComponent {
        if (!(component instanceof Component)) {
            throw new TypeError('registerChild requires a Component')
        }
        this._childComponents.add(component)
        return component
    }

    destroy(): void {
        if (this.destroyed) return
        this.destroyed = true
        this.mounted = false

        for (const cleanup of [...this.cleanupFunctions]) cleanup()
        this.cleanupFunctions.clear()
        this.watched.clear()
        for (const unsubscribe of this.renderReadSubscriptions.values()) unsubscribe()
        this.renderReadSubscriptions.clear()
        this.collectingRenderReads = null

        if (this._rendered) disposeRecord(this._rendered, true)
        this._rendered = null
        this.dom = null
        this._childComponents.clear()
        this.onDestroy()
    }

    private validateRequiredServices(): void {
        const componentType = this.constructor as typeof Component
        for (const key of componentType.requiredServices) {
            if (!this._runtime.services.has(key)) {
                throw new Error(`${componentType.name} requires unregistered service "${key.name}"`)
            }
        }
    }

    onDestroy(): void {}

    private trackRenderRead(emitter: ReadableEmitter<unknown, unknown>): void {
        assertReadableEmitter(emitter, 'Component.read')
        if (this.collectingRenderReads == null) {
            throw new Error('Component.read() and snapshot() may only be called during render()')
        }
        this.collectingRenderReads.add(emitter)
    }

    private reconcileRenderReads(nextReads: Set<Watchable>): void {
        for (const [emitter, unsubscribe] of this.renderReadSubscriptions) {
            if (nextReads.has(emitter)) continue
            unsubscribe()
            this.renderReadSubscriptions.delete(emitter)
        }
        for (const emitter of nextReads) {
            if (this.watched.has(emitter) || this.renderReadSubscriptions.has(emitter)) continue
            const unsubscribe = emitter.subscribe(({event}) => {
                if (this.mounted && !this.destroyed) this.update(event)
            }, {emitCurrent: false})
            this.renderReadSubscriptions.set(emitter, unsubscribe)
        }
    }
}

interface RecordBase {
    readonly kind: string
    key: Key | null
    owner: Component
}

interface TextRecord extends RecordBase {
    readonly kind: 'text'
    value: string | number
    node: Text
}

interface EmitterRecord extends RecordBase {
    readonly kind: 'emitter'
    source: ReadableEmitter<FrayChild, unknown>
    start: Comment
    end: Comment
    child: RenderRecord
    unsubscribe: () => void
}

interface LivePropRecord {
    source: ReadableEmitter<unknown, unknown>
    value: unknown
    unsubscribe: () => void
}

interface NativeBindingRecord extends LivePropRecord {
    eventName: 'input' | 'change'
    listener: EventListener
}

interface ElementRecord extends RecordBase {
    readonly kind: 'element'
    type: string
    node: HTMLElement
    props: ComponentProps
    listeners: Map<string, EventListener>
    liveProps: Map<string, LivePropRecord>
    nativeBindings: Map<string, NativeBindingRecord>
    ref: Ref<HTMLElement> | null
    children: RenderRecord[]
}

interface FragmentRecord extends RecordBase {
    readonly kind: 'fragment'
    type: typeof Fragment
    start: Comment
    end: Comment
    children: RenderRecord[]
}

interface ComponentRecord extends RecordBase {
    readonly kind: 'component'
    type: Function
    instance: Component
    prebuilt: boolean
    props: ComponentProps
    liveProps: Map<string, LivePropRecord>
}

interface FunctionRecord extends RecordBase {
    readonly kind: 'function'
    type: FunctionComponent
    props: ComponentProps
    sourceProps: ComponentProps
    liveProps: Map<string, LivePropRecord>
    child: RenderRecord
}

type RenderRecord =
    | TextRecord
    | EmitterRecord
    | ElementRecord
    | FragmentRecord
    | ComponentRecord
    | FunctionRecord

function normalizeRoot(value: FrayChild): NormalizedChild {
    if (Array.isArray(value)) return h(Fragment, null, value)
    if (value == null || typeof value === 'boolean') return h(Fragment)
    return value as NormalizedChild
}

function normalizeChildren(values: FrayChild | readonly FrayChild[]): NormalizedChild[] {
    const normalized: NormalizedChild[] = []
    const visit = (value: FrayChild): void => {
        if (Array.isArray(value)) {
            for (const child of value) visit(child)
        } else if (value != null && typeof value !== 'boolean') {
            normalized.push(value as NormalizedChild)
        }
    }
    visit(values)
    return normalized
}

function createRecord(value: NormalizedChild, owner: Component): RenderRecord {
    if (typeof value === 'string' || typeof value === 'number') {
        return {
            kind: 'text',
            key: null,
            value,
            node: document.createTextNode(String(value)),
            owner,
        }
    }

    if (isReadableEmitter(value)) {
        const start = document.createComment('fray-emitter-start')
        const end = document.createComment('fray-emitter-end')
        const current = value.get()
        if (Object.is(current, value)) {
            throw new TypeError('A Fray emitter child cannot render itself')
        }
        const fragment = document.createDocumentFragment()
        fragment.append(start, end)
        const child = createRecord(normalizeRoot(current), owner)
        insertRecord(fragment, child, end)
        const record: EmitterRecord = {
            kind: 'emitter',
            key: null,
            source: value,
            start,
            end,
            child,
            unsubscribe: () => {},
            owner,
        }
        record.unsubscribe = value.subscribe(({value: nextValue}) => {
            if (Object.is(nextValue, value)) {
                throw new TypeError('A Fray emitter child cannot render itself')
            }
            record.child = patchRoot(record.child, normalizeRoot(nextValue), owner)
        }, {emitCurrent: false})
        return record
    }

    if (value instanceof Component) {
        value._setRuntime(owner._runtime)
        value._setRouteContext(owner._routeContextForChildren())
        value.mount()
        owner.registerChild(value)
        return {
            kind: 'component',
            key: readKey(value.props),
            type: value.constructor,
            instance: value,
            prebuilt: true,
            props: value.props,
            liveProps: new Map(),
            owner,
        }
    }

    if (!isVNode(value)) {
        throw new TypeError(`Invalid Fray child: ${describeValue(value)}`)
    }

    const {type, key = null, props} = value
    if (type === Fragment) {
        const start = document.createComment('fray-fragment-start')
        const end = document.createComment('fray-fragment-end')
        const record: FragmentRecord = {
            kind: 'fragment',
            key,
            type,
            start,
            end,
            children: [],
            owner,
        }
        const fragment = document.createDocumentFragment()
        fragment.append(start, end)
        record.children = patchChildren(
            fragment,
            [],
            props.children,
            owner,
            end,
            start,
        )
        return record
    }

    if (typeof type === 'string') {
        const node = document.createElement(type)
        const record: ElementRecord = {
            kind: 'element',
            key,
            type,
            node,
            props: {},
            listeners: new Map(),
            liveProps: new Map(),
            nativeBindings: new Map(),
            ref: null,
            children: [],
            owner,
        }
        patchElementProps(record, props)
        record.children = patchChildren(node, [], props.children, owner)
        return record
    }

    if (isComponentClass(type)) {
        const sourceProps = props as ComponentProps
        assertSupportedComponentLiveProps(type, sourceProps)
        const resolvedProps = resolveLivePropValues(sourceProps)
        const instance = new type(resolvedProps as never)
        instance._setRuntime(owner._runtime)
        instance._setRouteContext(owner._routeContextForChildren())
        const record: ComponentRecord = {
            kind: 'component',
            key,
            type,
            instance,
            prebuilt: false,
            props: resolvedProps,
            liveProps: new Map(),
            owner,
        }
        subscribeComponentLiveProps(record, sourceProps)
        instance.mount()
        owner.registerChild(instance)
        return record
    }

    if (typeof type === 'function') {
        const functionType = type as FunctionComponent
        const sourceProps = props as ComponentProps
        const functionProps = resolveLivePropValues(sourceProps)
        const rendered = normalizeRoot(functionType(functionProps))
        const record: FunctionRecord = {
            kind: 'function',
            key,
            type: functionType,
            props: functionProps,
            sourceProps,
            liveProps: new Map(),
            child: createRecord(rendered, owner),
            owner,
        }
        subscribeFunctionLiveProps(record)
        return record
    }

    throw new TypeError(`Unsupported vnode type: ${describeValue(type)}`)
}

function patchRoot(
    previous: RenderRecord | null,
    value: NormalizedChild,
    owner: Component,
): RenderRecord {
    if (previous == null) return createRecord(value, owner)
    if (isCompatible(previous, value)) return patchCompatible(previous, value, owner)

    const next = createRecord(value, owner)
    const anchor = firstNode(previous)
    const parent = anchor?.parentNode ?? null
    if (parent) insertRecord(parent, next, anchor)
    disposeRecord(previous, true)
    return next
}

function patchCompatible(
    record: RenderRecord,
    value: NormalizedChild,
    owner: Component,
): RenderRecord {
    if (record.kind === 'text') {
        if (typeof value !== 'string' && typeof value !== 'number') return record
        if (!Object.is(record.value, value)) {
            record.value = value
            record.node.data = String(value)
        }
        return record
    }

    if (record.kind === 'emitter') {
        if (!isReadableEmitter(value) || record.source !== value) return record
        return record
    }

    if (record.kind === 'component') {
        if (value instanceof Component) return record
        if (isVNode(value)) patchComponentLiveProps(record, value.props)
        return record
    }

    if (!isVNode(value)) return record

    if (record.kind === 'function') {
        patchFunctionLiveProps(record, value.props)
        return record
    }

    if (record.kind === 'fragment') {
        record.children = patchChildren(
            record.start.parentNode,
            record.children,
            value.props.children,
            owner,
            record.end,
            record.start,
        )
        return record
    }

    patchElementProps(record, value.props)
    record.children = patchChildren(
        record.node,
        record.children,
        value.props.children,
        owner,
    )
    return record
}

function resolveLivePropValues(sourceProps: ComponentProps): ComponentProps {
    return Object.fromEntries(Object.entries(sourceProps).map(([key, value]) => [
        key,
        isLiveBinding(value) ? value.emitter.get() : value,
    ]))
}

function subscribeComponentLiveProps(
    record: ComponentRecord,
    sourceProps: ComponentProps,
): void {
    reconcileLiveProps(record.liveProps, sourceProps, (key, value) => {
        record.props = {...record.props, [key]: value}
        record.instance.setProps(record.props)
    })
    record.props = resolvedLiveProps(record.liveProps, sourceProps)
    record.instance.setProps(record.props)
}

function patchComponentLiveProps(record: ComponentRecord, sourceProps: ComponentProps): void {
    assertSupportedComponentLiveProps(record.type, sourceProps)
    subscribeComponentLiveProps(record, sourceProps)
}

function assertSupportedComponentLiveProps(
    componentType: Function,
    sourceProps: ComponentProps,
): void {
    const declared = Reflect.get(componentType, 'liveProps') as unknown
    if (declared == null) return
    if (!Array.isArray(declared) || declared.some((name) => typeof name !== 'string')) {
        throw new TypeError(`${componentType.name || 'Component'}.liveProps must be an array`)
    }
    const supported = new Set<string>(declared)
    for (const [name, value] of Object.entries(sourceProps)) {
        if (isLiveBinding(value) && !supported.has(name)) {
            throw new TypeError(
                `${componentType.name || 'Component'} prop "${name}" does not support live()`,
            )
        }
    }
}

function subscribeFunctionLiveProps(record: FunctionRecord): void {
    reconcileLiveProps(record.liveProps, record.sourceProps, (key, value) => {
        record.props = {...record.props, [key]: value}
        rerenderFunctionRecord(record)
    })
    record.props = resolvedLiveProps(record.liveProps, record.sourceProps)
}

function patchFunctionLiveProps(record: FunctionRecord, sourceProps: ComponentProps): void {
    record.sourceProps = sourceProps
    reconcileLiveProps(record.liveProps, sourceProps, (key, value) => {
        record.props = {...record.props, [key]: value}
        rerenderFunctionRecord(record)
    })
    record.props = resolvedLiveProps(record.liveProps, sourceProps)
    rerenderFunctionRecord(record)
}

function rerenderFunctionRecord(record: FunctionRecord): void {
    const rendered = normalizeRoot(record.type(record.props))
    record.child = patchRoot(record.child, rendered, record.owner)
}

function reconcileLiveProps(
    subscriptions: Map<string, LivePropRecord>,
    sourceProps: ComponentProps,
    onValue: (key: string, value: unknown) => void,
): void {
    for (const [key, existing] of subscriptions) {
        const next = sourceProps[key]
        if (isLiveBinding(next) && next.emitter === existing.source) continue
        existing.unsubscribe()
        subscriptions.delete(key)
    }

    for (const [key, value] of Object.entries(sourceProps)) {
        if (!isLiveBinding(value) || subscriptions.has(key)) continue
        const liveProp: LivePropRecord = {
            source: value.emitter,
            value: value.emitter.get(),
            unsubscribe: () => {},
        }
        liveProp.unsubscribe = value.emitter.subscribe(({value: nextValue}) => {
            if (subscriptions.get(key) !== liveProp) return
            liveProp.value = nextValue
            onValue(key, nextValue)
        }, {emitCurrent: false})
        subscriptions.set(key, liveProp)
    }
}

function resolvedLiveProps(
    subscriptions: Map<string, LivePropRecord>,
    sourceProps: ComponentProps,
): ComponentProps {
    return Object.fromEntries(Object.entries(sourceProps).map(([key, value]) => [
        key,
        isLiveBinding(value) ? subscriptions.get(key)?.value ?? value.emitter.get() : value,
    ]))
}

function patchChildren(
    parent: ParentNode | null,
    previous: RenderRecord[],
    values: FrayChild | readonly FrayChild[],
    owner: Component,
    end: Node | null = null,
    start: Node | null = null,
): RenderRecord[] {
    if (parent == null) throw new Error('Cannot patch a detached fragment range')
    const nextValues = normalizeChildren(values)
    const keyed = new Map<Key, RenderRecord>()
    const unkeyed: RenderRecord[] = []
    for (const record of previous) {
        if (record.key == null) unkeyed.push(record)
        else if (!keyed.has(record.key)) keyed.set(record.key, record)
    }

    const seenKeys = new Set<Key>()
    const retained = new Set<RenderRecord>()
    const nextRecords: RenderRecord[] = []
    let unkeyedIndex = 0

    for (const value of nextValues) {
        const key = valueKey(value)
        if (key != null) {
            if (seenKeys.has(key)) throw new Error(`Duplicate sibling key: ${String(key)}`)
            seenKeys.add(key)
        }
        const candidate = key == null
            ? unkeyed[unkeyedIndex++]
            : keyed.get(key)
        if (candidate && isCompatible(candidate, value)) {
            retained.add(candidate)
            nextRecords.push(patchCompatible(candidate, value, owner))
        } else {
            nextRecords.push(createRecord(value, owner))
        }
    }

    for (const record of previous) {
        if (!retained.has(record)) disposeRecord(record, true)
    }

    let cursor = start ? start.nextSibling : parent.firstChild
    for (const record of nextRecords) {
        for (const node of recordNodes(record)) {
            if (node === cursor) {
                cursor = cursor.nextSibling
            } else {
                parent.insertBefore(node, cursor ?? end)
                cursor = node.nextSibling
            }
        }
    }

    return nextRecords
}

function patchElementProps(record: ElementRecord, nextProps: ComponentProps): void {
    const next = Object.fromEntries(Object.entries(nextProps).filter(([key]) =>
        key !== 'children' && normalizeAttributeName(key) !== FRAY_RENDERER_ATTRIBUTE,
    )) as ComponentProps
    const previous = record.props
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)])

    for (const property of ['value', 'checked'] as const) {
        if (Object.hasOwn(next, property) && Object.hasOwn(next, `bind:${property}`)) {
            throw new Error(`${property} and bind:${property} cannot be used together`)
        }
    }

    for (const key of keys) {
        const previousValue = previous[key]
        const nextValue = next[key]
        if (isNativeBindingProp(key)) {
            patchNativeBinding(record, key, nextValue)
        } else if (key === 'ref') {
            if (previousValue !== nextValue) patchRef(record, nextValue)
        } else if (isEventProp(key)) {
            patchEvent(record, key, nextValue)
        } else if (isLiveBinding(nextValue)) {
            patchLiveElementProp(record, key, nextValue)
        } else {
            const previousLive = record.liveProps.get(key)
            if (previousLive) {
                previousLive.unsubscribe()
                record.liveProps.delete(key)
            }
            const previousResolved = previousLive?.value ?? previousValue
            if (!Object.is(previousResolved, nextValue)) {
                patchDOMProp(record.node, key, previousResolved, nextValue)
            }
        }
    }
    record.node.setAttribute(FRAY_RENDERER_ATTRIBUTE, '')
    record.props = {...next}
}

function patchLiveElementProp(
    record: ElementRecord,
    key: string,
    binding: LiveBinding<unknown>,
): void {
    const existing = record.liveProps.get(key)
    if (existing?.source === binding.emitter) return

    existing?.unsubscribe()
    const value = binding.emitter.get()
    patchDOMProp(record.node, key, existing?.value ?? record.props[key], value)
    const liveProp: LivePropRecord = {
        source: binding.emitter,
        value,
        unsubscribe: () => {},
    }
    liveProp.unsubscribe = binding.emitter.subscribe(({value: nextValue}) => {
        const previousValue = liveProp.value
        liveProp.value = nextValue
        if (!Object.is(previousValue, nextValue)) {
            patchDOMProp(record.node, key, previousValue, nextValue)
        }
    }, {emitCurrent: false})
    record.liveProps.set(key, liveProp)
}

function patchNativeBinding(
    record: ElementRecord,
    key: 'bind:value' | 'bind:checked',
    next: unknown,
): void {
    const property = key.slice(5) as 'value' | 'checked'
    const existing = record.nativeBindings.get(key)
    if (next == null) {
        if (existing) {
            existing.unsubscribe()
            record.node.removeEventListener(existing.eventName, existing.listener)
            record.nativeBindings.delete(key)
            patchDOMProp(record.node, property, existing.value, undefined)
        }
        return
    }
    assertWritableEmitter(next, key)
    if (existing?.source === next) return

    if (existing) {
        existing.unsubscribe()
        record.node.removeEventListener(existing.eventName, existing.listener)
    }
    assertNativeBindingTarget(record.node, property)
    const eventName = nativeBindingEvent(record.node, property)
    const value = next.get()
    patchDOMProp(record.node, property, existing?.value, value)
    const listener: EventListener = () => {
        next.set(Reflect.get(record.node, property), `${key} changed`)
    }
    const binding: NativeBindingRecord = {
        source: next,
        value,
        eventName,
        listener,
        unsubscribe: () => {},
    }
    binding.unsubscribe = next.subscribe(({value: nextValue}) => {
        const previousValue = binding.value
        binding.value = nextValue
        if (!Object.is(previousValue, nextValue)) {
            patchDOMProp(record.node, property, previousValue, nextValue)
        }
    }, {emitCurrent: false})
    record.node.addEventListener(eventName, listener)
    record.nativeBindings.set(key, binding)
}

function patchEvent(record: ElementRecord, key: string, next: unknown): void {
    const eventName = key.slice(2).toLowerCase()
    const registered = record.listeners.get(key)
    if (registered && registered !== next) {
        record.node.removeEventListener(eventName, registered)
        record.listeners.delete(key)
    }
    if (next != null && typeof next !== 'function') {
        throw new TypeError(`${key} must be a function or null`)
    }
    if (typeof next === 'function' && registered !== next) {
        const listener = next as EventListener
        record.node.addEventListener(eventName, listener)
        record.listeners.set(key, listener)
    }
}

function patchRef(record: ElementRecord, next: unknown): void {
    applyRef(record.ref, null)
    if (next != null && typeof next !== 'function' && typeof next !== 'object') {
        throw new TypeError('ref must be a function, object, or null')
    }
    record.ref = next as Ref<HTMLElement> | null
    applyRef(record.ref, record.node)
}

function patchDOMProp(
    node: HTMLElement,
    key: string,
    previous: unknown,
    next: unknown,
): void {
    if (key === 'class' || key === 'className') {
        setAttribute(node, 'class', next)
        return
    }
    if (key === 'for' || key === 'htmlFor') {
        setAttribute(node, 'for', next)
        return
    }
    if (key === 'dataset') {
        patchDataset(node, previous, next)
        return
    }
    if (key === 'style') {
        patchStyle(node, previous, next)
        return
    }
    if (key === 'dangerouslySetInnerHTML') {
        throw new Error('dangerouslySetInnerHTML is not supported')
    }

    const property = normalizePropertyName(key)
    if (BOOLEAN_ATTRIBUTES.has(property)) {
        const enabled = Boolean(next)
        if (property in node) Reflect.set(node, property, enabled)
        node.toggleAttribute(normalizeAttributeName(key), enabled)
        return
    }
    if (PROPERTY_PROPS.has(property) && property in node) {
        const value = next ?? (property === 'value' ? '' : false)
        if (!Object.is(Reflect.get(node, property), value)) Reflect.set(node, property, value)
        if (next == null) node.removeAttribute(normalizeAttributeName(key))
        return
    }

    setAttribute(node, normalizeAttributeName(key), next)
}

function patchDataset(node: HTMLElement, previous: unknown, next: unknown): void {
    const oldValues = toPropertyRecord(previous, 'dataset')
    const newValues = toPropertyRecord(next, 'dataset')
    for (const key of new Set([...Object.keys(oldValues), ...Object.keys(newValues)])) {
        const value = newValues[key]
        if (value == null) delete node.dataset[key]
        else node.dataset[key] = String(value)
    }
}

function patchStyle(node: HTMLElement, previous: unknown, next: unknown): void {
    if (typeof next === 'string') {
        node.style.cssText = next
        return
    }
    const oldValues = typeof previous === 'string'
        ? {}
        : toPropertyRecord(previous, 'style')
    const newValues = toPropertyRecord(next, 'style')
    if (typeof previous === 'string') node.style.cssText = ''
    for (const key of new Set([...Object.keys(oldValues), ...Object.keys(newValues)])) {
        const value = newValues[key]
        if (key.startsWith('--')) {
            if (value == null) node.style.removeProperty(key)
            else node.style.setProperty(key, String(value))
        } else {
            Reflect.set(node.style, key, value == null ? '' : String(value))
        }
    }
}

function toPropertyRecord(value: unknown, label: string): Record<string, unknown> {
    if (value == null) return {}
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${label} must be an object or null`)
    }
    return value as Record<string, unknown>
}

function setAttribute(node: HTMLElement, name: string, value: unknown): void {
    if (value == null || value === false) node.removeAttribute(name)
    else if (value === true) node.setAttribute(name, '')
    else node.setAttribute(name, String(value))
}

function normalizePropertyName(key: string): string {
    if (key === 'readonly') return 'readOnly'
    if (key === 'autofocus') return 'autoFocus'
    return key
}

function normalizeAttributeName(key: string): string {
    if (key === 'className') return 'class'
    if (key === 'htmlFor') return 'for'
    if (/^aria[A-Z]/.test(key)) return camelToKebab(key)
    if (/^data[A-Z]/.test(key)) return camelToKebab(key)
    return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function camelToKebab(value: string): string {
    return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function applyRef<TNode extends Node>(ref: Ref<TNode> | null, value: TNode | null): void {
    if (ref == null) return
    if (typeof ref === 'function') ref(value)
    else ref.current = value
}

function disposeRecord(record: RenderRecord, removeNodes: boolean): void {
    if (record.kind === 'emitter') {
        record.unsubscribe()
        disposeRecord(record.child, false)
        if (removeNodes) {
            for (const node of recordNodes(record)) node.remove()
        }
        return
    }
    if (record.kind === 'component') {
        for (const binding of record.liveProps.values()) binding.unsubscribe()
        record.liveProps.clear()
        record.owner._childComponents.delete(record.instance)
        record.instance.destroy()
        return
    }
    if (record.kind === 'function') {
        for (const binding of record.liveProps.values()) binding.unsubscribe()
        record.liveProps.clear()
        disposeRecord(record.child, removeNodes)
        return
    }
    if (record.kind === 'element') {
        applyRef(record.ref, null)
        for (const [key, listener] of record.listeners) {
            record.node.removeEventListener(key.slice(2).toLowerCase(), listener)
        }
        record.listeners.clear()
        for (const binding of record.liveProps.values()) binding.unsubscribe()
        record.liveProps.clear()
        for (const binding of record.nativeBindings.values()) {
            binding.unsubscribe()
            record.node.removeEventListener(binding.eventName, binding.listener)
        }
        record.nativeBindings.clear()
        for (const child of record.children) disposeRecord(child, false)
        if (removeNodes) record.node.remove()
        return
    }
    if (record.kind === 'fragment') {
        for (const child of record.children) disposeRecord(child, false)
        if (removeNodes) {
            for (const node of recordNodes(record)) node.remove()
        }
        return
    }
    if (removeNodes) record.node.remove()
}

function insertRecord(parent: ParentNode, record: RenderRecord | null, before: Node | null = null): void {
    if (record == null) return
    for (const node of recordNodes(record)) parent.insertBefore(node, before)
}

function recordNodes(record: RenderRecord | null): ChildNode[] {
    if (record == null) return []
    if (record.kind === 'text' || record.kind === 'element') return [record.node]
    if (record.kind === 'component') return recordNodes(record.instance._rendered)
    if (record.kind === 'function') return recordNodes(record.child)

    const nodes: ChildNode[] = []
    let node: ChildNode | null = record.start
    while (node) {
        nodes.push(node)
        if (node === record.end) break
        node = node.nextSibling
    }
    return nodes
}

function firstNode(record: RenderRecord | null): ChildNode | null {
    return recordNodes(record)[0] ?? null
}

function valueKey(value: NormalizedChild): Key | null {
    if (value instanceof Component) return readKey(value.props)
    return isVNode(value) ? value.key : null
}

function readKey(props: ComponentProps): Key | null {
    const key = props.key
    return typeof key === 'string' || typeof key === 'number' ? key : null
}

function isCompatible(record: RenderRecord, value: NormalizedChild): boolean {
    if (record.kind === 'text') {
        return typeof value === 'string' || typeof value === 'number'
    }
    if (record.kind === 'emitter') {
        return isReadableEmitter(value) && record.source === value
    }
    if (record.kind === 'component') {
        if (value instanceof Component) return record.instance === value
        return isVNode(value)
            && isComponentClass(value.type)
            && record.type === value.type
            && record.key === valueKey(value)
    }
    if (record.kind === 'function') {
        return isVNode(value)
            && record.type === value.type
            && record.key === valueKey(value)
    }
    if (record.kind === 'fragment') {
        return isVNode(value)
            && value.type === Fragment
            && record.key === valueKey(value)
    }
    return isVNode(value)
        && typeof value.type === 'string'
        && record.type === value.type
        && record.key === valueKey(value)
}

export function isVNode(value: unknown): value is VNode {
    return value != null
        && typeof value === 'object'
        && Object.hasOwn(value, 'type')
}

function isComponentClass(value: unknown): value is AnyComponentConstructor {
    return typeof value === 'function'
        && (value === Component || value.prototype instanceof Component)
}

function isEventProp(key: string): boolean {
    return /^on[A-Z]/.test(key)
}

function isNativeBindingProp(key: string): key is 'bind:value' | 'bind:checked' {
    return key === 'bind:value' || key === 'bind:checked'
}

function isLiveBinding(value: unknown): value is LiveBinding<unknown> {
    return value != null
        && typeof value === 'object'
        && liveBindingValues.has(value)
}

function isReadableEmitter(value: unknown): value is ReadableEmitter<FrayChild, unknown> {
    if ((typeof value !== 'object' || value == null) && typeof value !== 'function') return false
    return typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'getFetchState') === 'function'
        && typeof Reflect.get(value, 'getError') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}

function assertReadableEmitter(
    value: unknown,
    label: string,
): asserts value is ReadableEmitter<unknown, unknown> {
    if (!isReadableEmitter(value)) throw new TypeError(`${label} requires a readable emitter`)
}

function assertWritableEmitter(
    value: unknown,
    label: string,
): asserts value is WritableEmitter<unknown, unknown> {
    assertReadableEmitter(value, label)
    if (typeof Reflect.get(value, 'set') !== 'function') {
        throw new TypeError(`${label} requires a writable emitter`)
    }
}

function assertNativeBindingTarget(
    node: HTMLElement,
    property: 'value' | 'checked',
): void {
    const tagName = node.localName
    const valid = property === 'checked'
        ? tagName === 'input'
        : tagName === 'input' || tagName === 'textarea' || tagName === 'select'
    if (!valid) throw new TypeError(`bind:${property} is not supported on ${tagName}`)
}

function nativeBindingEvent(
    node: HTMLElement,
    property: 'value' | 'checked',
): 'input' | 'change' {
    return property === 'value' && node.localName !== 'select' ? 'input' : 'change'
}

function assertParentNode(value: unknown): asserts value is ParentNode {
    if (value == null
        || (typeof value !== 'object' && typeof value !== 'function')
        || typeof Reflect.get(value, 'insertBefore') !== 'function') {
        throw new TypeError('Component parent must be a DOM ParentNode')
    }
}

function describeValue(value: unknown): string {
    try {
        return String(value)
    } catch {
        return Object.prototype.toString.call(value)
    }
}

function normalizeBaseStyles(value: unknown): Array<[string, BaseStyleNames]> {
    if (value == null) return []
    if (Array.isArray(value)) {
        return value.map((entry) => {
            if (!Array.isArray(entry) || entry.length < 2 || typeof entry[0] !== 'string') {
                throw new TypeError('Component baseStyles entries must be selector/style tuples')
            }
            const names = entry[1]
            if (typeof names !== 'string'
                && (!Array.isArray(names) || names.some((name) => typeof name !== 'string'))) {
                throw new TypeError('Component base style names must be strings')
            }
            return [entry[0], names as BaseStyleNames]
        })
    }
    if (typeof value !== 'object') {
        throw new TypeError('Component baseStyles must be an object or tuple array')
    }
    return Object.entries(value).map(([selector, names]) => [
        selector,
        names as BaseStyleNames,
    ])
}
