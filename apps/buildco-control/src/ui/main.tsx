import { Button, Checkbox, ColorPicker, Component, DataTable, DescriptionList, Dialog, Dropdown, FilterPanel, FrayApp, GroupPanel, ListView, NavigationBar, Panel, ProgressBar, QuadCheckbox, RadioGroup, RouteOutlet, Sidebar, SplitView, TabPanel, Textbox, ThemePicker, Toggle, Toolbar, TreeView, TriCheckbox, createFrayRuntime, live, mountFrayApp, replaceFrayStylesheet, routeTarget } from "@sylwellsoftware/fray";
import type { FrayChild } from "@sylwellsoftware/fray";
import { BlockGraph, CategoryHidePanel, LineGraph, SplitSelectionPanel } from "@sylwellsoftware/fray-visualization";
import "@sylwellsoftware/fray/themes/base.css";
import "./styles.css";
import { SCREENS, human } from "../app/contract.ts";
import { bootstrap, demo, flags, reset, router, routes, transport } from "./session.ts";
import { themes, palettes } from "./appearance.ts";
import { screenViews } from "./screens/index.tsx";

const labels = ["Overview", "Projects", "Planning", "Work queue", "Resources", "Issues & delays", "Analytics"];
class DemoControls extends Component {
  private check(key: "disabled" | "required" | "error", label: string): FrayChild { return <Checkbox valueEmitter={demo[key]} symbols={[["☐", "off"], ["✓", "on"]]} label={label} />; }
  render(): FrayChild {
    const state = this.snapshot(reset), b = this.read(bootstrap), notice = this.read(demo.notice);
    return <aside className="demo-controls" aria-label="Demo controls"><Panel island><details><summary><span><strong>Demo controls</strong><span className="muted">Theme, data, and component states</span></span><span className="demo-context">{transport === "embedded" ? "Embedded worker" : "HTTP service"} · Seed {b?.metadata.seed ?? "18431"} · {b?.projects.length ?? "…"} projects</span></summary>
      <div className="harness-grid"><section><h3>Appearance</h3><ThemePicker label="Theme" valueEmitter={demo.theme} options={themes} onChange={value => localStorage.setItem("buildco-theme", value)} /><ColorPicker label="Palette" valueEmitter={demo.palette} options={palettes} onChange={value => localStorage.setItem("buildco-palette", value)} /></section>
      <section><h3>Result state</h3><Dropdown label="Fetch state" valueEmitter={demo.mode} options={["live", "initial", "loading", "ready", "error"].map(value => ({ value, label: human(value) }))} /><RadioGroup label="Previous value" valueEmitter={demo.previous} options={[["keep", "Preserve"], ["clear", "Clear"]]} /></section>
      <section><h3>Control state</h3>{this.check("disabled", "Disabled")}{this.check("required", "Required")}{this.check("error", "Validation error")}<p className="muted">Only the application content is affected. These controls remain usable.</p></section>
      <section><h3>Scenario</h3><Textbox label="Scenario seed" valueEmitter={demo.seed} type="number" /><Dropdown label="Dataset size" valueEmitter={demo.profile} options={[{ value: "small", label: "Small · 5 projects" }, { value: "demo", label: "Demo · 40 projects" }]} />
        <Button label="Regenerate / reset edits" busy={live(reset.isRunning)} disabled={state.fetchState === "loading"} onClick={() => { const seed = Number(demo.seed.get()); if (!Number.isSafeInteger(seed)) { demo.notice.set("Enter a valid integer seed."); return; } void reset.run({ seed, profile: demo.profile.get() }); }} /><p className="muted">Resets in-memory edits using this seed.</p>
      </section></div>
      {state.fetchState === "error" && <p role="alert" className="fetch-notice error">{String(state.error)}</p>}
    </details>{notice && <div className="command-notice" role="status">{notice}<Button label="Dismiss" onClick={() => demo.notice.set("")} /></div>}</Panel></aside>;
  }
}
class BuildCoApp extends FrayApp {
  static dependencies = [NavigationBar, RouteOutlet, Panel, Sidebar, SplitView, TabPanel, TreeView, ListView, DataTable, Textbox, Dropdown, Checkbox, TriCheckbox, QuadCheckbox, FilterPanel, GroupPanel, RadioGroup, Toggle, Toolbar, Button, DescriptionList, ProgressBar, Dialog, ThemePicker, ColorPicker, BlockGraph, LineGraph, CategoryHidePanel, SplitSelectionPanel];
  initialize(): void { void bootstrap.activate(); }
  private readonly views = SCREENS.map(screen => ({ id: screen, route: routes[screen], content: screenViews[screen] }));
  protected renderContent(): FrayChild {
    const b = this.snapshot(bootstrap), disabled = this.read(flags.disabled);
    return <div className="buildco"><a className="skip-link" href="#main-content">Skip to content</a><header className="app-header"><div className="brand-row"><a className="brand" href={router.href(routeTarget(routes.overview))}><span className="brand-mark" aria-hidden="true">B<span>c</span></span><span>BuildCo <b>Control</b><small>CONSTRUCTION OPERATIONS</small></span></a><div className="header-meta"><span className="live-dot" />Operational workspace<span className="profile-avatar" title="Demo workspace">BC</span></div></div>
      <NavigationBar label="Main navigation" items={SCREENS.map((screen, i) => ({ id: screen, label: labels[i]!, to: routeTarget(routes[screen]) }))} />
    </header><main id="main-content" tabIndex={-1}>
      {!b.value && <Panel key="startup" island><div className="startup" role="status"><span className="eyebrow">BuildCo Control</span><h1>{b.fetchState === "error" ? "The scenario could not be loaded" : "Preparing your operational workspace"}</h1><p>{b.fetchState === "error" ? String(b.error) : "Generating projects, crews, materials, and their connected histories. The full demo may take about 30 seconds."}</p>{b.fetchState === "error" ? <Button label="Retry startup" onClick={() => void bootstrap.retry()} /> : <ProgressBar label="Preparing scenario" valueEmitter={demo.progress} />}</div></Panel>}
      <div key="workspace" hidden={!b.value}><fieldset className="workspace-fieldset" disabled={disabled} inert={disabled}><legend className="sr-only">Construction workspace</legend><RouteOutlet initialActiveViewId="overview" mountPolicy="active-only" views={this.views} /></fieldset></div>
      <DemoControls key="demo-controls" />
    </main><footer className="app-footer"><span>BuildCo Control <span className="muted">/ Connected construction operations</span></span><span>Deterministic demo · All costs in DKK · Working-day schedules</span></footer></div>;
  }
}
replaceFrayStylesheet("theme", themes.find(t => t.value === demo.theme.get()) ?? themes[0]!);
replaceFrayStylesheet("colors", palettes.find(t => t.value === demo.palette.get()) ?? palettes[3]!);
mountFrayApp(createFrayRuntime({ router }), BuildCoApp, document.getElementById("app")!, { sizing: "viewport-width", landmark: "none" });
