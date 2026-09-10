import {Emitter} from '@sylwellsoftware/glue'
import {
    Component,
    DatePicker,
    DateTimePicker,
    DescriptionItem,
    DescriptionList,
    DataTable,
    Dialog,
    Dropdown,
    NavigationBar,
    FrayApp,
    ProgressBar,
    RouteLink,
    RouteOutlet,
    SplitView,
    Textbox,
    TimePicker,
    TreeView,
    createBrowserRouter,
    createFrayRuntime,
    createServiceScope,
    defineRoute,
    defineService,
    h,
    mountFrayApp,
    provideService,
    routeTarget,
    serializeTableQuery,
} from '@sylwellsoftware/fray'
import type {NavigationAdapter} from '@sylwellsoftware/fray'
import {Fragment, jsx} from '@sylwellsoftware/fray/jsx-runtime'

const text = new Emitter('typed')
new Textbox({valueEmitter: text}).valueEmitter.get().toUpperCase()

const numeric = new Dropdown<number>({
    options: [{value: 1, label: 'One'}],
    valueEmitter: new Emitter(1),
})
numeric.valueEmitter.get().toFixed()

new DescriptionList({children: h(DescriptionItem, {term: 'Owner', value: 'Team'})})
new SplitView({primary: 'Navigation', secondary: 'Content'})
new ProgressBar({label: 'Loading', value: null})
new TreeView({label: 'Projects', nodes: [{id: 'one', label: 'One'}]})
new Dialog({title: 'Confirm', children: 'Continue?'})
mountFrayApp(createFrayRuntime(), FrayApp, document.body, {
    sizing: 'viewport',
    landmark: 'main',
    children: 'Application',
})

type Row = {id: number; name: string}
new DataTable<Row>({
    columns: [{field: 'name', render: (row) => row.name.toUpperCase()}],
    data: [{id: 1, name: 'Ada'}],
})

const date = new DatePicker({
    label: 'Start date',
    valueEmitter: new Emitter<string | null>('2026-09-10'),
    onChange: (value) => {
        value?.slice(0, 4)
    },
})
date.valueEmitter.get()?.slice(0, 4)

const time = new TimePicker({
    label: 'Start time',
    valueEmitter: new Emitter<string | null>('10:00'),
})
time.valueEmitter.get()?.slice(0, 2)

const combined = new DateTimePicker({
    label: 'Schedule',
    valueEmitter: new Emitter<{date: string | null; time: string | null} | null>({
        date: '2026-09-10',
        time: '10:00',
    }),
})
combined.valueEmitter.get()?.date?.slice(0, 4)

const url = serializeTableQuery(new URL('https://example.test/rows'), {
    sort: {field: 'name', direction: 'desc'},
})
url.searchParams.get('sort')

h(Fragment, null, jsx('span', {children: 'typed'}))

interface GreetingService {
    greeting(name: string): string
}
const greetingService = defineService<GreetingService>('greeting')
const services = createServiceScope([
    provideService(greetingService, () => ({greeting: (name) => `Hello ${name}`})),
])
class Greeting extends Component {
    static requiredServices = [greetingService]
    initialize() {
        this.requireService(greetingService).greeting('Ada')
    }
    render() {
        return h('output')
    }
}
createFrayRuntime({services}).create(Greeting)

const homeRoute = defineRoute('home')
const adapter: NavigationAdapter = {
    read: () => '/',
    href: (location) => location,
    push: (_location) => {},
    replace: (_location) => {},
    subscribe: (_listener) => () => {},
}
const router = createBrowserRouter({adapter})
createFrayRuntime({router})
new RouteLink({to: routeTarget(homeRoute), children: 'Home'})
new NavigationBar({
    label: 'Primary',
    items: [{id: 'home', label: 'Home', to: routeTarget(homeRoute)}],
})
new RouteOutlet({
    valueEmitter: new Emitter<string | number | null>('home'),
    mountPolicy: 'active-only',
    views: [{id: 'home', route: homeRoute, content: 'Home'}],
})

// @ts-expect-error Built declarations preserve Textbox's string value contract.
new Textbox({valueEmitter: new Emitter(42)})
