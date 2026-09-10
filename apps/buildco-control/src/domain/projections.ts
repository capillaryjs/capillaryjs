import type { CivilDate, Id, LabourEntry, PhaseHealth, PhasePlan, PhasePlanId, ProjectId, ScenarioData } from "./model.ts";
import { addDays, addWorkingDays, dateOf, daysBetween, isoWeek, maxDate, workingDaysBetween, workingDaysInclusive, workingOnOrAfter } from "./calendar.ts";
import { byId, compare, groupBy, round, sum } from "./collections.ts";
import { topologicalPhases } from "./dependencies.ts";
import { scenarioAtDate } from "./snapshot.ts";

export interface CostedLabourEntry {
  entry: LabourEntry; regularHours: number; overtimeHours: number; regularCost: number; overtimeCost: number; totalCost: number;
}
/** Classify the whole company's week before grouping by project, phase or issue. */
export function costLabour(data: ScenarioData): CostedLabourEntry[] {
  const people = byId(data.people);
  const rates = groupBy(data.personnelCostRates, r => r.personId);
  const weeks = new Map<string, number>();
  return [...data.labourEntries].sort((a, b) => compare(a.workDate, b.workDate) || compare(a.id, b.id)).map(entry => {
    const person = people.get(entry.personId);
    const rate = (rates.get(entry.personId) ?? []).filter(r => r.validFrom <= entry.workDate && (!r.validTo || r.validTo >= entry.workDate));
    if (!person || rate.length !== 1) throw new Error(`Expected one effective labour rate for ${entry.id}`);
    const key = `${entry.personId}/${isoWeek(entry.workDate)}`;
    const used = weeks.get(key) ?? 0;
    const regularHours = round(Math.min(entry.hours, Math.max(0, person.nominalHoursPerWeek - used)));
    const overtimeHours = round(entry.hours - regularHours);
    weeks.set(key, round(used + entry.hours));
    const regularCost = regularHours * rate[0]!.regularHourlyCost;
    const overtimeCost = overtimeHours * rate[0]!.overtimeHourlyCost;
    return { entry, regularHours, overtimeHours, regularCost, overtimeCost, totalCost: regularCost + overtimeCost };
  });
}

export function plannedProgress(phase: PhasePlan, date: CivilDate, data: ScenarioData): number {
  if (date < phase.plannedStart) return 0;
  if (date >= phase.plannedFinish) return 100;
  const project = data.projects.find(p => p.id === phase.projectId)!;
  const calendar = data.workingCalendars.find(c => c.id === project.workingCalendarId)!;
  const fraction = workingDaysInclusive(phase.plannedStart, date, calendar) / workingDaysInclusive(phase.plannedStart, phase.plannedFinish, calendar);
  const shaped = phase.progressProfile === "frontLoaded" ? 1 - (1 - fraction) ** 2 : phase.progressProfile === "backLoaded" ? fraction ** 2
    : phase.progressProfile === "sCurve" ? fraction * fraction * (3 - 2 * fraction) : fraction;
  return round(shaped * 100);
}

export interface ScenarioAnalysis {
  date: CivilDate; phases: PhaseHealth[]; labour: CostedLabourEntry[];
  issueCosts: Map<Id<"issue">, number>;
  projects: { projectId: ProjectId; status: "planned" | "active" | "completed"; progress: number; budgetCost: number; actualCost: number; costVariance: number; delayedPhases: number }[];
}

