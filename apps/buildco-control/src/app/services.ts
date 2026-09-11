import type {LiveQuery, ReadableEmitter} from "@sylwellsoftware/glue";
import {AsyncCommand, DerivedEmitter, Emitter, FetchState} from "@sylwellsoftware/glue";
import type {Bootstrap, Mutation, Parameters} from "../api/ScenarioApi.ts";
import type {ScenarioFetch} from "../api/ScenarioFetch.js";
import {BuildcoService} from "../services/BuildcoService.ts";
import {screens} from "./routing.ts";

const initial = new URLSearchParams(location.search);
export const transport = initial.get("transport") === "http" ? "http" : "embedded";
const initialProfile = initial.get("profile");
const defaultProfile: "small" | "demo" | "stress" = initialProfile === "demo" || initialProfile === "stress" ? initialProfile : "small";

const pending = new Map<number, {
    resolve: (value: { status: number; body: unknown }) => void;
    reject: (error: Error) => void
}>();
let sequence = 0;
const worker = transport === "embedded" ? new Worker(new URL("../../demo-support/worker/scenario.worker.ts", import.meta.url), {type: "module"}) : undefined;
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

export function forceResult<T>(source: LiveQuery<T, {
    params: ReadableEmitter<Parameters>;
    revision: ReadableEmitter<number>
}>) {
    return new DerivedEmitter([source, demo.mode, demo.previous] as const, ([value, mode, previous]) => mode !== "live" && mode !== "ready" && previous === "clear" ? undefined : value,
        {computeFetchState: states => demo.mode.get() === "live" ? states[0]! : demo.mode.get() as typeof FetchState[keyof typeof FetchState]});
}
