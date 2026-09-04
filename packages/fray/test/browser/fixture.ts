import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    Checkbox,
    Component,
    DescriptionItem,
    DescriptionList,
    DataTable,
    Dialog,
    Dropdown,
    FilterMode,
    Fragment,
    Panel,
    ProgressBar,
    Sidebar,
    SplitView,
    Tab,
    TabPanel,
    Textbox,
    Toggle,
    Toolbar,
    TreeView,
    createBrowserRouter,
    createFrayRuntime,
    createHistoryNavigation,
    defineRoute,
    h,
    styleRegistry,
} from '../../src/index.js'
import {jsx} from '../../src/jsx-runtime.js'

if (new URLSearchParams(location.search).get('fontScale') === '200') {
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
Dropdown.registerStyles()
DescriptionList.registerStyles()
Dialog.registerStyles()
DataTable.registerStyles()
Panel.registerStyles()
ProgressBar.registerStyles()
Sidebar.registerStyles()
SplitView.registerStyles()
TabPanel.registerStyles()
Textbox.registerStyles()
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
    toolbar: h(Toolbar, {label: 'Request actions'}, h(Button, {label: 'Refresh requests'})),
    children: h('ol', null, Array.from({length: 40}, (_unused, index) =>
        h('li', {key: index}, `Change request ${index + 1}`))),
}).attachTo(requiredElement('#sidebar-root'))

let destroyRouting = () => 0
if (new URLSearchParams(location.search).get('routing') === 'true') {
    const firstRoute = defineRoute('browser-first')
    const secondRoute = defineRoute('browser-second')
    const activeRoute = new Emitter('first')
    const router = createBrowserRouter({adapter: createHistoryNavigation(window)})
    const runtime = createFrayRuntime({router})
    const routedTabs = runtime.mount(runtime.create(TabPanel, {
        id: 'browser-routing',
        label: 'Browser routes',
        valueEmitter: activeRoute,
        children: [
            h(Tab, {id: 'first', label: 'First route', route: firstRoute}, 'First page'),
            h(Tab, {id: 'second', label: 'Second route', route: secondRoute}, 'Second page'),
        ],
    }), requiredElement('#routing-root'))
    destroyRouting = () => {
        routedTabs.destroy()
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
            primary: h(TreeView, {
                label: 'Security projects',
                nodes: [{
                    id: 'workspace',
                    label: 'Workspace',
                    children: [{id: 'service-alpha', label: 'Service Alpha'}],
                }, {id: 'tools', label: 'Tools'}],
                selectedKeyEmitter: primitiveTreeSelection,
                expandedKeysEmitter: primitiveTreeExpansion,
            }),
            secondary: h(ProgressBar, {
                label: 'Projects processed',
                valueEmitter: primitiveProgress,
                max: 4,
            }),
        }),
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
            actions: h(Button, {
                label: 'Confirm reset',
                onClick: () => primitiveDialogOpen.set(false),
            }),
        }, 'No durable records are changed.'),
    ],
}).attachTo(requiredElement('#record-primitives-root'))

globalThis.frayTest = {
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
    destroyRouting() {
        return destroyRouting()
    },
    measureDataTable(rowCount) {
        return measureDataTable(rowCount)
    },
}

globalThis.frayTestReady = true

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
    root.querySelector<HTMLElement>('tbody [data-fray-selectable-row]')?.click()
    const selectionMs = performance.now() - selectionStart
    const renderedRows = root.querySelectorAll('tbody [data-fray-selectable-row]').length
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
