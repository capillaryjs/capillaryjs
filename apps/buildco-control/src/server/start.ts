import {startDummyServer} from "../transport/node/server.js";
import {ConstructionScenario} from "./scenario.ts";
import {DEFAULT_SCENARIO} from "../generator/generate.ts";
import type {ScenarioGenerationOptions} from "../domain/model.ts";

const envProfile = process.env.BUILDCO_PROFILE;
const profile: ScenarioGenerationOptions["profile"] = envProfile === "small" || envProfile === "demo" || envProfile === "stress" ? envProfile : DEFAULT_SCENARIO.profile;
const scenario = await ConstructionScenario.create({...DEFAULT_SCENARIO, profile});
const server = await startDummyServer({scenario, port: Number(process.env.BUILDCO_PORT ?? 4176)});
console.log(`BuildCo scenario API: ${server.origin}. Open the UI with ?transport=http.`);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
    void server.close().then(() => process.exit(0));
});
