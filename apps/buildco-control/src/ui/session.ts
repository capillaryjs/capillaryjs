import type {LiveQuery, ReadableEmitter} from "@sylwellsoftware/glue";
import {AsyncCommand, DerivedEmitter, Emitter, FetchState} from "@sylwellsoftware/glue";
import type {Key, TableFilters, TableSort} from "@sylwellsoftware/fray";
import {
  createBrowserRouter,
  createHashNavigation,
  defineRoute,
  routeTarget,
  withRouteQuery
} from "@sylwellsoftware/fray";
import type {Bootstrap, Mutation, Parameters, Row, Screen} from "../app/contract.ts";
import {SCREENS} from "../app/contract.ts";
import type {ScenarioFetch} from "../transport/contract.js";
import {BuildcoService} from "../services/buildcoService.ts";

const initial = new URLSearchParams(location.search);
export const transport = initial.get("transport") === "http" ? "http" : "embedded";
const initialProfile = initial.get("profile");
const defaultProfile: "small" | "demo" | "stress" = initialProfile === "demo" || initialProfile === "stress" ? initialProfile : "small";

const pending = new Map<number, {
    resolve: (value: { status: number; body: unknown }) => void;
    reject: (error: Error) => void
}>();
let sequence = 0;
const worker = transport === "embedded" ? new Worker(new URL("./scenario.worker.ts", import.meta.url), {type: "module"}) : undefined;
if (worker) {
    worker.onmessage = ({data}: MessageEvent<{
        id: number;
        status: number;
        body: unknown;
        error?: string;
        progress?: number
    }>) => {
        if (data.progress !== undefined) {
            demo.progress.set(data.progress);
            return;
        }
        const request = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) request?.reject(new Error(data.error)); else request?.resolve(data);
    };
    worker.onerror = event => {
        for (const request of pending.values()) request.reject(new Error(event.message || "Scenario worker failed"));
        pending.clear();
    };
}
export const apiFetch: ScenarioFetch = async (url, init = {}) => {
    if (!worker) {
        const response = await fetch(url, {...init, signal: init.signal as AbortSignal | undefined});
        return {ok: response.ok, status: response.status, headers: {}, json: () => response.json()};
    }
    const id = ++sequence;
    const response = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const abort = (): void => {
            pending.delete(id);
            worker.postMessage({id, cancel: true});
            reject(new DOMException("Request cancelled", "AbortError"));
        };
        if (init.signal?.aborted) {
            abort();
            return;
        }
        pending.set(id, {
            resolve: v => {
                init.signal?.removeEventListener?.("abort", abort);
                resolve(v);
            }, reject: e => {
                init.signal?.removeEventListener?.("abort", abort);
                reject(e);
            }
        });
        init.signal?.addEventListener?.("abort", abort, {once: true});
        const {signal: _signal, ...serializable} = init;
        worker.postMessage({id, url, init: serializable, profile: demo.profile.get()});
    });
    return {ok: response.status < 400, status: response.status, headers: {}, json: async () => response.body};
};
// Keep the adapter's comparison point current after programmatic push/replace.
// Otherwise returning to the original hash can be mistaken for an unchanged URL.
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
export const revision = new Emitter(0);
const buildco = new BuildcoService(apiFetch);
export {buildco};
export const bootstrap = buildco.bootstrap();
export const demo = {
    mode: new Emitter("live"),
    previous: new Emitter("keep"),
    disabled: new Emitter("off"),
    required: new Emitter("off"),
    error: new Emitter("off"),
    theme: new Emitter(localStorage.getItem("buildco-theme") || "minimal"),
    palette: new Emitter(localStorage.getItem("buildco-palette") || "ocean"),
    seed: new Emitter("18431"),
    profile: new Emitter(defaultProfile),
    notice: new Emitter(""),
    progress: new Emitter<number | null>(null),
};
export const flags = {
    disabled: demo.disabled.map(v => v === "on"),
    required: demo.required.map(v => v === "on"),
    error: demo.error.map(v => v === "on" ? "Demonstration validation error" : null),
};
export const reset = new AsyncCommand<{ seed: number; profile: string }, Bootstrap>({
    concurrency: "reject", execute: async args => {
        demo.progress.set(0);
        const result = await buildco.reset(args);
        for (const state of Object.values(screens)) {
            state.selection.set(null);
            state.scope.set(null);
            state.expanded.set([]);
            for (const key of ["project", "scope", "phase", "selected", "material", "person", "supplier", "trade"]) state.field(key).set(key === "project" && state.screen === "projects" ? result.projects.find(p => p.status === "active")?.id ?? "" : "");
        }
        await bootstrap.refresh();
        revision.set(revision.get() + 1);
        demo.notice.set("Scenario regenerated. In-memory edits were reset.");
        demo.progress.set(null);
        return result;
    }
});
export const mutate = new AsyncCommand<Mutation, { id: string; message: string }>({
    concurrency: "reject", execute: async args => {
        const result = await buildco.mutate(args);
        revision.set(revision.get() + 1);
        void bootstrap.refresh();
        demo.notice.set(result.message);
        return result;
    }
});

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

export function forceResult<T>(source: LiveQuery<T, {
    params: ReadableEmitter<Parameters>;
    revision: ReadableEmitter<number>
}>) {
    return new DerivedEmitter([source, demo.mode, demo.previous] as const, ([value, mode, previous]) => mode !== "live" && mode !== "ready" && previous === "clear" ? undefined : value,
        {computeFetchState: states => demo.mode.get() === "live" ? states[0]! : demo.mode.get() as typeof FetchState[keyof typeof FetchState]});
}
