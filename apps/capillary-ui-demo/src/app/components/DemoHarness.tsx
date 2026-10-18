import {
    Checkbox,
    ColorPicker,
    Component,
    Panel,
    ThemePicker,
    Toggle,
    live,
} from '@capillaryjs/capillary-ui'
import {Emitter} from '@capillaryjs/capillary'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import type {MeridianModel} from '../model/MeridianModel.js'

interface DemoHarnessProps extends ComponentProps {
    readonly model: MeridianModel
}

const fetchStateOptions = [
    ['automatic', 'Automatic'],
    ['initial', 'Initial'],
    ['loading', 'Loading'],
    ['ready', 'Ready'],
    ['error', 'Error'],
] as const

export class DemoHarness extends Component<DemoHarnessProps> {
    static override dependencies = [Panel, Toggle, Checkbox, ThemePicker, ColorPicker]
    private readonly showStatusError = new Emitter(false, {owner: this, purpose: 'show status focus error'})

    render(): CapillaryUiChild {
        const {model} = this.props
        const visible = this.read(model.scopedChanges)
        const selected = this.read(model.selectedChange)
        const lastAction = this.read(model.lastAction)
        this.read(model.sourceChanges)
        const fetchState = model.sourceChanges.getFetchState()
        const fetchError = model.sourceChanges.getError()
        const statusErrorIsShown = this.read(model.statusFocusError) != null
        if (this.showStatusError.get() !== statusErrorIsShown) this.showStatusError.set(statusErrorIsShown)
        return <Panel island className="demo-harness" header="Demo harness">
            <Toggle
                label="Data state"
                valueEmitter={model.demoFetchState}
                options={fetchStateOptions}
                onChange={(state) => model.setDemoFetchState(state)}
            />
            <div class="harness-switches" aria-label="Global control overrides">
                <Checkbox label="Force disabled" valueEmitter={model.forceDisabled}/>
                <Checkbox label="Force required" valueEmitter={model.forceRequired}/>
                <Checkbox label="Disable summary panel" valueEmitter={model.panelDisabled}/>
                <Checkbox label="Show status error" valueEmitter={this.showStatusError} onChange={checked => model.statusFocusError.set(
                    checked ? 'Choose a status focus before continuing.' : null,
                    'status-focus error toggled',
                )}/>
            </div>
            <fieldset class="appearance-controls">
                <legend>Appearance</legend>
                <ThemePicker
                    label="Theme"
                    valueEmitter={model.themeSelection}
                    disabled={live(model.forceDisabled)}
                    onChange={(theme) => model.note(`Theme → ${theme}`)}
                />
                <ColorPicker
                    label="Colour"
                    valueEmitter={model.colorSelection}
                    disabled={live(model.forceDisabled)}
                    onChange={(color) => model.note(`Colour → ${color}`)}
                />
            </fieldset>
            <dl class="reactive-consequences">
                <div><dt>Data</dt><dd>{fetchState}</dd></div>
                <div><dt>Visible</dt><dd>{visible.length} changes</dd></div>
                <div><dt>Selected</dt><dd>{selected?.id ?? 'None'}</dd></div>
                <div><dt>Last action</dt><dd>{lastAction}</dd></div>
                {fetchError == null ? null : <div><dt>Error</dt><dd>{fetchError.message}</dd></div>}
            </dl>
        </Panel>
    }
}
