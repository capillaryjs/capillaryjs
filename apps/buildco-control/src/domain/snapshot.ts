import type {CivilDate, Project, ScenarioData} from "./model.ts";
import {civilDate, dateOf} from "./calendar.ts";
import {groupBy, sum} from "./collections.ts";

/** Baseline plans remain visible; execution and mutable summaries are reconstructed at end of date. */
export function scenarioAtDate(data: ScenarioData, date: CivilDate | string): ScenarioData {
    const cutoff = civilDate(date);
    const upper = data.metadata.asOfDate ?? data.metadata.simulationEnd;
    if (cutoff < data.metadata.simulationStart || cutoff > upper) throw new Error(`Snapshot date must be between ${data.metadata.simulationStart} and ${upper}`);
    const through = (instant: Parameters<typeof dateOf>[0]): boolean => dateOf(instant) <= cutoff;
    const progressReports = data.progressReports.filter(r => through(r.reportedAt));
    const completed = new Set(progressReports.filter(r => r.percentComplete === 100 && r.executionStatus === "complete").map(r => r.phasePlanId));
    const labourEntries = data.labourEntries.filter(e => e.workDate <= cutoff);
    const startedProjects = new Set(labourEntries.filter(e => e.activityReason === "plannedWork").map(e => e.projectId));
    const phases = groupBy(data.phasePlans, p => p.projectId);
    const projects = data.projects.map((p): Project => ({
        ...p, status: (phases.get(p.id) ?? []).every(phase => completed.has(phase.id)) ? "completed"
            : startedProjects.has(p.id) || p.plannedStart <= cutoff ? "active" : "planned"
    }));
    const issues = data.issues.filter(i => through(i.reportedAt)).map(i => ({
        ...i,
        resolvedAt: i.resolvedAt && through(i.resolvedAt) ? i.resolvedAt : undefined,
        status: i.resolvedAt && through(i.resolvedAt) ? "resolved" as const : "open" as const
    }));
    const issueIds = new Set(issues.map(i => i.id));
    const deliveries = data.deliveries.filter(d => through(d.deliveredAt));
    const deliveryIds = new Set(deliveries.map(d => d.id));
    const deliveryLines = data.deliveryLines.filter(d => deliveryIds.has(d.deliveryId));
    const deliveredByLine = groupBy(deliveryLines, d => d.purchaseOrderLineId);
    const orders = data.purchaseOrders.filter(p => through(p.orderedAt));
    const orderIds = new Set(orders.map(p => p.id));
    const purchaseOrderLines = data.purchaseOrderLines.filter(p => orderIds.has(p.purchaseOrderId));
    const linesByOrder = groupBy(purchaseOrderLines, l => l.purchaseOrderId);
    const delayImpactReports = data.delayImpactReports.filter(r => r.date <= cutoff);
    const impacts = groupBy(delayImpactReports, r => r.delayEventId);
    const delayEvents = data.delayEvents.filter(d => through(d.reportedAt)).map(d => {
        const ended = d.endedAt && through(d.endedAt);
        return {
            ...d, endedAt: ended ? d.endedAt : undefined, status: ended ? "ended" as const : "active" as const,
            // A historical snapshot cannot expose a causal record that was not yet received.
            deliveryId: d.deliveryId && deliveryIds.has(d.deliveryId) ? d.deliveryId : undefined,
            estimatedLostHours: sum(impacts.get(d.id) ?? [], r => r.estimatedLostHours),
            estimatedScheduleImpactDays: sum(impacts.get(d.id) ?? [], r => r.estimatedScheduleImpactDays)
        };
    });
    const absences = data.personnelAbsences.filter(a => a.planned || a.fromDate <= cutoff);
    return {
        ...data,
        metadata: {...data.metadata, asOfDate: cutoff},
        projects,
        progressReports,
        labourEntries,
        personnelAssignments: data.personnelAssignments.filter(a => !a.createdAt || through(a.createdAt)).map(a => ({
            ...a,
            endDate: a.endDateRecordedAt && !through(a.endDateRecordedAt) ? undefined : a.endDate,
            endDateRecordedAt: a.endDateRecordedAt && through(a.endDateRecordedAt) ? a.endDateRecordedAt : undefined
        })),
        personnelAbsences: absences,
        siteReports: data.siteReports.filter(r => r.reportDate <= cutoff),
        materialUsageEntries: data.materialUsageEntries.filter(e => through(e.usedAt)),
        issues,
        issueCauses: data.issueCauses.filter(c => issueIds.has(c.issueId)),
        deliveries,
        deliveryLines,
        purchaseOrderLines,
        purchaseOrders: orders.map(p => {
            const lines = linesByOrder.get(p.id) ?? [];
            const received = sum(lines, line => sum(deliveredByLine.get(line.id) ?? [], d => d.quantityDelivered));
            const ordered = sum(lines, line => line.quantityOrdered);
            return {
                ...p,
                status: p.status === "cancelled" ? "cancelled" : received >= ordered - 0.0001 ? "delivered" : received > 0 ? "partDelivered" : "ordered"
            };
        }),
        otherCostEntries: data.otherCostEntries.filter(e => e.date <= cutoff),
        delayEvents,
        delayImpactReports,
        milestoneReports: data.milestoneReports.filter(r => through(r.reportedAt)),
    };
}
