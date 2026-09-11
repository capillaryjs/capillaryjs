import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { generateScenario } from "../demo-support/scenario/generate.ts";
import { validateScenario } from "../demo-support/scenario/validate.ts";
import { analyzeScenario, costLabour } from "../src/domain/projections.ts";
import { scenarioAtDate } from "../src/domain/snapshot.ts";
import { civilDate, dateOf } from "../src/domain/calendar.ts";
import { sum } from "../src/domain/collections.ts";
import type { LabourEntry, ScenarioData, ScenarioGenerationOptions } from "../src/domain/model.ts";

const options: ScenarioGenerationOptions = { seed: 18431, anchorDate: "2026-09-01", profile: "small" };
const data = await generateScenario(options);
const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("default small corpus contains completed, active and future projects with supporting records", () => {
  const snapshot = scenarioAtDate(data, data.metadata.anchorDate);
  const complete = snapshot.projects.find(p => p.status === "completed");
  assert.ok(complete, "historical cohort must actually finish");
  assert.ok(snapshot.projects.some(p => p.status === "active"));
  const future = snapshot.projects.find(p => p.status === "planned");
  assert.ok(future);
  assert.ok(future.plannedStart > data.metadata.anchorDate);
  assert.equal(snapshot.labourEntries.some(e => e.projectId === future.id), false);
  for (const phase of snapshot.phasePlans.filter(p => p.projectId === complete.id)) {
    assert.ok(snapshot.progressReports.some(r => r.phasePlanId === phase.id && r.executionStatus === "complete" && r.percentComplete === 100));
  }
  assert.ok(snapshot.labourEntries.length > 1000);
  assert.ok(snapshot.phaseDependencies.some(d => d.type === "finishToFinish"));
  assert.ok(snapshot.phaseDependencies.some(d => d.type === "startToStart"));
});

test("same configuration replays byte-identically without platform randomness", async () => {
  const original = Math.random;
  try {
    Math.random = () => { throw new Error("Unseeded randomness"); };
    assert.equal(digest(await generateScenario(options)), digest(data));
  } finally { Math.random = original; }
});

test("extending simulation does not change the anchor-date execution or derived state", async () => {
  const extended = await generateScenario({ ...options, simulationMonthsAfterAnchor: 3 });
  const earlier = scenarioAtDate(data, data.metadata.anchorDate);
  const replay = scenarioAtDate(extended, data.metadata.anchorDate);
  assert.equal(digest({ ...earlier, metadata: undefined }), digest({ ...replay, metadata: undefined }));
  assert.deepEqual(analyzeScenario(data), analyzeScenario(extended));
  assert.ok(extended.labourEntries.some(e => e.workDate > data.metadata.anchorDate));
  validateScenario(replay);
  assert.throws(() => scenarioAtDate(earlier, civilDate("2026-09-02")), /Snapshot date/);
});

test("future actuals, resolutions, deliveries and delay totals cannot leak into older views", () => {
  const cutoff = civilDate("2026-08-03");
  const snapshot = scenarioAtDate(data, cutoff);
  assert.ok(snapshot.labourEntries.every(e => e.workDate <= cutoff));
  assert.ok(snapshot.deliveries.every(d => dateOf(d.deliveredAt) <= cutoff));
  assert.ok(snapshot.progressReports.every(r => dateOf(r.reportedAt) <= cutoff));
  assert.ok(snapshot.issues.every(i => !i.resolvedAt || dateOf(i.resolvedAt) <= cutoff));
  assert.ok(snapshot.delayEvents.every(d => !d.endedAt || dateOf(d.endedAt) <= cutoff));
  for (const d of snapshot.delayEvents) assert.equal(d.estimatedLostHours,
    sum(snapshot.delayImpactReports.filter(r => r.delayEventId === d.id), r => r.estimatedLostHours));
  validateScenario(snapshot);
});

test("overtime crosses projects within an ISO week and uses each entry's effective rate", () => {
  const person = data.people[0]!;
  const project1 = data.projects[0]!, project2 = data.projects[1]!;
  const make = (id: string, date: string, hours: number, project = project1): LabourEntry => ({
    id: id as LabourEntry["id"], personId: person.id, projectId: project.id,
    phasePlanId: data.phasePlans.find(p => p.projectId === project.id)!.id, workDate: civilDate(date), hours, activityReason: "plannedWork" });
  const fixture = { ...data, people: [{ ...person, nominalHoursPerWeek: 37 }], labourEntries: [
    make("labour-c", "2026-08-28", 8, project2), make("labour-a", "2026-08-24", 24), make("labour-b", "2026-08-27", 8), make("labour-d", "2026-08-31", 8),
  ] };
  const costed = costLabour(fixture);
  assert.equal(costed[2]!.regularHours, 5); assert.equal(costed[2]!.overtimeHours, 3);
  assert.equal(costed[3]!.overtimeHours, 0);
  const rate = data.personnelCostRates.find(r => r.personId === person.id && r.validFrom <= "2026-08-28" && !r.validTo)!;
  assert.equal(costed[2]!.totalCost, 5 * rate.regularHourlyCost + 3 * rate.overtimeHourlyCost);
});

