import {Emitter, FetchState} from '@capillaryjs/capillary'
import {
    Button,
    Checkbox,
    Component,
    DatePicker,
    DateTimePicker,
    DescriptionItem,
    DescriptionList,
    DataTable,
    Dialog,
    DialogActions,
    Dropdown,
    FilterMode,
    Fragment,
    GroupBox,
    Layout,
    ListView,
    NavigationBar,
    Panel,
    ProgressBar,
    RouteOutlet,
    Sidebar,
    SidebarToolbar,
    SplitPrimary,
    SplitSecondary,
    SplitView,
    Tab,
    TabPanel,
    Textbox,
    TimePicker,
    Toggle,
    Toolbar,
    TreeView,
    createBrowserRouter,
    createCapillaryUiRuntime,
    createHistoryNavigation,
    defineRoute,
    h,
    live,
    routeTarget,
    styleRegistry,
} from '../../src/index.js'
import type {LocalDateTime} from '../../src/index.js'
import {jsx} from '../../src/jsx-runtime.js'

const fixtureOptions = new URLSearchParams(location.search)

if (fixtureOptions.get('fontScale') === '200') {
    document.documentElement.style.setProperty('--base-font-size', '28px')
    document.documentElement.style.setProperty('--ui-font-size', '28px')
}

const inputValue = new Emitter('hello')
class InputProbe extends Component {
    initialize() {
        this.watch(inputValue)
    }
    render() {
        return h('input', {
            'aria-label': 'Message',
            value: inputValue.get(),
            onInput: (event: Event) => inputValue.set(
                (event.currentTarget as HTMLInputElement).value,
            ),
        })
    }
}
const inputProbe = InputProbe.new().attachTo(requiredElement('#input-root'))
const originalInput = inputProbe.dom

const revision = new Emitter(0)
let clicks = 0
class EventProbe extends Component {
    initialize() {
        this.watch(revision)
    }
    render() {
        const renderedRevision = revision.get()
        return h('button', {
            id: 'event-action',
            onClick: () => {
                if (renderedRevision !== revision.get()) throw new Error('stale handler')
                clicks += 1
            },
        }, 'Act')
    }
}
EventProbe.new().attachTo(requiredElement('#event-root'))

const booleanState = new Emitter(true)
class BooleanProbe extends Component {
    initialize() {
        this.watch(booleanState)
    }
    render() {
        return h('input', {
            id: 'boolean-input',
            type: 'checkbox',
            'aria-label': 'Boolean state',
            checked: booleanState.get(),
            disabled: booleanState.get(),
            required: booleanState.get(),
        })
    }
}
BooleanProbe.new().attachTo(requiredElement('#boolean-root'))

const order = new Emitter(['a', 'b', 'c'])
class KeyedProbe extends Component {
    initialize() {
        this.watch(order)
    }
    render() {
        return h('ol', {id: 'keyed-list'}, order.get().map((key) =>
            h('li', {key, 'data-key': key}, key)))
    }
}
KeyedProbe.new().attachTo(requiredElement('#keyed-root'))
const originalKeyedNodes = new Map(
    [...document.querySelectorAll<HTMLElement>('#keyed-list li')]
        .map((node) => [node.dataset.key, node] as const),
)

const visible = new Emitter(true)
const childSource = new Emitter('child')
const lifecycleCounts = {initialize: 0, destroy: 0}
class ChildProbe extends Component {
    initialize() {
        lifecycleCounts.initialize += 1
        this.watch(childSource)
    }
    render() {
        return h('span', {id: 'child-probe'}, childSource.get())
    }
    onDestroy() {
        lifecycleCounts.destroy += 1
    }
}
class ParentProbe extends Component {
    initialize() {
        this.watch(visible)
    }
    render() {
        return h('section', null, visible.get()
            ? h(ChildProbe, {key: 'child'})
            : h('em', null, 'hidden'))
    }
}
const parentProbe = ParentProbe.new().attachTo(requiredElement('#lifecycle-root'))

class FormsProbe extends Component {
    render() {
        return h(Fragment, null,
            'prefix',
            7,
            [h('span', {id: 'h-form'}, 'same')],
            jsx('span', {id: 'jsx-form', children: 'same'}),
            false,
            null)
    }
}
FormsProbe.new().attachTo(requiredElement('#forms-root'))

Button.registerStyles()
Checkbox.registerStyles()
DatePicker.registerStyles()
DateTimePicker.registerStyles()
Dropdown.registerStyles()
DescriptionList.registerStyles()
GroupBox.registerStyles()
Layout.registerStyles()
ListView.registerStyles()
Dialog.registerStyles()
DataTable.registerStyles()
Panel.registerStyles()
ProgressBar.registerStyles()
Sidebar.registerStyles()
SplitView.registerStyles()
TabPanel.registerStyles()
Textbox.registerStyles()
TimePicker.registerStyles()
Toggle.registerStyles()
Toolbar.registerStyles()
TreeView.registerStyles()
styleRegistry.injectAll(document)

