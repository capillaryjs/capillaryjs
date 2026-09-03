import {Emitter} from '@sylwellsoftware/glue'
import {
    DescriptionItem,
    DescriptionList,
    DataTable,
    Dialog,
    Dropdown,
    ProgressBar,
    SplitView,
    Textbox,
    TreeView,
    h,
    serializeTableQuery,
} from '@sylwellsoftware/fray'
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

type Row = {id: number; name: string}
new DataTable<Row>({
    columns: [{field: 'name', render: (row) => row.name.toUpperCase()}],
    data: [{id: 1, name: 'Ada'}],
})

const url = serializeTableQuery(new URL('https://example.test/rows'), {
    sort: {field: 'name', direction: 'desc'},
})
url.searchParams.get('sort')

h(Fragment, null, jsx('span', {children: 'typed'}))

// @ts-expect-error Built declarations preserve Textbox's string value contract.
new Textbox({valueEmitter: new Emitter(42)})
