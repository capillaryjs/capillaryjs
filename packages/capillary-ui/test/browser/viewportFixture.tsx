import {Emitter} from '@capillaryjs/capillary'
import {Button, Component, PanZoomToolbar, PanZoomViewport} from '../../src/index.js'
import type {CapillaryUiChild, PanZoomCamera} from '../../src/index.js'

export class ViewportFixture extends Component {
    static override hostName = 'viewportfixture'
    static override dependencies = [Button, PanZoomViewport, PanZoomToolbar]
    private readonly extraActions = new Emitter(0)
    private readonly camera = new Emitter<PanZoomCamera>({x: 100, y: 50, zoom: 1})
    private readonly context = new Emitter(0)
    private readonly visible = new Emitter(false)
    private readonly fitted = new Emitter<PanZoomCamera | null>(null)
    initialize(): void {this.watch(this.camera, this.context, this.visible, this.fitted, this.extraActions)}
    render(): CapillaryUiChild {
        const Host = this.Host
        return <Host>
            <div dir="rtl" style={{inlineSize: 'min(600px, 100%)'}}>
                <PanZoomViewport label="Fixture canvas" height="300px" worldWidth={1200} worldHeight={800}
                    camera={this.camera.get()} onCameraChange={camera => this.camera.set(camera)} interactionKey={this.context.get()}>
                    <PanZoomToolbar><Button icon="pin" ariaLabel="Pin viewport region" onClick={() => this.extraActions.set(this.extraActions.get() + 1)}/></PanZoomToolbar>
                    <input aria-label="World text" style={{position: 'absolute', left: '200px', top: '150px', width: '120px'}}/>
                    <article aria-label="Viewport child" tabIndex={0} style={{position: 'absolute', left: '300px', top: '200px', width: '100px', height: '80px', border: '1px solid'}}>Child</article>
                    <div style={{position: 'absolute', left: '1000px', top: '700px'}}>Corner</div>
                </PanZoomViewport>
            </div>
            <output aria-label="Viewport camera">{JSON.stringify(this.camera.get())}</output>
            <output aria-label="Viewport extra actions">{this.extraActions}</output>
            <Button onClick={() => this.camera.set({x: 300, y: 150, zoom: 1})}>Replace viewport camera</Button>
            <Button onClick={() => {this.context.set(this.context.get() + 1); this.camera.set({x: 40, y: 60, zoom: 1})}}>Replace viewport context</Button>
            <Button onClick={() => this.visible.set(!this.visible.get())}>Toggle deferred viewport</Button>
            <div hidden={!this.visible.get()} style={{inlineSize: 'min(400px, 100%)'}}>
                <PanZoomViewport label="Deferred canvas" height="240px" worldWidth={1200} worldHeight={800}
                    fitRequest={{key: 1, bounds: {x: 300, y: 200, width: 400, height: 200}}} onCameraChange={camera => this.fitted.set(camera)}>
                    <p style={{position: 'absolute', left: '300px', top: '200px'}}>Deferred content</p>
                </PanZoomViewport>
            </div>
            <output aria-label="Deferred camera">{this.fitted.get() ? JSON.stringify(this.fitted.get()) : 'Pending'}</output>
        </Host>
    }
    onDestroy(): void {this.camera.dispose(); this.context.dispose(); this.visible.dispose(); this.fitted.dispose(); this.extraActions.dispose()}
}