Panel.new({
    id: 'accessible-controls',
    header: 'Accessible controls',
    children: [
        h(Toolbar, {label: 'Editor actions'}, h(Button, {label: 'Save'})),
        h(Textbox, {label: 'Name', defaultValue: 'Ada', required: true}),
        h(Dropdown, {
            label: 'Role',
            options: [
                {value: 'author', label: 'Author'},
                {value: 'reviewer', label: 'Reviewer'},
            ],
        }),
        h(Toggle, {
            label: 'View',
            options: [['list', 'List'], ['grid', 'Grid']],
        }),
        h(Checkbox, {label: 'Include archived'}),
        h(TabPanel, {
            label: 'Profile sections',
            children: [
                h(Tab, {id: 'summary', label: 'Summary'}, 'Summary content'),
                h(Tab, {id: 'details', label: 'Details'}, 'Details content'),
            ],
        }),
    ],
}).attachTo(requiredElement('#accessibility-root'))

Sidebar.new({
    id: 'browser-sidebar',
    className: 'browser-sidebar',
    header: 'Scrollable requests',
    children: [
        h(SidebarToolbar, null,
            h(Toolbar, {label: 'Request actions'}, h(Button, {label: 'Refresh requests'}))),
        h('ol', null, Array.from({length: 40}, (_unused, index) =>
            h('li', {key: index}, `Change request ${index + 1}`))),
    ],
}).attachTo(requiredElement('#sidebar-root'))

let destroyRouting = () => 0
if (fixtureOptions.get('routing') === 'true') {
    const firstRoute = defineRoute('browser-first')
    const secondRoute = defineRoute('browser-second')
    const activeRoute = new Emitter('first')
    const router = createBrowserRouter({adapter: createHistoryNavigation(window)})
    const runtime = createCapillaryUiRuntime({router})
    class RoutingProbe extends Component {
        render() {
            return h(Fragment, null,
                h(NavigationBar, {
                    label: 'Browser routes',
                    items: [
                        {id: 'first', label: 'First route', to: routeTarget(firstRoute)},
                        {id: 'second', label: 'Second route', to: routeTarget(secondRoute)},
                    ],
                }),
                h(RouteOutlet, {
                    id: 'browser-routing',
                    mountPolicy: 'active-only',
                    valueEmitter: activeRoute,
                    views: [
                        {id: 'first', route: firstRoute, content: 'First page'},
                        {id: 'second', route: secondRoute, content: 'Second page'},
                    ],
                }),
            )
        }

        static dependencies = [NavigationBar, RouteOutlet]
    }
    const routedNavigation = runtime.mount(
        runtime.create(RoutingProbe),
        requiredElement('#routing-root'),
    )
    destroyRouting = () => {
        routedNavigation.destroy()
        router.dispose()
        return activeRoute.subscriberCount
    }
}

const primitiveProgress = new Emitter<number | null>(null)
const primitiveTreeSelection = new Emitter<string | number | null>(null)
const primitiveTreeExpansion = new Emitter<Array<string | number>>([])
const primitiveDialogOpen = new Emitter(false)
Panel.new({
    id: 'record-primitives',
    header: 'Record-view primitives',
    children: [
        h(DescriptionList, {label: 'Record summary'}, [
            h(DescriptionItem, {term: 'Severity', value: 'High'}),
            h(DescriptionItem, {term: 'Owner', value: 'Example team'}),
        ]),
        h(SplitView, {
            primaryLabel: 'Project navigation',
            secondaryLabel: 'Refresh status',
        }, [
            h(SplitPrimary, null, h(TreeView, {
                    label: 'Security projects',
                    nodes: [{
                        id: 'workspace',
                        label: 'Workspace',
                        children: [{id: 'service-alpha', label: 'Service Alpha'}],
                    }, {id: 'tools', label: 'Tools'}],
                    selectedKeyEmitter: primitiveTreeSelection,
                    expandedKeysEmitter: primitiveTreeExpansion,
                })),
            h(SplitSecondary, null, h(ProgressBar, {
                    label: 'Projects processed',
                    valueEmitter: primitiveProgress,
                    max: 4,
                })),
        ]),
        h(Button, {label: 'Refresh', busy: true, busyLabel: 'Refreshing…'}),
        h(Button, {
            label: 'Open reset dialog',
            onClick: () => primitiveDialogOpen.set(true),
        }),
        h(Dialog, {
            title: 'Reset scenario?',
            description: 'Restore deterministic fixture data.',
            valueEmitter: primitiveDialogOpen,
            closeLabel: 'Keep data',
        }, [
            'No durable records are changed.',
            h(DialogActions, null, h(Button, {
                label: 'Confirm reset',
                onClick: () => primitiveDialogOpen.set(false),
            })),
        ]),
    ],
}).attachTo(requiredElement('#record-primitives-root'))

