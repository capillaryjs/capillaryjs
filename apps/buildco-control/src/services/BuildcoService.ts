import type {EndpointQueryOptions, ReadableEmitter} from "@sylwellsoftware/glue";
import {RestEndpoint} from "@sylwellsoftware/glue";
import type {Bootstrap, Choice, Mutation, Parameters, Screen, ViewResult} from "../api/ScenarioApi.ts";
import {SCREENS} from "../api/ScenarioApi.ts";
import type {ScenarioFetch, ScenarioFetchInit} from "../api/ScenarioFetch.js";

export type ViewQueryEmitters = {
    params: ReadableEmitter<Parameters>;
    revision: ReadableEmitter<number>;
};

export class BuildcoService {
    readonly bootstrapEndpoint: RestEndpoint<Record<string, never>, Bootstrap>;
    readonly viewEndpoints: Record<Screen, RestEndpoint<{ params: Parameters; revision: number }, ViewResult>>;
    readonly choicesEndpoint: RestEndpoint<{ projectId: string }, Record<string, Choice[]>>;
    private readonly fetch: ScenarioFetch;
    private readonly baseUrl: string;

    constructor(fetch: ScenarioFetch, baseUrl: string = location.origin) {
        this.fetch = fetch;
        this.baseUrl = baseUrl;
        this.bootstrapEndpoint = new RestEndpoint<Record<string, never>, Bootstrap>({
            url: "/api/bootstrap",
            baseUrl: this.baseUrl,
            fetch: this.fetch,
            query: {keepPreviousValue: true, execution: "deferred", purpose: "buildco bootstrap"}
        });
        this.viewEndpoints = Object.fromEntries(SCREENS.map(screen => [screen, new RestEndpoint<{
            params: Parameters;
            revision: number
        }, ViewResult>({
            url: `/api/view/${screen}`,
            baseUrl: this.baseUrl,
            fetch: this.fetch,
            serialize: (url, args) => {
                url.searchParams.set("params", JSON.stringify(args.params));
            },
            query: {keepPreviousValue: true, execution: "deferred", purpose: `buildco ${screen} view`}
        })])) as Record<Screen, RestEndpoint<{ params: Parameters; revision: number }, ViewResult>>;
        this.choicesEndpoint = new RestEndpoint<{ projectId: string }, Record<string, Choice[]>>({
            url: "/api/choices",
            baseUrl: this.baseUrl,
            fetch: this.fetch,
            serialize: (url, args) => {
                url.searchParams.set("project", args.projectId);
            },
            query: {purpose: "buildco choices"}
        });
    }

    bootstrap() {
        return this.bootstrapEndpoint.open({});
    }

    view(screen: Screen, args: ViewQueryEmitters, options?: EndpointQueryOptions) {
        return this.viewEndpoints[screen].open(args, options);
    }

    async choices(projectId: string): Promise<Record<string, Choice[]>> {
        return this.choicesEndpoint.handler.fetch({projectId});
    }

    async reset(args: { seed: number; profile: string }): Promise<Bootstrap> {
        return this.post<Bootstrap>("/api/scenario/reset", args);
    }

    async mutate(args: Mutation): Promise<{ id: string; message: string }> {
        return this.post<{ id: string; message: string }>("/api/mutate", args);
    }

    private async post<T>(url: string, body: unknown, init?: ScenarioFetchInit): Promise<T> {
        const response = await this.fetch(url, {
            ...init,
            method: "POST",
            body: JSON.stringify(body),
            headers: {...init?.headers, "content-type": "application/json"}
        });
        const result = await response.json();
        if (!response.ok) throw new Error((result as {
            error?: { message?: string }
        }).error?.message ?? `Request failed (${response.status})`);
        return result as T;
    }
}
