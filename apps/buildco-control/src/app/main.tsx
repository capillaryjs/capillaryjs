import type {FrayChild} from "@sylwellsoftware/fray";
import {
    createFrayRuntime,
    FrayApp,
    mountFrayApp,
    NavigationBar,
    replaceFrayStylesheet,
    RouteOutlet,
    routeTarget,
} from "@sylwellsoftware/fray";
import "@sylwellsoftware/fray/themes/base.css";
import "../styles/styles.css";
import {ProjectsDemoView, TeamsDemoView} from "../views/index.tsx";
import {bootstrap, demo} from "./services.ts";
import {demoRoutes, router} from "./routing.ts";
import {palettes, themes} from "./appearance.ts";

class BuildCoApp extends FrayApp {
    static dependencies = [NavigationBar, RouteOutlet, ProjectsDemoView, TeamsDemoView];

    initialize(): void {
        void bootstrap.activate();
    }

    protected renderContent(): FrayChild {
        return <>
            <a className="skip-link" href="#main-content">Skip to content</a>
            <header className="app-header island fray-size-natural">
                <div className="brand-row">
                    <span className="brand">
                        <span className="brand-mark" aria-hidden="true">B<span>c</span></span>
                        <span>BuildCo <b>Control</b><small>CONSTRUCTION OPERATIONS</small></span>
                    </span>
                    <div className="header-meta"><span className="live-dot"/>Operational workspace<span
                        className="profile-avatar" title="Demo workspace">BC</span></div>
                </div>
                <NavigationBar
                    allocation="natural"
                    label="Application sections"
                    items={[
                        {id: "projects-demo", label: "Projects", to: routeTarget(demoRoutes.projects)},
                        {id: "teams-demo", label: "Teams", to: routeTarget(demoRoutes.teams)},
                    ]}
                />
            </header>
            <main id="main-content" className="fray-size-flexible fray-layout-vertical" tabIndex={-1}>
                <RouteOutlet
                    className="fray-size-flexible fray-layout-vertical"
                    mountPolicy="active-only"
                    views={[
                        {id: "projects-demo", route: demoRoutes.projects, content: <ProjectsDemoView/>},
                        {id: "teams-demo", route: demoRoutes.teams, content: <TeamsDemoView/>},
                    ]}
                />
            </main>
            <footer className="app-footer island fray-size-natural"><span>BuildCo Control <span
                className="muted">/ Connected construction operations</span></span><span>Deterministic demo · All costs in DKK · Working-day schedules</span>
            </footer>
        </>;
    }
}

replaceFrayStylesheet("theme", themes.find(t => t.value === demo.theme.get()) ?? themes.find(t => t.value === "shiny")!);
replaceFrayStylesheet("colors", palettes.find(t => t.value === demo.palette.get()) ?? palettes.find(t => t.value === "iceblue")!);
mountFrayApp(createFrayRuntime({router}), BuildCoApp, document.getElementById("app")!, {
    sizing: "viewport",
    layout: "vertical",
    landmark: "none",
});
