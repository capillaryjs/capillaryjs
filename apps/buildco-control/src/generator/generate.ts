import type {ScenarioData, ScenarioGenerationOptions} from "../domain/model.ts";
import {scenarioAtDate} from "../domain/snapshot.ts";
import {createPlan} from "./plan.ts";
import {simulate} from "./simulate.ts";
import {validateScenario} from "./validate.ts";

export const DEFAULT_SCENARIO: ScenarioGenerationOptions = {seed: 18431, anchorDate: "2026-09-01", profile: "small"};

export async function generateScenario(options: ScenarioGenerationOptions = DEFAULT_SCENARIO, onProgress?: (progress: number) => void): Promise<ScenarioData> {
    const context = createPlan(options);
    await simulate(context, onProgress);
    const data = scenarioAtDate(context.data, context.data.metadata.simulationEnd);
    data.metadata = context.data.metadata;
    validateScenario(data);
    return data;
}
