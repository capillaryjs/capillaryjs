import {
    ColorPicker,
    Component,
    Panel,
    ThemePicker,
    Toggle,
    live,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
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
    render(): FrayChild {
        const {model} = this.props
        const visible = this.read(model.scopedChanges)
        const selected = this.read(model.selectedChange)
        const lastAction = this.read(model.lastAction)
        this.read(model.sourceChanges)
        const fetchState = model.sourceChanges.getFetchState()
        const fetchError = model.sourceChanges.getError()
        return <Panel island className="demo-harness" header="Demo harness">
            <Toggle
                label="Data state"
                valueEmitter={model.demoFetchState}
                options={fetchStateOptions}
                onChange={(state) => model.setDemoFetchState(state)}
            />
            <div class="harness-switches" aria-label="Global control overrides">
                <label>
                    <input type="checkbox" bind:checked={model.forceDisabled} />
                    Force disabled
                </label>
                <label>
                    <input type="checkbox" bind:checked={model.forceRequired} />
                    Force required
                </label>
                <label>
                    <input type="checkbox" bind:checked={model.panelDisabled} />
                    Disable summary panel
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={this.read(model.statusFocusError) != null}
                        onChange={(event: Event) => model.statusFocusError.set(
                            (event.currentTarget as HTMLInputElement).checked
                                ? 'Choose a status focus before continuing.'
                                : null,
                            'status-focus error toggled',
                        )}
                    />
                    Show status error
                </label>
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
