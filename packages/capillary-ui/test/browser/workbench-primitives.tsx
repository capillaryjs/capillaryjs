import {AsyncCommand} from '@capillaryjs/capillary'
import {Button, CapillaryUiApp, MenuButton} from '../../src/index.js'
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
            <div style={{blockSize: '70rem'}}/>
        </>
    }
    static override dependencies = [Button, MenuButton]
    override onDestroy(): void { this.save.dispose() }
}
WorkbenchPrimitivesFixture.new().attachTo(document.querySelector('#app')!)
