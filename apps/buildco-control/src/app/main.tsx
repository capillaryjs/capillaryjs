import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Button,
    createFrayRuntime,
    FrayApp,
    mountFrayApp,
    Panel,
    ProgressBar,
    replaceFrayStylesheet,
} from "@sylwellsoftware/fray";
import "@sylwellsoftware/fray/themes/base.css";
import "../styles/styles.css";
import {ShellView} from "../views/index.tsx";
import {bootstrap, demo} from "./services.ts";
import {palettes, themes} from "./appearance.ts";

class BuildCoApp extends FrayApp {
    static dependencies = [Button, Panel, ProgressBar, ShellView];

    initialize(): void {
        void bootstrap.activate();
    }

    protected renderContent(): FrayChild {
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
                <ShellView/>
            </main>
            <footer className="app-footer fray-size-natural"><span>BuildCo Control <span
                className="muted">/ Connected construction operations</span></span><span>Deterministic demo · All costs in DKK · Working-day schedules</span>
            </footer>
        </div>;
    }
}

replaceFrayStylesheet("theme", themes.find(t => t.value === demo.theme.get()) ?? themes[0]!);
replaceFrayStylesheet("colors", palettes.find(t => t.value === demo.palette.get()) ?? palettes[3]!);
mountFrayApp(createFrayRuntime({}), BuildCoApp, document.getElementById("app")!, {
    sizing: "viewport",
    layout: "vertical",
    landmark: "none",
});
