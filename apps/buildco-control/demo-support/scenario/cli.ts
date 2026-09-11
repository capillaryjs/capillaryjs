import {parseArgs} from "node:util";
import {DEFAULT_SCENARIO, generateScenario} from "./generate.ts";
import {analyzeScenario, classifyHealth} from "../../src/domain/projections.ts";
import {scenarioAtDate} from "../../src/domain/snapshot.ts";
import {civilDate} from "../../src/domain/calendar.ts";
import {round, sum} from "../../src/domain/collections.ts";
import type {ScenarioGenerationOptions} from "../../src/domain/model.ts";
import {assessScenarioCoverage} from "./coverage.ts";

const {values} = parseArgs({
    options: {
        seed: {type: "string"}, anchor: {type: "string"}, profile: {type: "string", default: "small"},
        projects: {type: "string"}, before: {type: "string"}, after: {type: "string"}, at: {type: "string"},
        json: {type: "boolean", default: false}, help: {type: "boolean", default: false},
    }
});
if (values.help) {
    console.log("pnpm scenario [--profile small|demo|stress] [--seed 18431] [--anchor 2026-09-01] [--projects N] [--before 18] [--after 0] [--at YYYY-MM-DD] [--json]\n--json emits the public scenario snapshot; default output summarizes the anchor-date view.");
} else {
    try {
        const start = performance.now();
        const options: ScenarioGenerationOptions = {
            ...DEFAULT_SCENARIO,
            profile: values.profile as ScenarioGenerationOptions["profile"],
            seed: values.seed === undefined ? DEFAULT_SCENARIO.seed : Number(values.seed),
            anchorDate: values.anchor ?? DEFAULT_SCENARIO.anchorDate,
            projectCount: values.projects === undefined ? undefined : Number(values.projects),
            simulationMonthsBeforeAnchor: values.before === undefined ? undefined : Number(values.before),
            simulationMonthsAfterAnchor: values.after === undefined ? undefined : Number(values.after)
        };
        const corpus = await generateScenario(options);
        const generatedMs = round(performance.now() - start, 1);
        const date = civilDate(values.at ?? options.anchorDate);
        const snapshot = scenarioAtDate(corpus, date);
        if (values.json) console.log(JSON.stringify(snapshot));
        else {
            const analysis = analyzeScenario(corpus, date);
            const traits = analysis.phases.map(classifyHealth);
            console.log(JSON.stringify({
                scenario: snapshot.metadata,
                generationAndValidationMs: generatedMs,
                coverage: assessScenarioCoverage(corpus, date, analysis),
                counts: Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "metadata").map(([key, rows]) => [key, (rows as unknown[]).length])),
                projects: analysis.projects.map(p => ({
                    name: snapshot.projects.find(project => project.id === p.projectId)!.name, ...p,
                    budgetCost: round(p.budgetCost, 2),
                    actualCost: round(p.actualCost, 2),
                    costVariance: round(p.costVariance, 2)
                })),
                phaseConditions: Object.fromEntries(Object.keys(traits[0] ?? {}).map(key => [key, traits.filter(t => t[key as keyof typeof t]).length])),
                totalHours: round(sum(analysis.labour, l => l.entry.hours), 2),
                overtimeHours: round(sum(analysis.labour, l => l.overtimeHours), 2),
            }, null, 2));
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