export function analyzeScenario(corpus: ScenarioData, date: CivilDate = corpus.metadata.anchorDate): ScenarioAnalysis {
  const data = scenarioAtDate(corpus, date);
  const projects = byId(data.projects);
  const calendars = byId(data.workingCalendars);
  const personnelTypes = byId(data.personnelTypes);
  const labour = costLabour(data);
  const labourByPhase = groupBy(labour, l => l.entry.phasePlanId);
  const materialByPhase = groupBy(data.materialUsageEntries, m => m.phasePlanId);
  const labourBudgets = groupBy(data.labourBudgetLines, b => b.phasePlanId);
  const materialBudgets = groupBy(data.materialBudgetLines, b => b.phasePlanId);
  const otherBudgets = groupBy(data.otherBudgetLines, b => b.phasePlanId);
  const otherCosts = groupBy(data.otherCostEntries, b => b.phasePlanId);
  const assignments = groupBy(data.personnelAssignments.filter(a => a.startDate <= date && (!a.endDate || a.endDate >= date)), a => a.phasePlanId);
  const absent = new Set(data.personnelAbsences.filter(a => a.fromDate <= date && a.toDate >= date).map(a => a.personId));
  const reports = groupBy(data.progressReports, r => r.phasePlanId);
  const latest = new Map([...reports].map(([id, rows]) => [id, rows.reduce((a, b) => a.reportedAt > b.reportedAt || a.reportedAt === b.reportedAt && a.id > b.id ? a : b)]));
  const firstWork = new Map<PhasePlanId, CivilDate>();
  for (const l of labour) if (l.entry.activityReason === "plannedWork" && !firstWork.has(l.entry.phasePlanId)) firstWork.set(l.entry.phasePlanId, l.entry.workDate);
  const completed = new Map([...latest].filter(([, r]) => r.percentComplete === 100 && r.executionStatus === "complete").map(([id, r]) => [id, dateOf(r.reportedAt)]));
  const people = byId(data.people);
  const committedHours = new Map<Id<"person">, number>();
  for (const [phase, rows] of assignments) if (!completed.has(phase)) for (const assignment of rows) {
    committedHours.set(assignment.personId, (committedHours.get(assignment.personId) ?? 0) + assignment.plannedHoursPerWeek);
  }
  const issues = groupBy(data.issues, i => i.phasePlanId);
  const issueCosts = new Map<Id<"issue">, number>();
  const addIssueCost = (id: Id<"issue"> | undefined, cost: number): void => { if (id) issueCosts.set(id, (issueCosts.get(id) ?? 0) + cost); };
  for (const l of labour) addIssueCost(l.entry.issueId, l.totalCost);
  for (const m of data.materialUsageEntries) addIssueCost(m.issueId, m.quantity * m.unitCostApplied);
  for (const o of data.otherCostEntries) addIssueCost(o.issueId, o.amount);
  const dependencies = groupBy(data.phaseDependencies, d => d.successorPhaseId);
  const delayByPhase = groupBy(data.delayEvents.flatMap(d => d.affectedPhasePlanIds.map(id => ({ id, event: d }))), d => d.id);
  const delayImpacts = groupBy(data.delayImpactReports, r => r.delayEventId);
  const orders = byId(data.purchaseOrders);
  const lines = byId(data.purchaseOrderLines);
  const deliveriesByLine = groupBy(data.deliveryLines, d => d.purchaseOrderLineId);
  const linesByPhase = groupBy(data.purchaseOrderLines, l => l.phasePlanId);
  const available = new Map<string, number>();
  const expected = new Map<string, number>();
  for (const delivery of data.deliveryLines) {
    const line = lines.get(delivery.purchaseOrderLineId)!;
    const key = `${orders.get(line.purchaseOrderId)!.projectId}/${line.materialTypeId}`;
    available.set(key, (available.get(key) ?? 0) + delivery.quantityAccepted);
  }
  for (const usage of data.materialUsageEntries) {
    const key = `${usage.projectId}/${usage.materialTypeId}`;
    available.set(key, (available.get(key) ?? 0) - usage.quantity);
  }
  for (const line of data.purchaseOrderLines) if (line.expectedDeliveryDate >= date && line.expectedDeliveryDate <= addDays(date, 7)) {
    const key = `${orders.get(line.purchaseOrderId)!.projectId}/${line.materialTypeId}`;
    expected.set(key, (expected.get(key) ?? 0) + line.quantityOrdered - sum(deliveriesByLine.get(line.id) ?? [], d => d.quantityDelivered));
  }
  for (const [key, quantity] of expected) available.set(key, (available.get(key) ?? 0) + quantity);
  const results = new Map<PhasePlanId, PhaseHealth>();
  for (const phase of topologicalPhases(data.phasePlans, data.phaseDependencies)) {
    const calendar = calendars.get(projects.get(phase.projectId)!.workingCalendarId)!;
    const report = latest.get(phase.id);
    const progress = report?.percentComplete ?? 0;
    const lbs = labourBudgets.get(phase.id) ?? [];
    const mbs = materialBudgets.get(phase.id) ?? [];
    const actualLabour = labourByPhase.get(phase.id) ?? [];
    const actualMaterial = materialByPhase.get(phase.id) ?? [];
    const totalHours = sum(lbs, b => b.estimatedHours);
    const headcount = sum(lbs, b => b.plannedHeadcount);
    const assigned = new Set((assignments.get(phase.id) ?? []).filter(a => !absent.has(a.personId)).map(a => a.personId)).size;
    const availableHours = sum(assignments.get(phase.id) ?? [], a => absent.has(a.personId) || progress === 100 ? 0
      : a.plannedHoursPerWeek * Math.min(1, people.get(a.personId)!.nominalHoursPerWeek / (committedHours.get(a.personId) ?? 1)));
    const baseDuration = workingDaysInclusive(phase.plannedStart, phase.plannedFinish, calendar);
    const budgetLabourCost = sum(lbs, b => {
      const capacity = b.plannedHeadcount * baseDuration * calendar.regularHoursPerDay;
      return Math.min(b.estimatedHours, capacity) * b.budgetRegularHourlyCost + Math.max(0, b.estimatedHours - capacity) * b.budgetOvertimeHourlyCost;
    });
    const budgetMaterialCost = sum(mbs, b => b.budgetedQuantity * b.budgetUnitCost);
    const totalBudgetCost = budgetLabourCost + budgetMaterialCost + sum(otherBudgets.get(phase.id) ?? [], b => b.budgetedAmount);
    const actualLabourCost = sum(actualLabour, l => l.totalCost);
    const actualMaterialCost = sum(actualMaterial, m => m.quantity * m.unitCostApplied);
    const actualDirectCost = actualLabourCost + actualMaterialCost + sum(otherCosts.get(phase.id) ?? [], o => o.amount);
    let forecastStart = firstWork.get(phase.id) ?? maxDate(phase.plannedStart, workingOnOrAfter(addDays(date, 1), calendar));
    let finishBound = forecastStart;
    const blockingPhaseIds: PhasePlanId[] = [];
    for (const d of dependencies.get(phase.id) ?? []) {
      const pred = results.get(d.predecessorPhaseId)!;
      const actual = d.type === "startToStart" ? firstWork.get(d.predecessorPhaseId) : completed.get(d.predecessorPhaseId);
      const eventDate = d.type === "startToStart" ? pred.forecastStart : pred.forecastFinish;
      const boundary = addWorkingDays(eventDate, d.lagWorkingDays + Number(d.type === "finishToStart"), calendar);
      if (d.type === "finishToFinish") finishBound = maxDate(finishBound, boundary);
      else if (!firstWork.has(phase.id)) forecastStart = maxDate(forecastStart, boundary);
      if (progress < 100 && phase.plannedStart <= date && (d.type !== "finishToFinish" || progress >= 99.9) &&
          (!actual || addWorkingDays(actual, d.lagWorkingDays + Number(d.type === "finishToStart"), calendar) > date)) blockingPhaseIds.push(d.predecessorPhaseId);
    }
    const remainingDays = Math.max(1, Math.ceil(totalHours * (1 - progress / 100) / Math.max(3.7, (assigned || headcount) * calendar.regularHoursPerDay)));
    const fallbackFinish = addWorkingDays(workingOnOrAfter(maxDate(forecastStart, addDays(date, 1)), calendar), remainingDays - 1, calendar);
    const forecastFinish = completed.get(phase.id) ?? maxDate(finishBound, report?.forecastFinishDate && report.forecastFinishDate > date ? report.forecastFinishDate : fallbackFinish);
    if (completed.has(phase.id)) forecastStart = firstWork.get(phase.id) ?? phase.plannedStart;
    const open = (issues.get(phase.id) ?? []).filter(i => !i.resolvedAt);
    let shortage = 0;
    if (progress < 100 && phase.plannedStart <= addDays(date, 7) && blockingPhaseIds.length === 0) for (const budget of mbs) {
      const key = `${phase.projectId}/${budget.materialTypeId}`;
      const need = budget.requiredQuantity * (1 - progress / 100) * Math.min(1, 5 / remainingDays);
      const stock = Math.max(0, available.get(key) ?? 0);
      if (need > stock + 0.001) shortage++;
      available.set(key, (available.get(key) ?? 0) - need);
    }
    const late = progress === 100 ? 0 : (linesByPhase.get(phase.id) ?? []).filter(l => l.expectedDeliveryDate < date &&
      sum(deliveriesByLine.get(l.id) ?? [], d => d.quantityDelivered) < l.quantityOrdered - 0.0001).length;
    const expectedCostAtProgress = totalBudgetCost * progress / 100;
    const health: PhaseHealth = { phasePlanId: phase.id, reportedProgress: progress, plannedProgressAtDate: plannedProgress(phase, date, data),
      progressVariance: round(progress - plannedProgress(phase, date, data)), plannedStart: phase.plannedStart, plannedFinish: phase.plannedFinish,
      forecastStart, forecastFinish, scheduleVarianceDays: workingDaysBetween(phase.plannedFinish, forecastFinish, calendar),
      prerequisiteBlocked: blockingPhaseIds.length > 0, blockingPhaseIds,
      budgetLabourHours: totalHours, actualLabourHours: sum(actualLabour, l => l.entry.hours), overtimeHours: sum(actualLabour, l => l.overtimeHours),
      budgetLabourCost, actualLabourCost, budgetMaterialCost, actualMaterialCost, totalBudgetCost, actualDirectCost,
      expectedCostAtProgress, costVariance: actualDirectCost - expectedCostAtProgress, plannedHeadcount: headcount, assignedHeadcount: progress === 100 ? 0 : assigned,
      plannedHoursPerWeek: sum(lbs, b => b.plannedHeadcount * personnelTypes.get(b.personnelTypeId)!.defaultNominalHoursPerWeek),
      availableHoursPerWeek: availableHours, materialShortageCount: shortage, lateMaterialCount: late, openIssueCount: open.length,
      overdueIssueCount: open.filter(i => i.dueAt && dateOf(i.dueAt) < date).length, criticalIssueCount: open.filter(i => i.severity === "critical").length,
      issueAttributedCost: sum(issues.get(phase.id) ?? [], i => issueCosts.get(i.id) ?? 0),
      activeDelayCount: (delayByPhase.get(phase.id) ?? []).filter(d => d.event.status === "active").length,
      // Union days, so concurrent causes are not added as if they were serial delays.
      estimatedDelayDays: new Set((delayByPhase.get(phase.id) ?? []).flatMap(({ event }) => (delayImpacts.get(event.id) ?? []).map(r => r.date))).size,
      staleReportingDays: progress === 100 || phase.plannedStart > date ? 0 : daysBetween(report ? dateOf(report.reportedAt) : phase.plannedStart, date) };
    results.set(phase.id, health);
  }
  const phaseById = byId(data.phasePlans);
  const phaseGroups = groupBy([...results.values()], p => phaseById.get(p.phasePlanId)!.projectId);
  return { date, phases: [...results.values()], labour, issueCosts, projects: data.projects.map(project => {
    const phases = phaseGroups.get(project.id) ?? [];
    const totalWeight = sum(phases, p => phaseById.get(p.phasePlanId)!.progressWeight);
    const extraBudget = sum(data.otherBudgetLines.filter(b => b.projectId === project.id && !b.phasePlanId), b => b.budgetedAmount);
    const extraActual = sum(data.otherCostEntries.filter(b => b.projectId === project.id && !b.phasePlanId), b => b.amount);
    return { projectId: project.id, status: project.status,
      progress: round(sum(phases, p => p.reportedProgress * phaseById.get(p.phasePlanId)!.progressWeight) / Math.max(1, totalWeight)),
      budgetCost: sum(phases, p => p.totalBudgetCost) + extraBudget, actualCost: sum(phases, p => p.actualDirectCost) + extraActual,
      costVariance: sum(phases, p => p.costVariance) + (project.plannedStart <= date ? extraActual - extraBudget : 0),
      delayedPhases: phases.filter(p => p.scheduleVarianceDays > 0).length };
  }) };
}