const panelReviewDisabled = new Emitter(false)
class PanelReviewProbe extends Component {
    render() {
        return h(Panel, {
            id: 'panel-review-probe',
            header: 'Panel review probe',
            disabled: live(panelReviewDisabled),
            children: 'Static review content',
        })
    }
}
PanelReviewProbe.new().attachTo(requiredElement('#panel-review-root'))

const datetimeValue = new Emitter<LocalDateTime | null>(null)
DateTimePicker.new({
    label: 'Schedule',
    valueEmitter: datetimeValue,
    min: '2026-01-01T00:00',
    max: '2026-12-31T23:59',
}).attachTo(requiredElement('#datetime-root'))

interface ScrollPriorityRow {
    [field: string]: unknown
    id: string
    label: string
    name: string
}

const scrollPriorityRows: readonly ScrollPriorityRow[] = Array.from({length: 40}, (_, index) => ({
    id: `row-${index + 1}`,
    label: `Row ${index + 1}`,
    name: `Record ${index + 1}`,
}))

Layout.new({
    id: 'data-scroll-priority',
    vertical: true,
    scroll: true,
    children: [
        h(DataTable, {
            data: scrollPriorityRows,
            rowKey: 'id',
            columns: [{field: 'name', label: 'Name'}],
        }),
        h(ListView, {
            items: scrollPriorityRows,
            itemKey: 'id',
            label: 'Scrollable records',
        }),
        h(TreeView, {
            nodes: scrollPriorityRows,
            label: 'Scrollable hierarchy',
        }),
    ],
}).attachTo(requiredElement('#data-scroll-priority-root'))

if (fixtureOptions.get('status') === 'true') {
    interface StatusRow {
        [field: string]: unknown
        id: string
        name: string
        label: string
    }

    const statusRows: readonly StatusRow[] = [
        {id: 'runtime', name: 'Runtime', label: 'Runtime'},
        {id: 'controls', name: 'Controls', label: 'Controls'},
    ]
    const initialStatusRows = new Emitter<readonly StatusRow[], Error>([], {
        fetchState: FetchState.Initial,
    })
    const retainedStatusRows = new Emitter<readonly StatusRow[], Error>(statusRows, {
        fetchState: FetchState.Loading,
    })
    const errorStatusRows = new Emitter<readonly StatusRow[], Error>(statusRows, {
        fetchState: FetchState.Error,
        error: new Error('Status data unavailable'),
    })
    const busyProgress = new Emitter<number | null>(null, {
        fetchState: FetchState.Loading,
    })

    Panel.new({
        id: 'status-form',
        header: 'Status presentation',
        context: 'form',
        children: [
            h('section', {className: 'busy-controls', 'aria-label': 'Busy controls'}, [
                h(Button, {label: 'Busy action', busy: true}),
                h(Button, {label: 'Normal action'}),
                h(Textbox, {label: 'Busy text', busy: true}),
                h(Dropdown, {
                    label: 'Busy select',
                    busy: true,
                    options: [{value: 'one', label: 'One'}],
                }),
                h(Checkbox, {label: 'Busy check', busy: true}),
                h(ProgressBar, {label: 'Busy progress', valueEmitter: busyProgress}),
                h(ProgressBar, {label: 'Idle progress', value: null}),
            ]),
            h('section', {className: 'error-controls', 'aria-label': 'Error controls'}, [
                h(Button, {label: 'Failed action', error: 'Action failed'}),
                h(Textbox, {label: 'Invalid text', error: 'Enter a valid value'}),
                h(Dropdown, {
                    label: 'Invalid select',
                    error: 'Choose an available value',
                    options: [{value: 'one', label: 'One'}],
                }),
                h(Checkbox, {label: 'Invalid check', error: 'Confirm this value'}),
            ]),
            h('section', {className: 'initial-data', 'aria-label': 'Initial data'}, [
                h(DataTable, {
                    data: initialStatusRows,
                    columns: [{field: 'name', label: 'Name'}],
                    placeholderCount: 2,
                }),
                h(ListView, {
                    items: initialStatusRows,
                    itemKey: 'id',
                    label: 'Initial list',
                    placeholderCount: 2,
                }),
                h(TreeView, {
                    nodes: initialStatusRows,
                    label: 'Initial tree',
                    placeholderCount: 2,
                }),
            ]),
            h('section', {className: 'retained-data', 'aria-label': 'Refreshing data'}, [
                h(DataTable, {
                    data: retainedStatusRows,
                    columns: [{field: 'name', label: 'Name'}],
                }),
                h(ListView, {
                    items: retainedStatusRows,
                    itemKey: 'id',
                    label: 'Refreshing list',
                }),
                h(TreeView, {
                    nodes: retainedStatusRows,
                    label: 'Refreshing tree',
                }),
            ]),
            h('section', {className: 'error-data', 'aria-label': 'Failed data'}, [
                h(DataTable, {
                    data: errorStatusRows,
                    columns: [{field: 'name', label: 'Name'}],
                }),
                h(ListView, {
                    items: errorStatusRows,
                    itemKey: 'id',
                    label: 'Failed list',
                }),
                h(TreeView, {
                    nodes: errorStatusRows,
                    label: 'Failed tree',
                }),
            ]),
        ],
    }).attachTo(requiredElement('#status-root'))

    Layout.new({
        vertical: true,
        context: 'control',
        className: 'compact-error',
        children: h(Textbox, {label: 'Compact invalid', error: 'Compact error details'}),
    }).attachTo(requiredElement('#status-root'))
}

