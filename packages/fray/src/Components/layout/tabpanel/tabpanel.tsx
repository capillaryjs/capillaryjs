import {Component, css, isVNode} from '../../component.js'
import type {ComponentProps, FrayChild, Key} from '../../component.js'
import {
    classNames,
    componentClass,
    controlId,
    createValueEmitter,
} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import {Tab} from './tab.js'
import type {TabProps} from './tab.js'
import {TabLine, tabButtonId, tabPanelId} from './tabline.js'
import type {TabLineTab} from './tabline.js'
import {RouteScope} from '../../../routing/RouteScope.js'
import type {LiteralRouteDescriptor} from '../../../routing/route.js'
import type {ResolvedRoute} from '../../../routing/router.js'

export interface TabDefinition {
    id: Key
    label?: FrayChild
    disabled?: boolean
    content?: FrayChild
    component?: FrayChild
    route?: LiteralRouteDescriptor
}

export interface TabPanelProps extends ValueControlProps<Key | null> {
    id?: string | number | null
    tabs?: readonly TabDefinition[]
    activeTabEmitter?: ValueEmitter<Key | null>
    initialActiveTabId?: Key | null
    label?: string
    onChange?: (value: Key, event: Event | null) => void
}

interface NormalizedTab {
    id: Key
    label: FrayChild
    disabled: boolean
    content: FrayChild
    route?: LiteralRouteDescriptor
}

export class TabPanel extends Component<TabPanelProps> {
    readonly valueEmitter: ValueEmitter<Key | null>
    readonly activeTabEmitter: ValueEmitter<Key | null>
    readonly baseId: string
    private routeContexts = new Map<LiteralRouteDescriptor, ResolvedRoute>()

    constructor(props: TabPanelProps = {}) {
        super(props)
        const tabs = extractTabs(props)
        const emitterProps: TabPanelProps = {...props}
        if (emitterProps.valueEmitter == null && props.activeTabEmitter != null) {
            emitterProps.valueEmitter = props.activeTabEmitter
        }
        if (emitterProps.defaultValue == null && props.initialActiveTabId != null) {
            emitterProps.defaultValue = props.initialActiveTabId
        }
        this.valueEmitter = createValueEmitter<Key | null>(
            this,
            emitterProps,
            tabs.find((tab) => !tab.disabled)?.id ?? null,
            'active tab',
        )
        this.activeTabEmitter = this.valueEmitter
        this.baseId = controlId('tabs', props.id)
    }

    initialize(): void {
        const tabs = extractTabs(this.props)
        if (!tabs.some(({id}) => Object.is(id, this.valueEmitter.get()))) {
            this.valueEmitter.set(tabs.find((tab) => !tab.disabled)?.id ?? null)
        }
        this.registerRoutes(tabs)
        this.watch(this.valueEmitter)
    }

    setProps(nextProps: TabPanelProps): this {
        super.setProps(nextProps)
        const tabs = extractTabs(nextProps)
        if (!tabs.some(({id}) => Object.is(id, this.valueEmitter.get()))) {
            this.valueEmitter.set(tabs.find((tab) => !tab.disabled)?.id ?? null)
        }
        this.registerRoutes(tabs)
        return this
    }

    render(): FrayChild {
        const tabs = extractTabs(this.props)
        const selected = tabs.find(({id}) => Object.is(id, this.valueEmitter.get()))
            ?? tabs.find((tab) => !tab.disabled)
            ?? null
        const Host = this.Host
        return <Host
            id={this.baseId}
            className={classNames('panellike', componentClass(this.props))}
        >
            <TabLine
                key="tab-list"
                tabs={tabs.map(({id, label, disabled}) => ({id, label, disabled}))}
                valueEmitter={this.valueEmitter}
                baseId={this.baseId}
                {...(this.props.label == null ? {} : {label: this.props.label})}
                {...(this.props.onChange == null ? {} : {onChange: this.props.onChange})}
                onSelectTab={(tab, event) => this.selectTab(tab, event)}
            />
            {selected == null ? null : <div
                key={String(selected.id)}
                id={tabPanelId(this.baseId, selected.id)}
                role="tabpanel"
                data-part="content"
                aria-labelledby={tabButtonId(this.baseId, selected.id)}
                tabIndex={0}
            >{this.routedContent(selected)}</div>}
        </Host>
    }

