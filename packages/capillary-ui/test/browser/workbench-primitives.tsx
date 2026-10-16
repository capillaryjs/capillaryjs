import {AsyncCommand, Emitter} from '@capillaryjs/capillary'
import {Button, CapillaryUiApp, Form, FormField, FormLayout, MenuButton, TextArea, Textbox, live} from '../../src/index.js'
import '../../themes/base.css'
import '../../colors/iceblue/colors.css'
import '../../themes/minimal/theme.css'

class WorkbenchPrimitivesFixture extends CapillaryUiApp {
    private finish: (() => void) | null = null
    private fail: ((error: Error) => void) | null = null
    private readonly save = new AsyncCommand<void, void>({execute: () => new Promise((resolve, reject) => {
        this.finish = resolve; this.fail = reject
    })})
    private destination: HTMLInputElement | null = null
    private finishForm: (() => void) | null = null
    private failForm: ((error: Error) => void) | null = null
    private readonly submitted = new Emitter('None')
    private readonly formInvocations = new Emitter(0)
    private readonly formError = new Emitter<unknown>(null)
    private readonly formCommand = new AsyncCommand<{name: string; description: string; intent: string}, void>({execute: values => {
        this.formInvocations.set(this.formInvocations.get() + 1)
        this.submitted.set(JSON.stringify(values))
        return new Promise((resolve, reject) => { this.finishForm = resolve; this.failForm = reject })
    }})
    protected override renderContent() {
        return <>
            <h1>Workbench primitives</h1>
            <input aria-label="Before menu"/>
            <div style={{overflow: 'hidden', inlineSize: '4rem', blockSize: '3rem', marginInlineStart: 'auto'}}>
                <MenuButton icon="add" appearance="subtle" ariaLabel="Create definition" items={[
                    {id: 'class', label: 'Class', icon: 'add', onSelect: () => this.destination?.focus()},
                    {id: 'type', label: 'Type', disabled: true, onSelect: () => {}},
                    {id: 'separator', kind: 'separator'},
                    {id: 'other', kind: 'group', label: 'Other actions', items: [
                        {id: 'enum', label: 'Enumeration', onSelect: () => this.destination?.focus()},
                        {id: 'save', label: 'Save', command: this.save},
                    ]},
                ]}/>
            </div>
            <input aria-label="After menu" ref={(element: HTMLInputElement | null) => this.destination = element}/>
            <Button onClick={() => this.finish?.()}>Finish menu action</Button>
            <Button onClick={() => this.fail?.(new Error('Menu operation failed'))}>Fail menu action</Button>
            <section aria-label="Native form fixture">
                <h2>Native form</h2>
                <Form label="Edit details" submitCommand={this.formCommand} submitArguments={({form, submitter}) => {
                    const data = new FormData(form, submitter as HTMLButtonElement | null)
                    return {name: String(data.get('name') ?? ''), description: String(data.get('description') ?? ''), intent: String(data.get('intent') ?? '')}
                }}>
                    <FormLayout>
                        <FormField controlId="fixture-name" label="Name" required help="Enter a unique name" error={live(this.formError)}
                            control={props => <Textbox {...props} name="name"/>}/>
                        <FormField controlId="fixture-description" label="Description" help="Plain multiline text"
                            control={props => <TextArea {...props} name="description" rows={4}/>}/>
                    </FormLayout>
                    <Button type="submit" name="intent" value="save">Save details</Button>
                    <Button type="submit" name="intent" value="draft" formNoValidate>Save draft</Button>
                    <Button onClick={() => this.submitted.set('Cancelled')}>Cancel details</Button>
                </Form>
                <output aria-label="Submitted details">{this.submitted}</output>
                <output aria-label="Form invocations">{this.formInvocations}</output>
                <Button onClick={() => this.finishForm?.()}>Finish form action</Button>
                <Button onClick={() => this.failForm?.(new Error('Details could not be saved'))}>Fail form action</Button>
                <Button onClick={() => this.formError.set(this.formError.get() == null ? 'Name already exists' : null)}>Toggle field validation</Button>
            </section>
            <div style={{blockSize: '70rem'}}/>
        </>
    }
    static override dependencies = [Button, MenuButton, Form, FormLayout, FormField, TextArea, Textbox]
    override onDestroy(): void { this.save.dispose(); this.formCommand.dispose(); this.submitted.dispose(); this.formError.dispose(); this.formInvocations.dispose() }
}
WorkbenchPrimitivesFixture.new().attachTo(document.querySelector('#app')!)
