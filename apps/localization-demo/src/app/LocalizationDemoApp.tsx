import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    Checkbox,
    Component,
    DataTable,
    DatePicker,
    Dialog,
    Dropdown,
    FrayApp,
    ListView,
    Panel,
    TimePicker,
    Toggle,
} from '@sylwellsoftware/fray'
import type {
    ComponentProps,
    FrayChild,
    TableColumn,
} from '@sylwellsoftware/fray'

import type {DemoLocaleDefinition} from '../locales.js'
import {languageOptions} from '../locales.js'

interface LocalizationDemoAppProps extends ComponentProps {
    definition: DemoLocaleDefinition
    onLocaleChange: (locale: DemoLocaleDefinition['locale']) => void
}

interface DemoTask extends Record<string, unknown> {
    name: string
}

/**
 * Small gallery that deliberately mixes application-owned copy with Fray-owned
 * defaults so the boundary is visible while changing languages.
 */
export class LocalizationDemoApp extends Component<LocalizationDemoAppProps> {
    private readonly dialogOpen = new Emitter(false, {
        owner: this,
        purpose: 'localization demo dialog',
    })

    render(): FrayChild {
        const {copy, locale} = this.props.definition
        const columns: readonly TableColumn<DemoTask>[] = [{
            field: 'name',
            label: copy.tableNameColumn,
            ariaLabel: copy.tableNameColumn,
            sortable: true,
        }]
        const messages = [
            [copy.dropdownMessageLabel, this.frayMessage('dropdownPlaceholder')],
            [copy.timeMessageLabel, this.frayMessage('timePickerPlaceholder')],
            [copy.emptyMessageLabel, this.frayMessage('dataTableEmpty')],
            [copy.closeMessageLabel, this.frayMessage('dialogCloseLabel')],
            [
                copy.sortMessageLabel,
                this.frayMessage('tableSortColumnLabel')(copy.tableNameColumn),
            ],
            [copy.calendarMessageLabel, this.frayMessage('calendarGridLabel')],
        ] as const

        return <FrayApp sizing="viewport-width" className="localization-demo-app">
            <header className="localization-demo-hero">
                <div>
                    <p className="localization-demo-eyebrow">{copy.eyebrow}</p>
                    <h1>{copy.title}</h1>
                    <p>{copy.introduction}</p>
                </div>
                <div className="localization-demo-language">
                    <Toggle
                        id="localization-demo-language"
                        label={copy.languageLabel}
                        defaultValue={locale}
                        options={languageOptions()}
                        onChange={(nextLocale) => this.props.onLocaleChange(nextLocale)}
                    />
                    <p><code>{locale}</code> · {copy.runtimeNote}</p>
                </div>
            </header>

            <main className="localization-demo-grid">
                <Panel header={copy.controlsHeading} className="localization-demo-panel">
                    <div className="localization-demo-fields">
                        <Dropdown
                            label={copy.assigneeLabel}
                            defaultValue=""
                            options={copy.assigneeOptions.map(([value, label]) => ({
                                value,
                                label,
                            }))}
                        />
                        <DatePicker
                            label={copy.dateLabel}
                            defaultValue="2026-09-15"
                            min="2026-01-01"
                            max="2026-12-31"
                        />
                        <TimePicker
                            label={copy.timeLabel}
                            defaultValue={null}
                            step={30}
                        />
                        <Checkbox label={copy.remindersLabel} />
                    </div>
                </Panel>

                <Panel header={copy.statesHeading} className="localization-demo-panel">
                    <div className="localization-demo-states">
                        <section>
                            <h2>{copy.listHeading}</h2>
                            <ListView items={[]} />
                        </section>
                        <DataTable<DemoTask>
                            data={[]}
                            rowKey="name"
                            caption={copy.tableCaption}
                            columns={columns}
                        />
                    </div>
                </Panel>

                <Panel header={copy.dialogHeading} className="localization-demo-panel">
                    <div className="localization-demo-dialog-launcher">
                        <Button
                            label={copy.dialogOpenLabel}
                            onClick={() => this.dialogOpen.set(true, 'dialog opened')}
                        />
                        <Dialog
                            title={copy.dialogTitle}
                            description={copy.dialogDescription}
                            valueEmitter={this.dialogOpen}
                        >
                            <p>{copy.dialogBody}</p>
                        </Dialog>
                    </div>
                </Panel>

                <Panel header={copy.resolvedHeading} className="localization-demo-panel">
                    <p className="localization-demo-note">{copy.resolvedIntroduction}</p>
                    <dl className="localization-demo-messages">
                        {messages.map(([term, value]) => <div key={term}>
                            <dt>{term}</dt>
                            <dd>{value}</dd>
                        </div>)}
                    </dl>
                </Panel>
            </main>
        </FrayApp>
    }

    static dependencies = [
        FrayApp,
        Panel,
        Toggle,
        Dropdown,
        DatePicker,
        TimePicker,
        Checkbox,
        ListView,
        DataTable,
        Button,
        Dialog,
    ]
}
