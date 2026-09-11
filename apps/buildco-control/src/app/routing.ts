import type {Key, TableFilters, TableSort} from "@sylwellsoftware/fray";
import {
  createBrowserRouter,
  createHashNavigation,
  defineRoute,
  routeTarget,
  withRouteQuery
} from "@sylwellsoftware/fray";
import {Emitter} from "@sylwellsoftware/glue";
import type {Parameters, Row, Screen} from "../api/ScenarioApi.ts";
import {SCREENS} from "../api/ScenarioApi.ts";

const hash = createHashNavigation();
let observedLocation = hash.read();
export const router = createBrowserRouter({
    adapter: {
        read: () => hash.read(), href: target => hash.href(target),
        push: target => {
            hash.push(target);
            observedLocation = hash.read();
        },
        replace: target => {
            hash.replace(target);
            observedLocation = hash.read();
        },
        subscribe: listener => {
            const changed = (): void => {
                const next = hash.read();
                if (next !== observedLocation) {
                    observedLocation = next;
                    listener();
                }
            };
            window.addEventListener("popstate", changed);
            window.addEventListener("hashchange", changed);
            return () => {
                window.removeEventListener("popstate", changed);
                window.removeEventListener("hashchange", changed);
            };
        },
    }
});
export const routes = Object.fromEntries(SCREENS.map(s => [s, defineRoute(s, s)])) as Record<Screen, ReturnType<typeof defineRoute>>;

const defaults: Record<Screen, Parameters> = {
    overview: {scope: "all"},
    projects: {tab: "summary"},
    planning: {focus: "2026-09-01", horizon: "30", view: "upcoming", critical: "off"},
    queue: {},
    resources: {tab: "people", overtime: "neutral", group: "name"},
    issues: {tab: "issues"},
    analytics: {tab: "distribution", subject: "phases", metric: "progress", days: "90"},
};

/** Long-lived values are user intent only; result records remain query-owned. */
export class ScreenState {
    readonly fields = new Map<string, Emitter<string>>();
    readonly params = new Emitter<Parameters>({});
    readonly selection = new Emitter<Row | null>(null);
    readonly sort = new Emitter<TableSort | null>(null);
    readonly filters = new Emitter<TableFilters>({});
    readonly tab = new Emitter<Key | null>(null);
    readonly scope = new Emitter<Key | null>(null);
    readonly expanded = new Emitter<Key[]>([]);

    constructor(readonly screen: Screen) {
        for (const [key, value] of Object.entries(defaults[screen])) this.field(key).set(value);
        this.tab.set(this.field("tab").get() || null);
        this.tab.subscribe(({value}) => {
            if (value !== null) this.field("tab").set(String(value));
            this.field("selected").set("");
            this.selection.set(null);
            if (this.screen === "issues") for (const key of ["status", "cause", "severity", "type", "person", "supplier", "material", "due", "costView"]) this.field(key).set("");
            this.sort.set(null);
            this.filters.set({});
        }, {emitCurrent: false});
        this.scope.subscribe(({value}) => {
            this.field("scope").set(String(value ?? ""));
            this.field("phase").set("");
        }, {emitCurrent: false});
        this.selection.subscribe(({value}) => {
            if (value) this.field(screen === "projects" ? "phase" : "selected").set(value.phaseId && screen === "projects" ? value.phaseId : value.id);
        }, {emitCurrent: false});
        this.sort.subscribe(({value}) => this.field("sort").set(value ? `${value.field}:${value.direction}` : ""), {emitCurrent: false});
        this.filters.subscribe(({value}) => this.field("tableFilters").set(JSON.stringify(value)), {emitCurrent: false});
    }

    field(key: string): Emitter<string> {
        let emitter = this.fields.get(key);
        if (!emitter) {
            emitter = new Emitter("");
            this.fields.set(key, emitter);
            emitter.subscribe(({value}) => {
                this.params.set({
                    ...this.params.get(),
                    [key]: value, ...(key === "page" || key === "selected" || key === "phase" ? {} : {page: "0"})
                });
            }, {emitCurrent: false});
        }
        return emitter;
    }
}

export const screens = Object.fromEntries(SCREENS.map(s => [s, new ScreenState(s)])) as Record<Screen, ScreenState>;

export function navigate(screen: Screen, params: Parameters = {}): void {
    for (const [key, value] of Object.entries(params)) screens[screen].field(key).set(value);
    if (params.tab) screens[screen].tab.set(params.tab);
    void router.navigate(withRouteQuery(routeTarget(routes[screen]), {...screens[screen].params.get(), ...params}));
}

export function openProject(row: Row): void {
    navigate("projects", {
        project: row.projectId ?? row.id,
        scope: row.scopeId ?? "",
        phase: row.phaseId ?? "",
        tab: row.phaseId ? "phases" : "summary"
    });
}
