import type {FrayChild} from "@sylwellsoftware/fray";
import {
    createFrayRuntime,
    FrayApp,
    mountFrayApp,
    NavigationBar,
    replaceFrayStylesheet,
    RouteOutlet,
    routeTarget,
    ThemePicker,
    ColorPicker,
} from "@sylwellsoftware/fray";
import "@sylwellsoftware/fray/themes/base.css";
import "../styles/styles.css";
import {
    OverviewView,
    ProjectsView,
    QueueView,
    OperationsView,
    IssueAnalysisView,
    EconomicTrendsView,
} from "../views/index.tsx";
import {bootstrap, demo} from "./services.ts";
import {routes, router} from "./routing.ts";
import {palettes, themes} from "./appearance.ts";

class BuildCoApp extends FrayApp {
    static dependencies = [
        NavigationBar, RouteOutlet, ThemePicker, ColorPicker,
        OverviewView, ProjectsView, QueueView, OperationsView,
        IssueAnalysisView, EconomicTrendsView,
    ];

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
                        {id: "overview", label: "Overview", to: routeTarget(routes.overview)},
                        {id: "projects", label: "Projects", to: routeTarget(routes.projects)},
                        {id: "queue", label: "Work Queue", to: routeTarget(routes.queue)},
                        {id: "operations", label: "Operations", to: routeTarget(routes.operations)},
                        {id: "issue-analysis", label: "Issue Analysis", to: routeTarget(routes["issue-analysis"])},
                        {id: "economic-trends", label: "Economic Trends", to: routeTarget(routes["economic-trends"])},
                    ]}
                />
            </header>
            <main id="main-content" className="fray-size-flexible fray-layout-vertical" tabIndex={-1}>
                <RouteOutlet
                    className="fray-size-flexible fray-layout-vertical"
                    mountPolicy="active-only"
                    views={[
                        {id: "overview", route: routes.overview, content: <OverviewView/>},
                        {id: "projects", route: routes.projects, content: <ProjectsView/>},
                        {id: "queue", route: routes.queue, content: <QueueView/>},
                        {id: "operations", route: routes.operations, content: <OperationsView/>},
                        {id: "issue-analysis", route: routes["issue-analysis"], content: <IssueAnalysisView/>},
                        {id: "economic-trends", route: routes["economic-trends"], content: <EconomicTrendsView/>},
                    ]}
                />
            </main>
            <footer className="app-footer island fray-size-natural">
                <span>BuildCo Control <span
                    className="muted">/ Connected construction operations</span></span>
                <span className="footer-controls">
                    <ThemePicker label="Theme" valueEmitter={demo.theme} options={themes}/>
                    <ColorPicker label="Palette" valueEmitter={demo.palette} options={palettes}/>
                </span>
                <span>Deterministic demo · All costs in DKK · Working-day schedules</span>
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
