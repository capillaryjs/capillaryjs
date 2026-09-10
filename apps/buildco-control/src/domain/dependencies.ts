import type { CivilDate, PhaseDependency, PhasePlan, PhasePlanId, WorkingCalendar } from "./model.ts";
import { addWorkingDays, maxDate, workingOnOrAfter } from "./calendar.ts";
import { groupBy } from "./collections.ts";

export function topologicalPhases(phases: readonly PhasePlan[], dependencies: readonly PhaseDependency[]): PhasePlan[] {
  const phasesById = new Map(phases.map(p => [p.id, p]));
  const remaining = new Map(phases.map(p => [p.id, 0]));
  const outgoing = groupBy(dependencies, d => d.predecessorPhaseId);
  for (const d of dependencies) {
    if (!phasesById.has(d.predecessorPhaseId) || !phasesById.has(d.successorPhaseId)) throw new Error(`Unknown dependency endpoint: ${d.id}`);
    if (!Number.isInteger(d.lagWorkingDays) || d.lagWorkingDays < 0) throw new Error(`Invalid dependency lag: ${d.id}`);
    remaining.set(d.successorPhaseId, remaining.get(d.successorPhaseId)! + 1);
  }
  const queue = phases.filter(p => remaining.get(p.id) === 0);
  for (let i = 0; i < queue.length; i++) {
    for (const d of outgoing.get(queue[i]!.id) ?? []) {
      const count = remaining.get(d.successorPhaseId)! - 1;
      remaining.set(d.successorPhaseId, count);
      if (count === 0) queue.push(phasesById.get(d.successorPhaseId)!);
    }
  }
  if (queue.length !== phases.length) throw new Error("Phase dependency graph contains a cycle");
  return queue;
}

export function scheduleBaseline(phases: readonly PhasePlan[], dependencies: readonly PhaseDependency[],
  durations: ReadonlyMap<PhasePlanId, number>, start: CivilDate, calendar: WorkingCalendar): void {
  const incoming = groupBy(dependencies, d => d.successorPhaseId);
  const byId = new Map(phases.map(p => [p.id, p]));
  for (const phase of topologicalPhases(phases, dependencies)) {
    const duration = durations.get(phase.id)!;
    let earliest = workingOnOrAfter(start, calendar);
    for (const d of incoming.get(phase.id) ?? []) {
      const pred = byId.get(d.predecessorPhaseId)!;
      const boundary = d.type === "finishToStart"
        ? addWorkingDays(pred.plannedFinish, d.lagWorkingDays + 1, calendar)
        : d.type === "startToStart"
          ? addWorkingDays(pred.plannedStart, d.lagWorkingDays, calendar)
          : addWorkingDays(pred.plannedFinish, d.lagWorkingDays - duration + 1, calendar);
      earliest = maxDate(earliest, boundary);
    }
    phase.plannedStart = earliest;
    phase.plannedFinish = addWorkingDays(earliest, duration - 1, calendar);
  }
}