test("issue and project costs reconcile to resource facts without counting attribution twice", () => {
  const analysis = analyzeScenario(data);
  const costly = [...analysis.issueCosts].find(([, cost]) => cost > 1000);
  assert.ok(costly);
  const [issueId, issueCost] = costly;
  const labourCost = sum(analysis.labour.filter(l => l.entry.issueId === issueId), l => l.totalCost);
  const materialCost = sum(data.materialUsageEntries.filter(m => m.issueId === issueId), m => m.quantity * m.unitCostApplied);
  const otherCost = sum(data.otherCostEntries.filter(o => o.issueId === issueId), o => o.amount);
  assert.ok(Math.abs(issueCost - labourCost - materialCost - otherCost) < 0.001);
  const allFacts = sum(analysis.labour, l => l.totalCost) + sum(data.materialUsageEntries, m => m.quantity * m.unitCostApplied) + sum(data.otherCostEntries, o => o.amount);
  assert.ok(Math.abs(sum(analysis.projects, p => p.actualCost) - allFacts) < 0.001);
  assert.ok(analysis.labour.some(l => l.overtimeHours > 0));
  assert.ok(data.labourEntries.some(l => l.activityReason === "defectResolution" && l.issueId));
  assert.ok(data.deliveryLines.some(d => d.quantityRejected > 0));
});

test("validator rejects corrupt references, impossible labour, inventory, progress and dependency cycles", () => {
  const invalidReference: ScenarioData = { ...data, labourEntries: [{ ...data.labourEntries[0]!, personId: "person-missing" as LabourEntry["personId"] }] };
  assert.throws(() => validateScenario(invalidReference), /invalid reference/);
  assert.throws(() => validateScenario({ ...data, labourEntries: data.labourEntries.map((l, i) => i === 0 ? { ...l, hours: 30 } : l) }), /hours/);
  assert.throws(() => validateScenario({ ...data, materialUsageEntries: data.materialUsageEntries.map((m, i) => i === 0 ? { ...m, quantity: 1e9 } : m) }), /negative material inventory/);
  assert.throws(() => validateScenario({ ...data, materialUsageEntries: data.materialUsageEntries.map((m, i) => i === 0 ? { ...m, unitCostApplied: 1e9 } : m) }), /material valuation/);
  assert.throws(() => validateScenario({ ...data, progressReports: data.progressReports.map((r, i) => i === 0 ? { ...r, percentComplete: 101 } : r) }), /progress/);
  const dep = data.phaseDependencies[0]!;
  assert.throws(() => validateScenario({ ...data, phaseDependencies: [...data.phaseDependencies, { ...dep, id: "dependency-cycle" as typeof dep.id,
    predecessorPhaseId: dep.successorPhaseId, successorPhaseId: dep.predecessorPhaseId }] }), /cycle/);
});

test("additional seeds preserve structural invariants and input errors fail early", async () => {
  for (const seed of [0, 42, 0xffffffff]) {
    const world = await generateScenario({ ...options, seed, projectCount: 3 });
    assert.notEqual(digest(world), digest(data));
    assert.ok(world.projects.some(p => p.status === "completed"));
  }
  for (const overrides of [{ seed: -1 }, { projectCount: 0 }, { simulationMonthsBeforeAnchor: 0 }, { simulationMonthsAfterAnchor: -1 }, { anchorDate: "2026-02-30" }]) {
    await assert.rejects(generateScenario({ ...options, ...overrides }));
  }
});

test("generation is timezone-independent across DST and ISO-year boundaries", () => {
  const script = `import { generateScenario } from './demo-support/scenario/generate.ts'; import { createHash } from 'node:crypto';
    const d = await generateScenario({ seed: 7, anchorDate: '2026-01-02', profile: 'small', projectCount: 1 });
    console.log(createHash('sha256').update(JSON.stringify(d)).digest('hex'));`;
  const hashes = ["UTC", "Europe/Copenhagen", "America/Los_Angeles"].map(TZ => execFileSync(process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8", env: { ...process.env, TZ } }).trim());
  assert.equal(new Set(hashes).size, 1);
});
