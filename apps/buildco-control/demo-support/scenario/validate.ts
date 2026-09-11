import type {CivilDate, Id, ScenarioData} from "../../src/domain/model.ts";
import {addWorkingDays, civilDate, dateOf, isoWeek, isWorkingDay} from "../../src/domain/calendar.ts";
import {byId, compare, groupBy, sum} from "../../src/domain/collections.ts";
import {topologicalPhases} from "../../src/domain/dependencies.ts";
import {costLabour} from "../../src/domain/projections.ts";

export class ScenarioValidationError extends Error {
    constructor(readonly violations: string[]) {
        super(`Scenario validation failed (${violations.length}):\n${violations.slice(0, 30).join("\n")}`);
    }
}

/** Validate independently of the simulation's private state, using only public facts. */
export function validateScenario(data: ScenarioData): void {
    const errors: string[] = [];
    const check = (valid: unknown, message: string): void => {
        if (!valid) errors.push(message);
    };
    const tables = Object.entries(data).filter(([key]) => key !== "metadata") as [string, { id: string }[]][];
    const registry = new Map<string, string>();
    for (const [name, rows] of tables) for (const row of rows) {
        check(!registry.has(row.id), `Duplicate ID ${row.id}`);
        registry.set(row.id, name);
        for (const [key, value] of Object.entries(row)) {
            if (typeof value === "number") check(Number.isFinite(value) && (value >= 0 || key === "floorNumber"), `${row.id}.${key} must be finite and non-negative`);
            if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                try {
                    civilDate(value.slice(0, 10));
                } catch {
                    errors.push(`${row.id}.${key} has invalid date`);
                }
                if (value.includes("T")) check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)), `${row.id}.${key} has invalid UTC instant`);
            }
        }
    }
    const fk = (value: string | undefined, table: string, owner: string): void => {
        if (value !== undefined) check(registry.get(value) === table, `${owner}: invalid reference ${value}, expected ${table}`);
    };
    const foreignKeys: Record<string, string> = {
        projectId: "projects",
        personId: "people",
        supervisorId: "people",
        personnelTypeId: "personnelTypes",
        materialTypeId: "materialTypes",
        supplierId: "suppliers",
        customerId: "customers",
        phaseTypeId: "phaseTypes",
        projectManagerId: "people",
        siteManagerId: "people",
        workingCalendarId: "workingCalendars",
        projectPlanId: "projectPlans",
        scopeNodeId: "scopeNodes",
        parentId: "scopeNodes",
        phasePlanId: "phasePlans",
        predecessorPhaseId: "phasePlans",
        successorPhaseId: "phasePlans",
        blockingPhasePlanId: "phasePlans",
        reporterId: "people",
        reportedById: "people",
        assignedToId: "people",
        createdById: "people",
        siteReportId: "siteReports",
        issueId: "issues",
        delayEventId: "delayEvents",
        purchaseOrderId: "purchaseOrders",
        purchaseOrderLineId: "purchaseOrderLines",
        deliveryId: "deliveries",
        absenceId: "personnelAbsences",
        milestonePlanId: "milestonePlans",
    };
    for (const [, rows] of tables) for (const row of rows) for (const [key, value] of Object.entries(row)) {
        if (foreignKeys[key]) fk(value as string | undefined, foreignKeys[key]!, row.id);
        if (key === "affectedPhasePlanIds" || key === "phasePlanIds") for (const id of value as unknown as string[]) fk(id, "phasePlans", row.id);
    }
    if (errors.length) throw new ScenarioValidationError(errors);
    const projects = byId(data.projects), scopes = byId(data.scopeNodes), phases = byId(data.phasePlans),
        plans = byId(data.projectPlans);
    const calendars = byId(data.workingCalendars), issues = byId(data.issues), delays = byId(data.delayEvents);
    const deliveries = byId(data.deliveries), orderLines = byId(data.purchaseOrderLines),
        orders = byId(data.purchaseOrders);
    const budgets = groupBy(data.materialBudgetLines, b => b.phasePlanId);
    const assignments = groupBy(data.personnelAssignments, a => `${a.personId}/${a.phasePlanId}`);
    const absences = groupBy(data.personnelAbsences, a => a.personId);
    const reports = groupBy(data.progressReports, r => r.phasePlanId);
    const firstWork = new Map<Id<"phase">, CivilDate>();
    const finished = new Map<Id<"phase">, CivilDate>();
    try {
        topologicalPhases(data.phasePlans, data.phaseDependencies);
    } catch (e) {
        errors.push(String(e));
    }
    for (const scope of data.scopeNodes) {
        const seen = new Set([scope.id]);
        let parent = scope.parentId;
        while (parent) {
            if (seen.has(parent)) {
                errors.push(`Scope cycle at ${scope.id}`);
                break;
            }
            seen.add(parent);
            const node = scopes.get(parent)!;
            check(node.projectId === scope.projectId, `${scope.id}: parent belongs to another project`);
            parent = node.parentId;
        }
    }
    for (const phase of data.phasePlans) {
        const project = projects.get(phase.projectId)!;
        check(scopes.get(phase.scopeNodeId)!.projectId === phase.projectId && plans.get(phase.projectPlanId)!.projectId === phase.projectId, `${phase.id}: inconsistent project ownership`);
        const calendar = calendars.get(project.workingCalendarId)!;
        check(phase.plannedStart <= phase.plannedFinish && isWorkingDay(phase.plannedStart, calendar) && isWorkingDay(phase.plannedFinish, calendar), `${phase.id}: invalid baseline interval`);
        let previous = -1;
        for (const report of [...(reports.get(phase.id) ?? [])].sort((a, b) => compare(a.reportedAt, b.reportedAt) || compare(a.id, b.id))) {
            check(report.percentComplete >= previous && report.percentComplete <= 100, `${report.id}: progress is out of bounds or decreases`);
            check(report.executionStatus !== "complete" || report.percentComplete === 100, `${report.id}: completion requires 100%`);
            check(report.percentComplete !== 100 || report.executionStatus === "complete", `${report.id}: 100% requires completion status`);
            previous = report.percentComplete;
            if (report.executionStatus === "complete") finished.set(phase.id, dateOf(report.reportedAt));
        }
    }
    const daily = new Map<string, number>(), weekly = new Map<string, number>();
    const production = new Map<string, number>();
    const checkAttribution = (row: {
        id: string;
        projectId: Id<"project">;
        phasePlanId?: Id<"phase">;
        issueId?: Id<"issue">;
        delayEventId?: Id<"delay">
    }, date: CivilDate): void => {
        if (row.phasePlanId) check(phases.get(row.phasePlanId)!.projectId === row.projectId, `${row.id}: phase/project mismatch`);
        if (row.issueId) {
            const issue = issues.get(row.issueId)!;
            check(issue.projectId === row.projectId && (!issue.phasePlanId || issue.phasePlanId === row.phasePlanId), `${row.id}: issue attribution mismatch`);
            check(date >= dateOf(issue.reportedAt), `${row.id}: cost precedes issue`);
        }
        if (row.delayEventId) check(delays.get(row.delayEventId)!.projectId === row.projectId, `${row.id}: delay attribution mismatch`);
        check(date >= data.metadata.simulationStart && date <= (data.metadata.asOfDate ?? data.metadata.simulationEnd), `${row.id}: execution outside simulation window`);
    };
    for (const row of data.labourEntries) {
        checkAttribution(row, row.workDate);
        check(row.hours > 0 && row.hours <= 12, `${row.id}: implausible hours`);
        check((assignments.get(`${row.personId}/${row.phasePlanId}`) ?? []).some(a => a.startDate <= row.workDate && (!a.endDate || a.endDate >= row.workDate)), `${row.id}: no valid assignment`);
        check(!(absences.get(row.personId) ?? []).some(a => a.fromDate <= row.workDate && a.toDate >= row.workDate), `${row.id}: labour during absence`);
        const dayKey = `${row.personId}/${row.workDate}`, weekKey = `${row.personId}/${isoWeek(row.workDate)}`;
        daily.set(dayKey, (daily.get(dayKey) ?? 0) + row.hours);
        weekly.set(weekKey, (weekly.get(weekKey) ?? 0) + row.hours);
        if (row.activityReason === "plannedWork") {
            const old = firstWork.get(row.phasePlanId);
            if (!old || old > row.workDate) firstWork.set(row.phasePlanId, row.workDate);
        }
    }
    for (const [key, hours] of daily) check(hours <= 12.0001, `${key}: impossible total daily hours (${hours})`);
    for (const [key, hours] of weekly) check(hours <= 60.0001, `${key}: impossible weekly hours (${hours})`);
    try {
        costLabour(data);
    } catch (e) {
        errors.push(String(e));
    }
    for (const d of data.phaseDependencies) {
        const pred = phases.get(d.predecessorPhaseId)!, successor = phases.get(d.successorPhaseId)!;
        check(pred.projectId === successor.projectId, `${d.id}: dependency crosses projects`);
        const calendar = calendars.get(projects.get(successor.projectId)!.workingCalendarId)!;
        const plannedEvent = d.type === "startToStart" ? pred.plannedStart : pred.plannedFinish;
        const plannedSuccessor = d.type === "finishToFinish" ? successor.plannedFinish : successor.plannedStart;
        check(plannedSuccessor >= addWorkingDays(plannedEvent, d.lagWorkingDays + Number(d.type === "finishToStart"), calendar), `${d.id}: baseline violates dependency`);
        const actualSuccessor = d.type === "finishToFinish" ? finished.get(successor.id) : firstWork.get(successor.id);
        if (actualSuccessor) {
            const actualEvent = d.type === "startToStart" ? firstWork.get(pred.id) : finished.get(pred.id);
            check(actualEvent && actualSuccessor >= addWorkingDays(actualEvent, d.lagWorkingDays + Number(d.type === "finishToStart"), calendar), `${d.id}: execution violates dependency`);
        }
    }
    const transactions: { key: string; time: string; id: string; quantity: number; unitCost: number }[] = [];
    for (const line of data.deliveryLines) {
        const orderLine = orderLines.get(line.purchaseOrderLineId)!;
        const delivery = deliveries.get(line.deliveryId)!;
        const order = orders.get(orderLine.purchaseOrderId)!;
        check(delivery.purchaseOrderId === order.id, `${line.id}: delivery/order mismatch`);
        check(line.quantityAccepted + line.quantityRejected <= line.quantityDelivered + 0.0001, `${line.id}: invalid accepted/rejected quantities`);
        check(delivery.deliveredAt >= order.orderedAt, `${line.id}: delivery precedes order`);
        transactions.push({
            key: `${order.projectId}/${orderLine.materialTypeId}`,
            time: delivery.deliveredAt,
            id: line.id,
            quantity: line.quantityAccepted,
            unitCost: orderLine.unitCost
        });
    }
    for (const row of data.materialUsageEntries) {
        checkAttribution(row, dateOf(row.usedAt));
        check(row.quantity > 0, `${row.id}: material usage must be positive`);
        transactions.push({
            key: `${row.projectId}/${row.materialTypeId}`,
            time: row.usedAt,
            id: row.id,
            quantity: -row.quantity,
            unitCost: row.unitCostApplied
        });
        if (row.usageReason === "plannedWork") {
            const key = `${row.phasePlanId}/${row.materialTypeId}`;
            production.set(key, (production.get(key) ?? 0) + row.quantity);
        }
    }
    const inventory = new Map<string, number>();
    const inventoryValue = new Map<string, number>();
    for (const tx of transactions.sort((a, b) => compare(a.time, b.time) || compare(a.id, b.id))) {
        const before = inventory.get(tx.key) ?? 0;
        const value = inventoryValue.get(tx.key) ?? 0;
        const applied = tx.quantity < 0 && before > 0.0000001 ? value / before : tx.unitCost;
        if (tx.quantity < 0 && before > 0.0000001) check(Math.abs(applied - tx.unitCost) <= 0.01, `${tx.id}: material valuation does not match weighted accepted-delivery cost`);
        inventoryValue.set(tx.key, Math.max(0, value + tx.quantity * applied));
        const quantity = before + tx.quantity;
        check(quantity >= -0.001, `${tx.id}: negative material inventory (${quantity})`);
        inventory.set(tx.key, quantity);
    }
    for (const [phaseId, phaseReports] of reports) {
        const progress = Math.max(...phaseReports.map(r => r.percentComplete)) / 100;
        for (const budget of budgets.get(phaseId) ?? []) check((production.get(`${phaseId}/${budget.materialTypeId}`) ?? 0) >= budget.requiredQuantity * progress - 0.02, `${phaseId}: progress not supported by consumed ${budget.materialTypeId}`);
    }
    for (const row of data.otherCostEntries) checkAttribution(row, row.date);
    for (const issue of data.issues) {
        check(!issue.resolvedAt || issue.resolvedAt >= issue.reportedAt, `${issue.id}: resolution precedes report`);
        check(scopes.get(issue.scopeNodeId)!.projectId === issue.projectId, `${issue.id}: scope/project mismatch`);
    }
    for (const delay of data.delayEvents) {
        check(!delay.endedAt || delay.endedAt >= delay.startedAt, `${delay.id}: invalid delay interval`);
        for (const phase of delay.affectedPhasePlanIds) check(phases.get(phase)!.projectId === delay.projectId, `${delay.id}: affected phase/project mismatch`);
    }
    for (const report of data.delayImpactReports) {
        const delay = delays.get(report.delayEventId)!;
        check(report.date >= dateOf(delay.startedAt) && (!delay.endedAt || report.date <= dateOf(delay.endedAt)), `${report.id}: impact outside delay interval`);
    }
    for (const milestone of data.milestonePlans) for (const id of milestone.phasePlanIds) check(phases.get(id)!.projectId === milestone.projectId, `${milestone.id}: phase/project mismatch`);
    for (const report of data.milestoneReports) if (report.status === "complete") {
        const plan = data.milestonePlans.find(m => m.id === report.milestonePlanId)!;
        check(report.completedAt && plan.phasePlanIds.every(id => finished.has(id) && finished.get(id)! <= dateOf(report.completedAt!)), `${report.id}: milestone completes before phases`);
    }
    const deliveriesGrouped = groupBy(data.deliveryLines, l => l.purchaseOrderLineId);
    for (const line of data.purchaseOrderLines) check(sum(deliveriesGrouped.get(line.id) ?? [], l => l.quantityDelivered) <= line.quantityOrdered + 0.001, `${line.id}: deliveries exceed ordered quantity`);
    if (errors.length) throw new ScenarioValidationError(errors);
}
