import {AsyncCommand, Emitter} from '@capillaryjs/capillary'
import {Button, CapillaryUiApp, DataTable, ListView, Popover, ThemePicker, TreeView, live} from '../../src/index.js'
import '../../themes/base.css'
import '../../colors/iceblue/colors.css'
import '../../themes/minimal/theme.css'

const themeOptions = [
    {value: 'ready', label: 'Ready', href: '/fixture-ready.css'},
    {value: 'slow', label: 'Slow', href: '/fixture-slow.css'},
    {value: 'failed', label: 'Failed', href: '/fixture-failed.css'},
] as const

class InteractionFixture extends CapillaryUiApp {
    readonly open = new Emitter(false)
    private anchor: HTMLElement | null = null
    private finishAction: (() => void) | null = null
    private finishRelated: (() => void) | null = null
    readonly action = new AsyncCommand<void, void>({execute: () => new Promise(resolve => this.finishAction = resolve)})
    readonly related = new AsyncCommand<void, void>({execute: () => new Promise(resolve => this.finishRelated = resolve)})

    protected override renderContent() {
        return <>
            <h1>Interaction contract</h1>
            <ThemePicker label="Theme" defaultValue="ready" options={themeOptions} />
            <input aria-label="Outside control" />
            <div>
                <Button icon="add" appearance="subtle" ariaLabel="Add item" command={this.action} />
                <Button onClick={() => this.finishAction?.()}>Finish action</Button>
                <Button command={this.related}>Start related work</Button>
                <Button onClick={() => this.finishRelated?.()}>Finish related work</Button>
            </div>
            <ListView label="Records" items={[{id: 'one', label: 'One'}, {id: 'two', label: 'Two'}]} itemKey="id" busy={live(this.related.isRunning)} />
            <TreeView label="Definitions" nodes={[{id: 'one', label: 'One', children: [{id: 'two', label: 'Two'}]}]} busy={live(this.related.isRunning)} />
            <DataTable caption="Fields" data={[{id: 'one', name: 'One'}]} rowKey="id"
                columns={[{field: 'name', label: 'Name', sortable: true, filterOptions: ['One']}, {field: 'id', label: 'Key', sortable: true}]}
                busy={live(this.related.isRunning)} />
            <div className="clipped-anchor" style={{overflow: 'hidden', width: '10rem', height: '3rem', marginInlineStart: 'auto', marginTop: '4rem'}}>
                <Button icon="connect" ariaLabel="Connect node" appearance="subtle" onClick={event => {
                    this.anchor = event.currentTarget as HTMLElement
                    this.open.set(true)
                }} />
            </div>
            {this.read(this.open) && <Popover label="New connection" anchor={this.anchor} valueEmitter={this.open}>
                <form style={{width: '22rem', maxWidth: '100%'}} onSubmit={(event: Event) => event.preventDefault()}>
                    <label>Target <input aria-label="Target" /></label>
                    <p>Choose a target near the initiating node.</p>
                    <Button onClick={() => this.open.set(false)}>Done</Button>
                </form>
            </Popover>}
            <div style={{height: '60rem'}} />
        </>
    }

    static override dependencies = [Button, ListView, TreeView, DataTable, Popover, ThemePicker]
    onDestroy(): void { this.action.dispose(); this.related.dispose(); this.open.dispose() }
}

InteractionFixture.new().attachTo(document.querySelector('#app')!)
