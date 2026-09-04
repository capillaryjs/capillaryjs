import {
    DerivedEmitter,
    Emitter,
    FetchState,
    LiveQuery,
    QueryHandler,
} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'
import {
    Button,
    Component,
    Panel,
    RadioGroup,
    Sidebar,
    Textbox,
    createFrayRuntime,
    h,
    live,
} from '@sylwellsoftware/fray'
import type {
    ComponentProps,
    RadioOption,
    WritableEmitter,
} from '@sylwellsoftware/fray'

interface BadgeProps extends ComponentProps {
    tone?: 'neutral' | 'positive'
}

const sidebarExample = <Sidebar
    header="Projects"
    toolbar={<Textbox label="Search projects" />}
>
    <ul><li>Release automation</li></ul>
</Sidebar>

class Badge extends Component<BadgeProps> {
    render() {
        const Host = this.Host
        return <Host data-tone={this.props.tone ?? 'neutral'}>
            {this.props.children}
        </Host>
    }

    static override hostName = 'badge'
    static override standaloneHostName = 'ui-badge'
}

class Counter extends Component {
    readonly count = new Emitter(0)
    readonly label = this.count.map((count) => `Count: ${count}`)

    render() {
        return h(Button, {
            label: this.label,
            onClick: () => this.count.set(this.count.get() + 1),
        })
    }

    onDestroy(): void {
        this.label.dispose()
        this.count.dispose()
    }

    static dependencies = [Button]
}

interface Change {
    id: number
    title: string
}

const fixtures: readonly Change[] = [
    {id: 101, title: 'Add release attestations'},
    {id: 102, title: 'Migrate the demo to TypeScript'},
]

class ChangeQueryHandler extends QueryHandler<{filter: string}, readonly Change[]> {
    override fetch({filter}: {filter: string}): readonly Change[] {
        const needle = filter.trim().toLocaleLowerCase()
        return needle === ''
            ? fixtures
            : fixtures.filter(({title}) =>
                title.toLocaleLowerCase().includes(needle))
    }
}

interface PreviewProps extends ComponentProps {
    heading: ReadableEmitter<string, unknown>
    approved: WritableEmitter<boolean>
}

class Preview extends Component<PreviewProps> {
    render() {
        return <section aria-label="Live change preview">
            <h3>{this.props.heading}</h3>
            <label>
                <input type="checkbox" bind:checked={this.props.approved} />
                Approved
            </label>
        </section>
    }
}

interface ResultsProps extends ComponentProps {
    results: ReadableEmitter<readonly Change[] | undefined, unknown>
}

class Results extends Component<ResultsProps> {
    render() {
        const {value, fetchState, error} = this.snapshot(this.props.results)

        if (fetchState === FetchState.Error) {
            return <p role="alert">{String(error)}</p>
        }
        return <ul aria-busy={fetchState === FetchState.Loading}>
            {(value ?? []).map((change) =>
                <li key={change.id}>{change.title}</li>)}
        </ul>
    }
}

const selectedView = new Emitter<'list' | 'grid'>('list')
const unavailable = new Emitter(false)
const mustChoose = new Emitter(true)
const radioExample = <RadioGroup
    label="View"
    options={[
        ['list', 'List'],
        ['grid', 'Grid'],
    ]}
    valueEmitter={selectedView}
    disabled={live(unavailable)}
    required={live(mustChoose)}
/>

interface ViewChooserProps extends ComponentProps {
    options: ReadableEmitter<readonly RadioOption[]>
}

class ViewChooser extends Component<ViewChooserProps> {
    render() {
        return <RadioGroup
            label="View"
            options={this.read(this.props.options)}
        />
    }
}

class ChangeApp extends Component {
    readonly title = new Emitter('Add native Glue template bindings')
    readonly approved = new Emitter(false)
    readonly filter = new Emitter('')
    readonly showPreview = new Emitter(true)
    readonly heading = new DerivedEmitter(
        [this.title, this.approved] as const,
        ([title, approved]) => `${title} — ${approved ? 'approved' : 'draft'}`,
    )
    readonly results = new LiveQuery({
        handler: new ChangeQueryHandler(),
        args: {filter: this.filter},
    })

    render() {
        return <Panel header={this.heading}>
            <Textbox label="Title" valueEmitter={this.title} />

            <label>
                Search
                <input bind:value={this.filter} />
            </label>

            <output title={live(this.heading)}>
                Current title: {this.title}
            </output>

            <label>
                <input type="checkbox" bind:checked={this.showPreview} />
                Show preview
            </label>

            {this.read(this.showPreview)
                ? <Preview heading={this.heading} approved={this.approved} />
                : null}

            <Results results={this.results} />
            <Button
                label="Refresh results"
                onClick={() => void this.results.refresh()}
            />
        </Panel>
    }

    onDestroy(): void {
        this.results.dispose()
        this.heading.dispose()
        this.showPreview.dispose()
        this.filter.dispose()
        this.approved.dispose()
        this.title.dispose()
    }

    static dependencies = [Button, Panel, Preview, Results, Textbox]
}

export function mountReadmeExamples(parent: ParentNode): void {
    const runtime = createFrayRuntime({elementNames: {prefix: 'fray'}})
    runtime.registerStyles(Counter)
    runtime.registerStyles(ChangeApp)
    runtime.injectStyles(document)
    runtime.mount(runtime.create(Counter), parent)
    runtime.mount(runtime.create(ChangeApp), parent)
}

void radioExample
void ViewChooser
