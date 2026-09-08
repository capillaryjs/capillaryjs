import {Component, css, isVNode} from '../../component.js'
import type {ComponentProps, FrayChild, Key} from '../../component.js'
import {
    componentClass,
    controlId,
    createValueEmitter,
} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'
import {
    RoutedSelectionController,
    readContentMountPolicy,
} from '../routedSelection.js'
import type {
    ContentMountPolicy,
    RoutedSelectionItem,
} from '../routedSelection.js'
import {Tab} from './tab.js'
import type {TabProps} from './tab.js'
import {TabLine, tabButtonId, tabPanelId} from './tabline.js'
import type {TabLineTab} from './tabline.js'
import {RouteScope} from '../../../routing/RouteScope.js'
import type {LiteralRouteDescriptor} from '../../../routing/route.js'

export interface TabDefinition {
    id: Key
    label?: FrayChild
    disabled?: boolean
    content?: FrayChild
    component?: FrayChild
    route?: LiteralRouteDescriptor
}

export type TabPanelMountPolicy = ContentMountPolicy

export interface TabPanelProps extends ValueControlProps<Key | null> {
    id?: string | number | null
    tabs?: readonly TabDefinition[]
    activeTabEmitter?: ValueEmitter<Key | null>
    initialActiveTabId?: Key | null
    /** Controls when tab content is mounted and whether inactive content is retained. */
    mountPolicy?: TabPanelMountPolicy
    label?: string
    onChange?: (value: Key, event: Event | null) => void
}

interface NormalizedTab extends RoutedSelectionItem {
    id: Key
    label: FrayChild
    disabled: boolean
    content: FrayChild
    route?: LiteralRouteDescriptor
}

export class TabPanel extends Component<TabPanelProps> {
    static override liveProps: readonly string[] = []
    readonly valueEmitter: ValueEmitter<Key | null>
    readonly activeTabEmitter: ValueEmitter<Key | null>
    readonly baseId: string
    private readonly selection: RoutedSelectionController<NormalizedTab>

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
        this.selection = new RoutedSelectionController(this, this.valueEmitter, {
            subject: 'tabs',
            restoredCause: 'route tab restored',
            pendingCause: 'pending route tab selected',
            selectedCause: 'tab selected',
        })
    }

    initialize(): void {
        const tabs = extractTabs(this.props)
        readContentMountPolicy(this.props.mountPolicy, 'TabPanel')
        this.selection.prepare(tabs)
        this.watch(this.valueEmitter)
    }

    setProps(nextProps: TabPanelProps): this {
        readContentMountPolicy(nextProps.mountPolicy, 'TabPanel')
        super.setProps(nextProps)
        this.selection.prepare(extractTabs(nextProps))
        this.update()
        return this
    }

    render(): FrayChild {
        const tabs = extractTabs(this.props)
        const mountPolicy = readContentMountPolicy(this.props.mountPolicy, 'TabPanel')
        const selectedId = this.selection.selected(tabs)?.id
        const mountedTabIds = this.selection.updateMounted(tabs, mountPolicy)
        const Host = this.Host
        return <Host
            id={this.baseId}
            className={componentClass(this.props) || null}
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
            {tabs.map((tab) => {
                const selected = Object.is(selectedId, tab.id)
                return <section
                    key={String(tab.id)}
                    id={tabPanelId(this.baseId, tab.id)}
                    role="tabpanel"
                    aria-labelledby={tabButtonId(this.baseId, tab.id)}
                    tabIndex={selected ? 0 : -1}
                    hidden={!selected}
                >{mountedTabIds.has(tab.id)
                        ? this.selection.scopedContent(tab, tab.content)
                        : null}</section>
            })}
        </Host>
    }

    override onDestroy(): void {
        this.selection.dispose()
    }

    private selectTab(tab: TabLineTab, _event: Event | null): void {
        const selected = extractTabs(this.props).find(({id}) => Object.is(id, tab.id))
        if (selected != null) this.selection.select(selected)
    }

    static dependencies = [RouteScope, TabLine, Tab]

    static override hostName = 'tab-panel'

    static css = css`
        & {
            background: var(--panel-background);
            border-radius: var(--panel-radius);
            box-shadow: var(--panel-shadow);
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }

        & > section[role="tabpanel"] {
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow: auto;
            padding: 3px;
            z-index: 2;
        }

        & > section[role="tabpanel"][hidden] {
            display: none;
        }

        & > section[role="tabpanel"] > fray-toolbar[role="toolbar"]:first-child {
            width: calc(100% + 6px);
            margin-block-start: -3px;
            margin-inline-start: -3px;
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
