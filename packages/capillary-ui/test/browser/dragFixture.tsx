import {Emitter} from '@capillaryjs/capillary'
import {Button, Component, Icon, createPointerDrag} from '../../src/index.js'
import type {CapillaryUiChild} from '../../src/index.js'

export class DragFixture extends Component {
    static override hostName = 'dragfixture'
    static override dependencies = [Button, Icon]
    private readonly position = new Emitter({x: 20, y: 20})
    private readonly preview = new Emitter<{x: number; y: number} | null>(null)
    private readonly commits = new Emitter(0)
    private readonly clicks = new Emitter(0)
    private readonly cancelled = new Emitter('None')
    private readonly drag = createPointerDrag<{kind: 'move' | 'connect'; x: number; y: number}>(this, {
        onMove: state => {if (state.context.kind === 'move') this.preview.set({x: state.context.x + state.dx, y: state.context.y + state.dy})},
        onCommit: state => {
            if (state.context.kind === 'move') this.position.set({x: state.context.x + state.dx, y: state.context.y + state.dy})
            this.preview.set(null); this.commits.set(this.commits.get() + 1)
        },
        onCancel: (_state, reason) => {this.preview.set(null); this.cancelled.set(reason)},
    })
    initialize(): void {this.watch(this.position, this.preview, this.commits, this.clicks, this.cancelled)}
    render(): CapillaryUiChild {
        const Host = this.Host, point = this.preview.get() ?? this.position.get()
        return <Host><div style={{position: 'relative', blockSize: '240px', inlineSize: 'min(600px, 100%)', border: '1px solid'}}>
            <article tabIndex={0} aria-label="Draggable object" style={{position: 'absolute', left: `${point.x}px`, top: `${point.y}px`, padding: '.4rem', border: '1px solid'}}
                onKeyDown={(event: KeyboardEvent) => {
                    if (event.target !== event.currentTarget || event.key !== 'ArrowRight') return
                    event.preventDefault(); this.position.set({...this.position.get(), x: this.position.get().x + 10})
                }}>
                <span className="fixture-grip" aria-hidden="true" style={{display: 'inline-flex', padding: '.5rem', cursor: 'grab', touchAction: 'none'}}
                    onPointerDown={(event: PointerEvent) => {
                        const element = (event.currentTarget as HTMLElement).closest<HTMLElement>('article')!
                        element.focus(); this.drag.begin(event, {kind: 'move', ...this.position.get()}, element)
                    }}><Icon name="grip"/></span>Object
                <span style={{touchAction: 'none'}} onPointerDown={(event: PointerEvent) => {
                    const element = (event.target as HTMLElement).closest<HTMLButtonElement>('button')!
                    element.focus(); this.drag.begin(event, {kind: 'connect', ...this.position.get()}, element)
                }}><Button icon="add" ariaLabel="Drag or open connection" onClick={event => {
                    if (!this.drag.consumeClick(event)) this.clicks.set(this.clicks.get() + 1)
                }}/></span>
            </article>
        </div>
        <output aria-label="Drag accepted position">{JSON.stringify(this.position.get())}</output>
        <output aria-label="Drag preview">{this.preview.get() ? 'Preview' : 'None'}</output>
        <output aria-label="Drag commits">{this.commits}</output>
        <output aria-label="Connection clicks">{this.clicks}</output>
        <output aria-label="Drag cancellation">{this.cancelled}</output>
        <Button onClick={() => this.drag.cancel('context-changed')}>Replace drag context</Button>
        </Host>
    }
    onDestroy(): void {
        this.drag.dispose()
        this.position.dispose(); this.preview.dispose(); this.commits.dispose(); this.clicks.dispose(); this.cancelled.dispose()
    }
}
