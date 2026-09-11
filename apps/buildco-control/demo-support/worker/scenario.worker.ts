import {ConstructionScenario} from "../server/ConstructionScenario.ts";
import {DEFAULT_SCENARIO} from "../scenario/generate.ts";
import type {ScenarioGenerationOptions} from "../../src/domain/model.ts";
import {createScenarioFetch} from "../transport/embedded/createScenarioFetch.js";
import type {ScenarioFetch, ScenarioFetchInit} from "../../src/api/ScenarioFetch.js";

let scenarioFetch: ScenarioFetch;
let scenario: ConstructionScenario;
const controllers = new Map<number, AbortController>();

self.onmessage = async (event: MessageEvent<{
    id: number;
    url?: string;
    init?: ScenarioFetchInit;
    profile?: string;
    cancel?: boolean
}>) => {
    const {id, url, init, profile, cancel} = event.data;
    if (cancel) {
        controllers.get(id)?.abort();
        return;
    }
    const controller = new AbortController();
    controllers.set(id, controller);
    try {
        scenario ??= await ConstructionScenario.create(
            {
                ...DEFAULT_SCENARIO,
                profile: (profile && ["small", "demo", "stress"].includes(profile) ? profile : DEFAULT_SCENARIO.profile) as ScenarioGenerationOptions["profile"]
            },
            (progress) => self.postMessage({id, progress: Math.round(progress * 100)})
        );
        scenarioFetch ??= createScenarioFetch({
            scenario,
            onProgress: (progress) => self.postMessage({id, progress: Math.round(progress * 100)})
        });
        const response = await scenarioFetch(url!, {...init, signal: controller.signal});
        self.postMessage({id, status: response.status, body: await response.json()});
    } catch (error) {
        self.postMessage({id, error: error instanceof Error ? error.message : String(error)});
    } finally {
        controllers.delete(id);
    }
};