export const HEALTH_THRESHOLDS = { overtimeRatio: 0.15, staleDays: 7, costOverrunRatio: 0.05, highRiskDelayDays: 10 } as const;
export function classifyHealth(health: PhaseHealth): Record<"behindSchedule" | "overBudget" | "highOvertime" | "understaffed" | "materialShortage" | "lateMaterial" | "openDefects" | "blocked" | "staleReporting" | "highRisk", boolean> {
  const active = health.reportedProgress < 100 && health.plannedProgressAtDate > 0;
  return { behindSchedule: health.scheduleVarianceDays > 0,
    overBudget: health.costVariance > Math.max(1, health.expectedCostAtProgress * HEALTH_THRESHOLDS.costOverrunRatio),
    highOvertime: health.overtimeHours / Math.max(1, health.actualLabourHours) > HEALTH_THRESHOLDS.overtimeRatio,
    understaffed: active && (health.assignedHeadcount < health.plannedHeadcount || health.availableHoursPerWeek < health.plannedHoursPerWeek * 0.8),
    materialShortage: health.materialShortageCount > 0, lateMaterial: health.lateMaterialCount > 0,
    openDefects: health.openIssueCount > 0, blocked: health.prerequisiteBlocked,
    staleReporting: health.staleReportingDays > HEALTH_THRESHOLDS.staleDays,
    highRisk: active && (health.criticalIssueCount > 0 || health.scheduleVarianceDays >= HEALTH_THRESHOLDS.highRiskDelayDays || health.materialShortageCount > 0) };
}
