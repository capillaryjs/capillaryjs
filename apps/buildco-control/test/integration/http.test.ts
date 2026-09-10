import assert from "node:assert/strict";
import { test } from "node:test";
import { ConstructionScenario } from "../../src/server/scenario.ts";
import { DEFAULT_SCENARIO } from "../../src/generator/generate.ts";
import { startDummyServer } from "../../src/transport/node/server.ts";
import { createScenarioFetch } from "../../src/transport/embedded/createScenarioFetch.ts";
import type { ViewResult } from "../../src/app/contract.ts";

test("HTTP and embedded adapters expose identical query and mutation contracts", async () => {
  const scenario = await ConstructionScenario.create({ ...DEFAULT_SCENARIO, profile: "small" });
  const embedded = createScenarioFetch({ scenario }), server = await startDummyServer({ scenario, port: 0 });
  try {
    for (const path of ["/api/bootstrap", "/api/view/projects", "/api/view/queue?params=%7B%22sort%22%3A%22variance%3Adesc%22%7D", "/api/view/analytics?params=%7B%22tab%22%3A%22trends%22%7D"]) {
      assert.deepEqual(await (await fetch(server.origin + path)).json(), JSON.parse(JSON.stringify(await (await embedded(path)).json())));
    }
    const phases = await (await embedded("/api/view/queue")).json() as ViewResult, phase = phases.rows[0]!;
    const response = await fetch(`${server.origin}/api/mutate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      kind: "issue", action: "create", projectId: phase.projectId, phaseId: phase.id, title: "HTTP parity issue", estimatedCost: 50,
    }) });
    assert.equal(response.status, 200);
    const issue = await (await embedded('/api/view/issues?params=%7B%22search%22%3A%22HTTP%20parity%20issue%22%7D')).json() as ViewResult;
    assert.equal(issue.total, 1); assert.equal(issue.rows[0]!.cost, 0);
    const invalid = await fetch(`${server.origin}/api/mutate`, { method: "POST", body: "invalid" }); assert.equal(invalid.status, 400);
    assert.equal((await fetch(`${server.origin}/api/missing`)).status, 404);
  } finally { await server.close(); }
});
