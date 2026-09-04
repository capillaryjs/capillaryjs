import {Component, css} from '../../component.js'
import type {ComponentProps, FrayChild, Key} from '../../component.js'
import {
    componentClass,
    createValueEmitter,
    invoke,
} from '../../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../../controlUtils.js'

export interface TabLineTab {
    id: Key
    label?: FrayChild
    disabled?: boolean
}

export interface TabLineProps extends ValueControlProps<Key | null> {
    tabs?: readonly TabLineTab[]
    activeTabEmitter?: ValueEmitter<Key | null>
    initialActiveTabId?: Key | null
    label?: string
    baseId?: string
    onChange?: (value: Key, event: Event | null) => void
    /** @internal Lets TabPanel route activation before changing the value. */
    onSelectTab?: (tab: TabLineTab, event: Event | null) => void
}

export class TabLine extends Component<TabLineProps> {
    static override liveProps: readonly string[] = []
    readonly valueEmitter: ValueEmitter<Key | null>
    readonly activeTabEmitter: ValueEmitter<Key | null>

    constructor(props: TabLineProps = {}) {
        super(props)
        const tabs = props.tabs ?? []
        validateTabs(tabs)
        const emitterProps: TabLineProps = {...props}
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
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    selectTab(tab: TabLineTab | undefined, event: Event | null = null): void {
        if (tab == null || tab.disabled) return
        if (this.props.onSelectTab == null) {
            this.valueEmitter.set(tab.id, 'tab selected')
        } else {
            this.props.onSelectTab(tab, event)
        }
        invoke(this.props.onChange, tab.id, event)
    }

    render(): FrayChild {
        const {tabs = [], label = 'Sections', baseId = 'fray-tabs'} = this.props
        validateTabs(tabs)
        const activeTabId = this.valueEmitter.get()

        const Host = this.Host
        return <Host
            role="tablist"
            className={componentClass(this.props) || null}
            aria-label={label}
        >
            {tabs.map((tab, index) => <button
                key={String(tab.id)}
                id={tabButtonId(baseId, tab.id)}
                type="button"
                role="tab"
                disabled={Boolean(tab.disabled)}
                aria-selected={Object.is(activeTabId, tab.id) ? 'true' : 'false'}
                aria-controls={tabPanelId(baseId, tab.id)}
                tabIndex={Object.is(activeTabId, tab.id) ? 0 : -1}
                onClick={(event: MouseEvent) => this.selectTab(tab, event)}
                onKeyDown={(event: KeyboardEvent) => this.handleKeyDown(event, index, tabs)}
            >{tab.label ?? String(tab.id)}</button>)}
        </Host>
    }

    handleKeyDown(event: KeyboardEvent, index: number, tabs: readonly TabLineTab[]): void {
        const enabled = tabs
            .map((tab, tabIndex) => ({tab, tabIndex}))
            .filter(({tab}) => !tab.disabled)
        if (enabled.length === 0) return
        const current = Math.max(0,
            enabled.findIndex(({tabIndex}) => tabIndex === index))
        let next: {tab: TabLineTab; tabIndex: number} | undefined
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            next = enabled[(current + 1) % enabled.length]
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            next = enabled[(current - 1 + enabled.length) % enabled.length]
        } else if (event.key === 'Home') next = enabled[0]
        else if (event.key === 'End') next = enabled.at(-1)
        else return

        if (next == null) return
        event.preventDefault()
        this.selectTab(next.tab, event)
        if (this.dom instanceof Element) {
            const tab = this.dom.querySelectorAll<HTMLElement>('[role="tab"]')[next.tabIndex]
            tab?.focus()
        }
    }

    static override hostName = 'tab-line'
    static override standaloneHostName = 'tab-line'

    static baseStyles = [
        ['& > button[role="tab"]', ['uiline', 'button']],
    ]

    static css = css`
        & {
            display: flex;
            flex-flow: row wrap;
            padding-top: 3px;
        }
    `
}

export function tabButtonId(baseId: string, id: Key): string {
    return `${baseId}-tab-${safeId(id)}`
}

export function tabPanelId(baseId: string, id: Key): string {
    return `${baseId}-panel-${safeId(id)}`
}

function safeId(value: Key): string {
    return encodeURIComponent(String(value)).replaceAll('%', '-')
}

function validateTabs(tabs: unknown): asserts tabs is readonly TabLineTab[] {
    if (!Array.isArray(tabs)) throw new TypeError('TabLine tabs must be an array')
    const ids = new Set<Key>()
    for (const tab of tabs) {
        if (tab == null || tab.id == null) throw new TypeError('Each tab requires an id')
        if (ids.has(tab.id)) throw new Error(`Duplicate tab id: ${String(tab.id)}`)
        ids.add(tab.id)
    }
}