    override onDestroy(): void {
        this._runtime.router?.unregisterRoutes(this._routeContext ?? this._runtime.router.root, this)
        this.routeContexts.clear()
    }

    private registerRoutes(tabs: readonly NormalizedTab[]): void {
        const routed = tabs.filter((tab): tab is NormalizedTab & {
            route: LiteralRouteDescriptor
        } => tab.route != null)
        const router = this._runtime.router
        const parent = this._routeContext
        if (router != null && parent != null) router.unregisterRoutes(parent, this)
        this.routeContexts.clear()
        if (routed.length === 0) return
        if (router == null || parent == null) {
            throw new Error('Routed tabs require a router and contextual route scope')
        }
        this.routeContexts = new Map(router.registerSelectionRoutes(
            parent,
            this,
            routed.map((tab) => ({
                route: tab.route,
                disabled: tab.disabled,
                active: () => Object.is(this.valueEmitter.get(), tab.id),
                activate: () => {
                    this.valueEmitter.set(tab.id, 'route tab restored')
                },
            })),
            (listener) => this.valueEmitter.subscribe(listener, {emitCurrent: false}),
        ))
    }

    private selectTab(tab: TabLineTab, _event: Event | null): void {
        const selected = extractTabs(this.props).find(({id}) => Object.is(id, tab.id))
        const context = selected?.route == null ? null : this.routeContexts.get(selected.route)
        if (context == null) {
            this.valueEmitter.set(tab.id, 'tab selected')
        } else {
            void this._runtime.router?.navigate(context)
        }
    }

    private routedContent(tab: NormalizedTab): FrayChild {
        const context = tab.route == null ? null : this.routeContexts.get(tab.route)
        return context == null
            ? tab.content
            : <RouteScope key={context.pathname} context={context}>{tab.content}</RouteScope>
    }

    static dependencies = [RouteScope, TabLine, Tab]

    static override hostName = 'tab-panel'
    static override standaloneHostName = 'tab-panel'

    static css = css`
        & {
            display: flex;
            flex-direction: column;
            width: 100%;
            min-height: 0;
            overflow: hidden;
        }

        & > [data-part="content"] {
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow: auto;
        }
    `
}

function extractTabs(props: TabPanelProps): NormalizedTab[] {
    const direct = props.tabs ?? []
    if (!Array.isArray(direct)) throw new TypeError('TabPanel tabs must be an array')
    const children = Array.isArray(props.children)
        ? props.children
        : props.children == null ? [] : [props.children]
    const declarative: NormalizedTab[] = children
        .filter((child) => isVNode(child) && child.type === Tab)
        .map((child, index) => {
            if (!isVNode(child)) throw new TypeError('TabPanel children must be Tab nodes')
            // The preceding vnode type check identifies the declarative Tab;
            // its public constructor contract supplies the corresponding props.
            const tabProps = child.props as TabProps
            return {
                id: tabProps.id ?? `tab-${index + 1}`,
                label: tabProps.label ?? `Tab ${index + 1}`,
                disabled: Boolean(tabProps.disabled),
                content: tabProps.children ?? [],
                ...(tabProps.route == null ? {} : {route: tabProps.route}),
            }
        })
    const tabs: NormalizedTab[] = direct.length > 0
        ? direct.map((tab: TabDefinition) => ({
            ...tab,
            label: tab.label ?? String(tab.id),
            disabled: Boolean(tab.disabled),
            content: tab.content ?? tab.component ?? [],
            ...(tab.route == null ? {} : {route: tab.route}),
        }))
        : declarative
    const ids = new Set<Key>()
    for (const tab of tabs) {
        if (tab?.id == null) throw new TypeError('Each tab requires an id')
        if (ids.has(tab.id)) throw new Error(`Duplicate tab id: ${String(tab.id)}`)
        ids.add(tab.id)
    }
    return tabs
}
