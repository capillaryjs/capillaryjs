import type {FrayChild} from "@sylwellsoftware/fray";
import {Button, Component, Panel, ProgressBar} from "@sylwellsoftware/fray";
import {bootstrap, demo} from "../../app/session.ts";

export class ShellView extends Component {
    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        return <div className="buildco fray-layout-vertical fray-size-flexible">
            <a className="skip-link" href="#main-content">Skip to content</a>
            <header className="app-header fray-size-natural">
                <div className="brand-row">
                    <span className="brand">
                        <span className="brand-mark" aria-hidden="true">B<span>c</span></span>
                        <span>BuildCo <b>Control</b><small>CONSTRUCTION OPERATIONS</small></span>
                    </span>
                    <div className="header-meta"><span className="live-dot"/>Operational workspace<span
                        className="profile-avatar" title="Demo workspace">BC</span></div>
                </div>
            </header>
            <main id="main-content" className="fray-layout-vertical fray-size-flexible" tabIndex={-1}>
                {!b.value && <Panel key="startup" island allocation="natural">
                    <div className="startup" role="status"><span className="eyebrow">BuildCo Control</span>
                        <h1>{b.fetchState === "error" ? "The scenario could not be loaded" : "Preparing your operational workspace"}</h1>
                        <p>{b.fetchState === "error" ? String(b.error) : "Generating projects, crews, materials, and their connected histories. The full demo may take about 30 seconds."}</p>{b.fetchState === "error" ?
                            <Button label="Retry startup" onClick={() => void bootstrap.retry()}/> :
                            <ProgressBar label="Preparing scenario" valueEmitter={demo.progress}/>}</div>
                </Panel>}
                {b.value && <Panel key="workspace" island allocation="natural">
                    <p className="muted">Scenario loaded. Operational workspace will appear here.</p>
                </Panel>}
            </main>
            <footer className="app-footer fray-size-natural"><span>BuildCo Control <span
                className="muted">/ Connected construction operations</span></span><span>Deterministic demo · All costs in DKK · Working-day schedules</span>
            </footer>
        </div>;
    }
}
