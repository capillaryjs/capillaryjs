import {Emitter} from '@sylwellsoftware/glue'

import {
    Button,
    Component,
    DescriptionItem,
    DescriptionList,
    Dropdown,
    Panel,
    ProgressBar,
    Sidebar,
    SplitView,
    Tab,
    TabPanel,
    Textbox,
    h,
} from '../src/index.js'
import type {
    ComponentProps,
    Key,
    Ref,
} from '../src/index.js'
import {
    DataTable,
    Dialog,
    ListView,
    TreeView,
    serializeTableQuery,
} from '../src/experimental.js'

const textboxValue = new Emitter('Ada')
const textbox = new Textbox({label: 'Name', valueEmitter: textboxValue})
textbox.valueEmitter.get().toUpperCase()

const numericValue = new Emitter(1)
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

type Row = {id: number; name: string}
new ListView<Row>({
    items: [{id: 1, name: 'Ada'}],
    renderItem(row) {
        row.name.toUpperCase()
        // @ts-expect-error Experimental row models retain their declared shape.
        return row.missing
    },
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
    mode: 'local',
    data: [{id: 1, name: 'Ada'}],
    columns: [{field: 'name', render: (row) => row.name.toUpperCase()}],
})
new DataTable<Row>({
    mode: 'local',
    data: [],
    // @ts-expect-error Experimental table fields must exist on the row model.
    columns: [{field: 'missing'}],
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
void invalidKey
void invalidRef
