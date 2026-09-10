import type { CivilDate, ScenarioData } from "../domain/model.ts";
import { analyzeScenario, classifyHealth, type ScenarioAnalysis } from "../domain/projections.ts";
import { scenarioAtDate } from "../domain/snapshot.ts";
import { byId, groupBy } from "../domain/collections.ts";
import { dateOf } from "../domain/calendar.ts";

/** Coverage is an observation, never a reason to overwrite generated facts. */
export function assessScenarioCoverage(corpus: ScenarioData, date: CivilDate = corpus.metadata.anchorDate, analysis: ScenarioAnalysis = analyzeScenario(corpus, date)) {
  const data = scenarioAtDate(corpus, date);
  const deliveries = byId(data.deliveries), lines = byId(data.purchaseOrderLines);
  const completed = new Map(data.progressReports.filter(r => r.executionStatus === "complete").map(r => [r.phasePlanId, dateOf(r.reportedAt)]));
  const phases = groupBy(data.phasePlans, p => p.projectId);
  const absenceDelays = new Set(data.delayEvents.map(d => d.absenceId).filter(Boolean));
  const delayedPhases = new Set(data.delayEvents.flatMap(d => d.affectedPhasePlanIds));
  const projectCosts = new Map(analysis.projects.map(p => [p.projectId, p.costVariance]));
  const traits = analysis.phases.map(classifyHealth);
  const checks = {
    completedProject: data.projects.some(p => p.status === "completed"),
    activeProject: data.projects.some(p => p.status === "active"),
    futureProject: data.projects.some(p => p.status === "planned" && p.plannedStart > date),
    healthyOnTimeProject: data.projects.some(p => p.status === "completed" && (projectCosts.get(p.id) ?? 0) <= 0 &&
      (phases.get(p.id) ?? []).every(phase => completed.get(phase.id)! <= p.plannedCompletion)),
    seriouslyDelayedProject: analysis.phases.some(p => p.scheduleVarianceDays >= 10),
    overBudgetProject: analysis.projects.some(p => p.costVariance > 1000),
    underBudgetProject: analysis.projects.some(p => p.costVariance < -1000),
    significantOvertime: traits.some(t => t.highOvertime),
    materialShortage: traits.some(t => t.materialShortage),
    lateDelivery: data.deliveryLines.some(l => dateOf(deliveries.get(l.deliveryId)!.deliveredAt) > lines.get(l.purchaseOrderLineId)!.expectedDeliveryDate),
    supplierQualityIssue: data.issueCauses.some(c => c.category === "materialQuality" && c.supplierId),
    workerCausedDefect: data.issueCauses.some(c => c.category === "workerMistake"),
    designIssue: data.issueCauses.some(c => c.category === "design"),
    criticalIssue: data.issues.some(i => i.severity === "critical"),
    substantialReworkCost: [...analysis.issueCosts.values()].some(cost => cost > 10000),
    absenceWithoutDelay: data.personnelAbsences.some(a => a.fromDate <= date && !absenceDelays.has(a.id)),
    absenceCausingDelay: absenceDelays.size > 0,
    prerequisiteBlocked: traits.some(t => t.blocked),
    downstreamDelay: data.delayEvents.some(d => d.blockingPhasePlanId && delayedPhases.has(d.blockingPhasePlanId)),
    heavyConsumptionWeakProgress: analysis.phases.some(p => p.reportedProgress > 0 && p.reportedProgress < 80 && p.actualLabourHours / p.budgetLabourHours > p.reportedProgress / 100 * 1.3),
    earlyDelivery: data.deliveryLines.some(l => dateOf(deliveries.get(l.deliveryId)!.deliveredAt) < lines.get(l.purchaseOrderLineId)!.expectedDeliveryDate),
    partialDelivery: data.deliveryLines.some(l => l.quantityDelivered < lines.get(l.purchaseOrderLineId)!.quantityOrdered - 0.001),
    rejectedDelivery: data.deliveryLines.some(l => l.quantityRejected > 0),
  };
  return { checks, missing: Object.entries(checks).filter(([, present]) => !present).map(([name]) => name) };
}
