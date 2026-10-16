import {AsyncCommand, Emitter, LiveQuery} from '@capillaryjs/capillary'
import {Button, CapillaryUiApp, ComboBox, Drawer, Form, FormField, FormLayout, MenuButton, SplitPrimary, SplitSecondary, SplitView, TextArea, Textbox, Tooltip, live} from '../../src/index.js'
import type {CollapsedSplitPane, ComboBoxOption} from '../../src/index.js'
import {DragFixture} from './dragFixture.js'
import {ViewportFixture} from './viewportFixture.js'
import '../../themes/base.css'
import '../../colors/iceblue/colors.css'
import '../../themes/minimal/theme.css'

class WorkbenchPrimitivesFixture extends CapillaryUiApp {
    private readonly collapsedPane = new Emitter<CollapsedSplitPane>(null)
    private readonly reviewOpen = new Emitter(false)
    private readonly retainedOpen = new Emitter(false)
    private readonly restorePane: {current: HTMLButtonElement | null} = {current: null}
    private readonly reviewOpener: {current: HTMLButtonElement | null} = {current: null}
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
    private readonly localChoice = new Emitter<string | null>('a')
    private readonly customChoice = new Emitter<string | null>(null)
    private readonly requiredChoice = new Emitter<string | null>('a')
    private finishChoice: (() => void) | null = null
    private failChoice: ((error: Error) => void) | null = null
    private readonly choose = new AsyncCommand<string | null, void>({execute: () => new Promise((resolve, reject) => {
        this.finishChoice = resolve; this.failChoice = reject
    })})
    private readonly optionSearch = new Emitter('')
    private readonly remoteChoice = new Emitter<string | null>('a')
    private readonly optionRequests = new Emitter(0)
    private readonly optionQuery = new LiveQuery<readonly ComboBoxOption[], {search: Emitter<string>}>({
        args: {search: this.optionSearch}, handler: {fetch: async ({search}, options) => {
            this.optionRequests.set(this.optionRequests.get() + 1)
            if (!search) return [{value: 'a', label: 'Alpha'}, {value: 'b', label: 'Beta'}]
            const response = await fetch(`/fixture-options?search=${encodeURIComponent(search)}`, {signal: options?.signal as AbortSignal})
            if (!response.ok) throw new Error('Options unavailable')
            return response.json() as Promise<readonly ComboBoxOption[]>
        }},
    })
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
            <section aria-label="Searchable choices">
                <h2>Searchable choices</h2>
                <form aria-label="Choice serialization" onSubmit={(event: Event) => event.preventDefault()}>
                    <ComboBox label="Local choice" id="local-choice" name="choice" valueEmitter={this.localChoice}
                        options={[{value: 'a', label: 'Alpha'}, {value: 'disabled', label: 'Unavailable', disabled: true}, {value: 'b', label: 'Beta'}]} required/>
                </form>
                <ComboBox<string> label="Custom type" valueEmitter={this.customChoice} options={[]} allowCustomValue/>
                <ComboBox label="Required choice" valueEmitter={this.requiredChoice} options={[{value: 'a', label: 'Alpha'}, {value: 'b', label: 'Beta'}]} changeCommand={this.choose}/>
                <ComboBox label="Remote choice" valueEmitter={this.remoteChoice} options={this.optionQuery} searchEmitter={this.optionSearch} filter="none"/>
                <output aria-label="Local selected value">{this.localChoice}</output>
                <output aria-label="Custom selected value">{this.customChoice}</output>
                <output aria-label="Remote selected value">{this.remoteChoice}</output>
                <output aria-label="Option requests">{this.optionRequests}</output>
                <Button onClick={() => this.finishChoice?.()}>Finish choice action</Button>
                <Button onClick={() => this.failChoice?.(new Error('Choice details failed'))}>Fail choice action</Button>
            </section>
            <section aria-label="Supplemental tooltips">
                <h2>Supplemental tooltips</h2>
                <div style={{overflow: 'hidden', inlineSize: '4rem', blockSize: '3rem', marginInlineStart: 'auto'}}>
                    <Tooltip text="Use arrow keys on the canvas to pan." trigger={({ariaDescribedBy, triggerRef}) =>
                        <Button icon="pan" ariaLabel="Pan canvas" title="" ariaDescribedBy={ariaDescribedBy} buttonRef={triggerRef}/>} />
                </div>
            </section>
            <section aria-label="Collapsible panes and drawers">
                <h2>Collapsible panes and drawers</h2>
                <Button onClick={() => this.collapsedPane.set('primary')}>Collapse navigation</Button>
                <Button onClick={() => this.collapsedPane.set('secondary')}>Collapse workspace</Button>
                <Button buttonRef={this.restorePane} onClick={() => this.collapsedPane.set(null)}>Restore panes</Button>
                <div style={{display: 'flex', blockSize: '15rem', inlineSize: 'min(800px, 100%)'}}>
                    <SplitView horizontal primarySize="200px" separatorLabel="Resize fixture panes" collapsed={live(this.collapsedPane)} collapseFocusRef={this.restorePane}>
                        <SplitPrimary label="Fixture navigation"><input aria-label="Pane filter"/>
                            <Button onClick={() => this.collapsedPane.set('primary')}>Hide own pane</Button></SplitPrimary>
                        <SplitSecondary label="Fixture workspace"><input aria-label="Pane details"/></SplitSecondary>
                    </SplitView>
                </div>
                <Button buttonRef={this.reviewOpener} onClick={() => this.reviewOpen.set(!this.reviewOpen.get())}>Toggle review</Button>
                <Drawer label="Review panel" edge="block-end" size="12rem" valueEmitter={this.reviewOpen} mountPolicy="active-only"
                    closeLabel="Close review" returnFocusRef={this.reviewOpener}>
                    <input aria-label="Review notes" defaultValue="Seed"/>
                    <MenuButton label="Review actions" items={[{id: 'inspect', label: 'Inspect', onSelect: () => {}}]}/>
                </Drawer>
                <Button onClick={() => this.retainedOpen.set(!this.retainedOpen.get())}>Toggle retained</Button>
                <Drawer label="Retained panel" edge="block-end" size="12rem" valueEmitter={this.retainedOpen} mountPolicy="lazy" closeLabel="Close retained">
                    <input aria-label="Retained note" defaultValue="Seed"/>
                </Drawer>
                <input aria-label="After drawers"/>
            </section>
            <section aria-label="Pointer dragging"><h2>Pointer dragging</h2><DragFixture/></section>
            <section aria-label="Pan zoom primitives"><h2>Pan zoom primitives</h2><ViewportFixture/></section>
            <div style={{blockSize: '70rem'}}/>
        </>
    }
    static override dependencies = [Button, MenuButton, Form, FormLayout, FormField, TextArea, Textbox, ComboBox, Tooltip, Drawer, SplitView, SplitPrimary, SplitSecondary, DragFixture, ViewportFixture]
    override onDestroy(): void {
        this.collapsedPane.dispose(); this.reviewOpen.dispose(); this.retainedOpen.dispose()
        this.save.dispose(); this.formCommand.dispose(); this.submitted.dispose(); this.formError.dispose(); this.formInvocations.dispose()
        this.choose.dispose(); this.optionQuery.dispose(); this.optionSearch.dispose(); this.optionRequests.dispose()
        this.localChoice.dispose(); this.customChoice.dispose(); this.requiredChoice.dispose(); this.remoteChoice.dispose()
    }
}
WorkbenchPrimitivesFixture.new().attachTo(document.querySelector('#app')!)