globalThis.capillaryUiTest = {
    setRevision(value) {
        revision.set(value)
    },
    get clicks() {
        return clicks
    },
    get inputNodePreserved() {
        return inputProbe.dom === originalInput
    },
    setBoolean(value) {
        booleanState.set(value)
    },
    reorder(keys) {
        order.set(keys)
    },
    keyedNodesPreserved() {
        return [...document.querySelectorAll<HTMLElement>('#keyed-list li')].every((node) =>
            originalKeyedNodes.get(node.dataset.key) === node)
    },
    hideChild() {
        visible.set(false)
    },
    destroyParentTwice() {
        parentProbe.destroy()
        parentProbe.destroy()
    },
    get lifecycleCounts() {
        return {...lifecycleCounts}
    },
    get childSubscribers() {
        return childSource.subscriberCount
    },
    setProgress(value) {
        primitiveProgress.set(value)
    },
    setPanelReviewDisabled(value) {
        panelReviewDisabled.set(value)
    },
    destroyRouting() {
        return destroyRouting()
    },
    measureDataTable(rowCount) {
        return measureDataTable(rowCount)
    },
    get datetime() {
        return datetimeValue.get()
    },
}

globalThis.capillaryUiTestReady = true

function requiredElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector)
    if (element == null) throw new Error(`Missing browser fixture element: ${selector}`)
    return element
}

interface BenchmarkRow {
    [field: string]: unknown
    id: number
    name: string
    group: 'even' | 'odd'
    score: number
}

function measureDataTable(rowCount: number): DataTableBenchmarkMetrics {
    if (!Number.isInteger(rowCount) || rowCount <= 0) {
        throw new TypeError('Benchmark row count must be a positive integer')
    }
    const root = requiredElement('#performance-root')
    root.replaceChildren()
    const makeRows = (revision: number): BenchmarkRow[] => Array.from(
        {length: rowCount},
        (_, index) => ({
            id: index,
            name: `Row ${index} revision ${revision}`,
            group: index % 2 === 0 ? 'even' : 'odd',
            score: rowCount - index + revision,
        }),
    )
    const data = new Emitter<readonly BenchmarkRow[]>(makeRows(0))

    const initialStart = performance.now()
    const table = DataTable.new({
        data,
        rowKey: 'id',
        multiSelect: true,
        columns: [
            {field: 'id', label: 'ID', sortable: true},
            {field: 'name', label: 'Name'},
            {field: 'group', label: 'Group', filterOptions: ['even', 'odd']},
            {field: 'score', label: 'Score', sortable: true},
        ],
    }).attachTo(root)
    const initialRenderMs = performance.now() - initialStart

    const rerenderStart = performance.now()
    data.set(makeRows(1), 'benchmark data refresh')
    const rerenderMs = performance.now() - rerenderStart

    const sortStart = performance.now()
    table.sortEmitter.set({field: 'score', direction: 'asc'}, 'benchmark sort')
    const sortMs = performance.now() - sortStart

    const filterStart = performance.now()
    table.filtersEmitter.set({
        group: [['even', FilterMode.Require]],
    }, 'benchmark filter')
    const filterMs = performance.now() - filterStart

    const selectionStart = performance.now()
    root.querySelector<HTMLElement>('tbody [data-cap-selectable-row]')?.click()
    const selectionMs = performance.now() - selectionStart
    const renderedRows = root.querySelectorAll('tbody [data-cap-selectable-row]').length
    const selectedRows = table.getSelectedRows().length

    table.destroy()
    data.dispose()
    return {
        rowCount,
        columnCount: 4,
        initialRenderMs,
        rerenderMs,
        sortMs,
        filterMs,
        selectionMs,
        renderedRows,
        selectedRows,
    }
}
