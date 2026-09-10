import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, addMonths, addWorkingDays, civilDate, isWorkingDay, isoWeek, workingDaysBetween, workingDaysInclusive, workingOnOrAfter } from "../src/domain/calendar.ts";
import { scheduleBaseline } from "../src/domain/dependencies.ts";
import type { Id, PhaseDependency, PhasePlan, WorkingCalendar } from "../src/domain/model.ts";

const calendar: WorkingCalendar = { id: "calendar-test" as Id<"calendar">, name: "Test", workingDays: [1, 2, 3, 4, 5], regularHoursPerDay: 7.4, holidays: [civilDate("2026-09-07")] };
test("civil-date arithmetic handles leap years, DST dates and month-end clamping", () => {
  assert.throws(() => civilDate("2026-02-29"), /Invalid/);
  assert.throws(() => civilDate("2026-9-01"), /Invalid/);
  assert.equal(addDays(civilDate("2024-02-28"), 1), "2024-02-29");
  assert.equal(addDays(civilDate("2026-03-29"), 1), "2026-03-30");
  assert.equal(addMonths(civilDate("2024-01-31"), 1), "2024-02-29");
  assert.equal(addMonths(civilDate("2026-03-31"), -1), "2026-02-28");
  assert.equal(isoWeek(civilDate("2021-01-01")), "2020-12-28");
});
test("inclusive working dates and dependency lags skip weekends and holidays", () => {
  const friday = civilDate("2026-09-04");
  assert.equal(addWorkingDays(friday, 1, calendar), "2026-09-08");
  assert.equal(addWorkingDays(civilDate("2026-09-08"), -1, calendar), friday);
  assert.equal(workingOnOrAfter(civilDate("2026-09-05"), calendar), "2026-09-08");
  assert.equal(workingDaysInclusive(friday, friday, calendar), 1);
  assert.equal(workingDaysBetween(friday, civilDate("2026-09-08"), calendar), 1);
  assert.throws(() => addWorkingDays(friday, 1, { ...calendar, workingDays: [] }), /Calendar/);
});
test("baseline scheduling supports all three dependency types and rejects cycles", () => {
  const phase = (id: string): PhasePlan => ({ id: id as Id<"phase">, projectId: "project" as Id<"project">,
    projectPlanId: "plan" as Id<"projectPlan">, scopeNodeId: "scope" as Id<"scope">, phaseTypeId: "type" as Id<"phaseType">,
    plannedStart: civilDate("2026-09-04"), plannedFinish: civilDate("2026-09-04"), progressProfile: "linear", progressWeight: 1, priority: "normal" });
  const phases = [phase("a"), phase("b"), phase("c"), phase("d")];
  const dep = (from: number, to: number, type: PhaseDependency["type"], lag = 0): PhaseDependency => ({
    id: `${from}-${to}` as Id<"dependency">, predecessorPhaseId: phases[from]!.id, successorPhaseId: phases[to]!.id, type, lagWorkingDays: lag });
  const deps = [dep(0, 1, "finishToStart"), dep(0, 2, "startToStart", 1), dep(1, 3, "finishToFinish")];
  const durations = new Map(phases.map(p => [p.id, 2]));
  scheduleBaseline(phases, deps, durations, civilDate("2026-09-04"), calendar);
  assert.equal(phases[0]!.plannedFinish, "2026-09-08");
  assert.equal(phases[1]!.plannedStart, "2026-09-09");
  assert.equal(phases[2]!.plannedStart, "2026-09-08");
  assert.equal(phases[3]!.plannedFinish, phases[1]!.plannedFinish);
  assert.throws(() => scheduleBaseline(phases, [...deps, dep(1, 0, "finishToStart")], durations, civilDate("2026-09-04"), calendar), /cycle/);
});

test("calendar week-skipping agrees with day-by-day counting, including non-working start dates", () => {
  for (const workingDays of [[1, 2, 3, 4, 5], [2, 4], [1, 2, 3, 4, 5, 6, 7]]) {
    const sample = { ...calendar, workingDays };
    for (let start = 0; start < 14; start++) for (const offset of [-15, -5, -1, 0, 1, 5, 15]) {
      const from = addDays(civilDate("2026-09-01"), start);
      let expected = from;
      for (let left = Math.abs(offset); left > 0;) {
        expected = addDays(expected, Math.sign(offset));
        if (isWorkingDay(expected, sample)) left--;
      }
      assert.equal(addWorkingDays(from, offset, sample), expected);
    }
  }
});
