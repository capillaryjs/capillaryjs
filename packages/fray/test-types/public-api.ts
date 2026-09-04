import {Emitter} from '@sylwellsoftware/glue'

import {
    Button,
    Component,
    DescriptionItem,
    DescriptionList,
    DataTable,
    Dialog,
    Dropdown,
    ListView,
    Panel,
    ProgressBar,
    RadioGroup,
    RouteLink,
    RouteQuery,
    RouteValue,
    Sidebar,
    SplitView,
    Tab,
    TabPanel,
    Textbox,
    TreeView,
    createBrowserRouter,
    createFrayRuntime,
    createServiceScope,
    defineRoute,
    defineRouteParameter,
    defineService,
    h,
    live,
    provideService,
    routeParameter,
    routeTarget,
    serializeTableQuery,
    stringRouteCodec,
    stringRouteQueryCodec,
    withRouteQuery,
} from '../src/index.js'
import type {
    ComponentProps,
    Key,
    NavigationAdapter,
    Ref,
} from '../src/index.js'
const textboxValue = new Emitter('Ada')
const textbox = new Textbox({label: 'Name', valueEmitter: textboxValue})
textbox.valueEmitter.get().toUpperCase()

const numericValue = new Emitter(1)
const radioOptions = new Emitter([['one', 'One']] as const)
const radioDisabled = new Emitter(false)
const radioError = new Emitter<unknown>(null)
const radio = h(RadioGroup, {
    options: radioOptions.get(),
    disabled: live(radioDisabled),
    required: live(radioDisabled),
    error: live(radioError),
})
// @ts-expect-error h() rejects live RadioGroup options.
const invalidLiveRadioOptions = h(RadioGroup, {options: live(radioOptions)})
const numericDropdown = new Dropdown<number>({
    options: [{value: 1, label: 'One'}],
    valueEmitter: numericValue,
    onChange(value) {
        value.toFixed()
    },
})
numericDropdown.valueEmitter.get().toFixed()

const activeTab = new Emitter<Key | null>('profile')
new TabPanel({
    valueEmitter: activeTab,
    children: [h(Tab, {id: 'profile', label: 'Profile'}, 'Profile content')],
})

const applicationsRoute = defineRoute('applications')
const projectRoute = defineRouteParameter('project', stringRouteCodec, 'project-id')
const projectTarget = withRouteQuery(
    routeTarget(applicationsRoute, routeParameter(projectRoute, 'acme')),
    {view: 'history'},
)
const routeAdapter: NavigationAdapter = {
    read: () => '/',
    href: (location) => location,
    push: (_location) => {},
    replace: (_location) => {},
    subscribe: (_listener) => () => {},
}
const router = createBrowserRouter({adapter: routeAdapter})
new RouteLink({to: projectTarget, children: 'Project'})
new RouteValue({route: projectRoute, valueEmitter: new Emitter<string | null>(null)})
new RouteQuery({
    name: 'view',
    valueEmitter: new Emitter('summary'),
    codec: stringRouteQueryCodec,
    defaultValue: 'summary',
})
new TabPanel({
    children: [h(Tab, {id: 'applications', route: applicationsRoute}, 'Applications')],
})
createFrayRuntime({router})
// @ts-expect-error Dynamic routes require a typed routeParameter value in targets.
routeTarget(projectRoute)
// @ts-expect-error Dynamic route values retain the descriptor's value type.
routeParameter(projectRoute, 42)

new Sidebar({
    header: 'Requests',
    ariaLabel: 'Fallback name',
    toolbar: h(Button, {label: 'Refresh'}),
    children: ['Request one'],
})

new DescriptionList({
    label: 'Details',
    children: [h(DescriptionItem, {term: 'Severity', value: 'High'})],
})
new SplitView({primary: 'Tree', secondary: 'Details', direction: 'horizontal'})
new ProgressBar({label: 'Refresh', valueEmitter: new Emitter<number | null>(1), max: 4})
new Button({label: 'Refresh', busy: true, busyLabel: 'Refreshing'})

interface CardProps extends ComponentProps {
    title: string
}
class Card extends Component<CardProps> {
    render() {
        return h(Panel, {header: this.props.title}, this.props.children)
    }
}
h(Card, {title: 'Typed'}, h(Button, {label: 'Save'}))

interface GreetingService {
    greeting(name: string): string
}
const greetingService = defineService<GreetingService>('greeting')
const services = createServiceScope([
    provideService(greetingService, () => ({
        greeting: (name) => `Hello ${name}`,
    })),
])
class Greeting extends Component {
    static requiredServices = [greetingService]
    private message = ''
    initialize() {
        this.message = this.requireService(greetingService).greeting('Ada')
    }
    render() {
        return h('output', null, this.message)
    }
}
createFrayRuntime({services}).create(Greeting)
// @ts-expect-error A provider must implement its service contract.
provideService(greetingService, () => ({greeting: 42}))

type Row = {id: number; name: string}
const selectedRow = new Emitter<Row | null>(null)
new ListView<Row>({
    items: [{id: 1, name: 'Ada'}],
    selectedItemEmitter: selectedRow,
    renderItem(row) {
        row.name.toUpperCase()
        // @ts-expect-error Stable row models retain their declared shape.
        return row.missing
    },
})
new ListView<Row>({
    items: [],
    multiSelect: true,
    selectedItemsEmitter: new Emitter<Row[]>([]),
})
new TreeView<Row>({
    label: 'Rows',
    nodes: [{id: 1, label: 'Ada', value: {id: 1, name: 'Ada'}}],
    onSelect(node) {
        node.value?.name.toUpperCase()
    },
})
new Dialog({title: 'Confirm', valueEmitter: new Emitter(false), children: 'Continue?'})
new DataTable<Row>({
    data: [{id: 1, name: 'Ada'}],
    selectedItemEmitter: selectedRow,
    columns: [{field: 'name', render: (row) => row.name.toUpperCase()}],
})
new DataTable<Row>({
    rest: {url: '/rows', baseUrl: 'https://example.test/'},
    columns: [{field: 'name'}],
})
new DataTable<Row>({
    data: [],
    // @ts-expect-error Stable table fields must exist on the row model.
    columns: [{field: 'missing'}],
})

// @ts-expect-error Single selection accepts one item or null, not an array.
new ListView<Row>({items: [], selectedItemsEmitter: new Emitter<Row[]>([])})
// @ts-expect-error Multi-selection requires the collection emitter.
new DataTable<Row>({
    data: [],
    columns: [{field: 'name'}],
    multiSelect: true,
    selectedItemEmitter: selectedRow,
})
const serialized = serializeTableQuery(new URL('https://example.test/rows'), {
    sort: {field: 'name', direction: 'asc'},
})
serialized.searchParams.get('sort')

const inputRef: Ref<HTMLInputElement> = {current: null}
inputRef.current?.focus()

// @ts-expect-error Textbox emitters must contain strings.
new Textbox({valueEmitter: numericValue})
// @ts-expect-error Button disabled is boolean, not a string.
new Button({disabled: 'yes'})
// @ts-expect-error Keys are strings or numbers.
const invalidKey: Key = {id: 'not-a-key'}
// @ts-expect-error Ref current values must match the referenced node.
const invalidRef: Ref<HTMLInputElement> = {current: 'not-an-input'}

void textbox
void radio
void invalidLiveRadioOptions
void invalidKey
void invalidRef
