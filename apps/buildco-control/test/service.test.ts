import assert from "node:assert/strict";
import { before, test } from "node:test";
import { ConstructionScenario } from "../src/server/scenario.ts";
import { DEFAULT_SCENARIO } from "../src/generator/generate.ts";
import { createScenarioFetch } from "../src/transport/embedded/createScenarioFetch.ts";
import { matchesConditions, SCREENS } from "../src/app/contract.ts";
import type { Bootstrap, Mutation, Parameters, ViewResult } from "../src/app/contract.ts";

let service: ConstructionScenario;
before(async () => { service = await ConstructionScenario.create({ ...DEFAULT_SCENARIO, profile: "small" }); });
const view = async (screen: string, params: Parameters = {}): Promise<ViewResult> => {
  const response = await service.handle({ method: "GET", url: `/api/view/${screen}?params=${encodeURIComponent(JSON.stringify(params))}` });
  assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body as ViewResult;
};
const command = async (body: Mutation) => await service.handle({ method: "POST", url: "/api/mutate", body });

test("every screen is backed by the same anchor-date scenario", async () => {
  const bootstrap = (await service.handle({ method: "GET", url: "/api/bootstrap" })).body as Bootstrap;
  assert.deepEqual(new Set(bootstrap.projects.map(p => p.status)), new Set(["completed", "active", "planned"]));
  for (const screen of SCREENS) {
    const result = await view(screen); assert.ok(result.total >= 0); assert.ok(result.rows.length <= 30);
  }
  const planned = bootstrap.projects.find(p => p.status === "planned")!;
  assert.equal(planned.progress, 0); assert.equal(planned.cost, 0);
  assert.equal((await view("resources", { tab: "labour", project: planned.id })).total, 0);
});

test("semantic filters implement deny precedence, AND require, and OR prefer", async () => {
  assert.equal(matchesConditions({ a: true, b: true }, { a: "require", b: "deny" }), false);
  assert.equal(matchesConditions({ a: true, b: false }, { a: "require", b: "require" }), false);
  assert.equal(matchesConditions({ a: true, b: false }, { a: "prefer", b: "prefer" }), true);
  assert.equal(matchesConditions({ a: false, b: false }, { a: "prefer", b: "prefer" }), false);
  const result = await view("queue", { conditions: JSON.stringify({ blocked: "require", overBudget: "deny" }) });
  assert.ok(result.total > 0); assert.ok(result.rows.every(r => r.traits?.blocked && !r.traits.overBudget));
});

test("server-side sorting, paging, search, and project scope compose", async () => {
  const first = await view("queue", { sort: "cost:desc" });
  const second = await view("queue", { sort: "cost:desc", page: "1" });
  assert.ok(first.total > 30); assert.ok(Number(first.rows.at(-1)!.cost) >= Number(second.rows[0]!.cost));
  assert.ok(!first.rows.some(r => second.rows.some(s => s.id === r.id)));
  const project = first.rows[0]!.projectId!;
  const rows = await view("projects", { project, tab: "phases" });
  assert.ok(rows.rows.every(r => r.projectId === project));
  const scoped = await view("projects", { project, scope: rows.rows[0]!.scopeId!, tab: "phases" });
  assert.ok(scoped.total <= rows.total);
  assert.ok((await view("queue", { search: "not-a-real-phase-xyz" })).total === 0);
});

test("material quantities retain units and chart categories are complete", async () => {
  const materials = await view("resources", { tab: "materials" });
  assert.ok(materials.rows.every(r => r.unit && Number(r.planned) > 0 && Number(r.delivered) >= 0));
  for (const subject of ["phases", "labour", "materials", "issues", "delays"]) {
    const result = await view("analytics", { subject });
    assert.equal(result.chartItems!.length, result.total);
    assert.ok(result.chartItems!.every(r => typeof r.project === "string" && typeof r.category === "string" && typeof r.classification === "string"));
    assert.equal(new Set(result.chartItems!.map(r => r.id)).size, result.total);
  }
});

test("all history groups return finite, non-future observations", async () => {
  for (const metric of ["progress", "labour", "materials", "quality", "schedule", "cost"]) {
    const result = await view("analytics", { tab: "trends", metric, days: "90" });
    assert.ok(result.series!.length >= 2);
    for (const series of result.series!) for (const [date, value] of Object.entries(series.values)) {
      assert.ok(date <= DEFAULT_SCENARIO.anchorDate); assert.ok(Number.isFinite(value));
    }
  }
});

test("create, edit, and resolve update shared records without inventing actual costs", async () => {
  const phase = (await view("queue", { conditions: JSON.stringify({ blocked: "require" }) })).rows[0]!;
  const input: Mutation = { kind: "issue", action: "create", projectId: phase.projectId, phaseId: phase.id, title: "Acceptance test defect", severity: "high", estimatedCost: 4000 };
  assert.equal((await command({ ...input, title: "x" })).status, 400);
  assert.equal((await command({ ...input, estimatedCost: -1 })).status, 400);
  const response = await command(input); assert.equal(response.status, 200);
  const id = (response.body as { id: string }).id;
  let issue = await view("issues", { selected: id, search: "Acceptance test defect" });
  assert.equal(issue.total, 1); assert.equal(issue.rows[0]!.cost, 0); assert.equal(issue.detail!.record!.estimate, 4000);
  assert.equal((await command({ ...input, action: "edit", id, title: "Updated acceptance defect", estimatedCost: 5000 })).status, 200);
  assert.equal((await command({ kind: "issue", action: "resolve", id })).status, 200);
  issue = await view("issues", { search: "Updated acceptance defect" }); assert.equal(issue.rows[0]!.status, "resolved");
  const delay = await command({ kind: "delay", action: "create", projectId: phase.projectId, phaseId: phase.id, title: "Acceptance site hold", lostHours: 8, impactDays: 2 });
  assert.equal(delay.status, 200); const delayId = (delay.body as { id: string }).id;
  assert.equal((await view("issues", { tab: "delays", selected: delayId, search: "Acceptance site hold" })).detail!.record!.hours, 8);
  assert.equal((await command({ kind: "delay", action: "resolve", id: delayId })).status, 200);
  assert.equal((await view("issues", { tab: "delays", search: "Acceptance site hold" })).rows[0]!.status, "ended");
});

test("embedded transport matches direct responses and supports cancellation", async () => {
  const fetch = createScenarioFetch({ scenario: service });
  const url = "/api/view/overview", response = await fetch(url);
  assert.deepEqual(await response.json(), (await service.handle({ method: "GET", url })).body);
  const controller = new AbortController(), pending = fetch(url, { signal: controller.signal }); controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
