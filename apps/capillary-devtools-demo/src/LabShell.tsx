import {CapillaryUiApp} from '@capillaryjs/capillary-ui'
import {devtoolsDiagnosticScope} from '@capillaryjs/capillary-devtools/model'

/** One themed DOM boundary, with stable slots for independently scoped runtimes. */
export class LabShell extends CapillaryUiApp {
    static override diagnosticScope = devtoolsDiagnosticScope
    applicationTarget: HTMLElement | null = null
    inspectorTarget: HTMLElement | null = null

    protected override renderContent() {
        return <>
            <header className="lab-header">
                <p>CAPILLARY DEVTOOLS / CAUSAL FLOW LAB</p>
                <h1>Follow the whole story.</h1>
                <nav aria-label="Demo composition">{[
                    ['Workbench', './index.html'], ['Compact view', './compact.html'],
                    ['Bounded capture', './index.html?limit=12'], ['Late capture', './index.html?late=1'],
                ].map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
            </header>
            <div ref={(element: HTMLElement | null) => this.applicationTarget = element} />
            <div ref={(element: HTMLElement | null) => this.inspectorTarget = element} />
        </>
    }
}
