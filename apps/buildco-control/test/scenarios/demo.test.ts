import assert from "node:assert/strict";
import { test } from "node:test";
import { generateScenario, analyzeScenario, assessScenarioCoverage } from "../../src/index.ts";

test("normal demo has all causal archetypes and completed, active and future cohorts", async () => {
  const data = await generateScenario();
  const analysis = analyzeScenario(data);
  assert.equal(data.projects.length, 40);
  assert.ok(data.phasePlans.length >= 7000);
  assert.ok(data.scopeNodes.length >= 1500);
  assert.deepEqual(assessScenarioCoverage(data, data.metadata.anchorDate, analysis).missing, []);
  assert.deepEqual(Object.fromEntries(["completed", "active", "planned"].map(status =>
    [status, analysis.projects.filter(p => p.status === status).length])), { completed: 8, active: 24, planned: 8 });
});
