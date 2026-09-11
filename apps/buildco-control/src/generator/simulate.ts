import type {
    CivilDate,
    DelayCauseType,
    DelayEvent,
    Id,
    Issue,
    IssueCauseCategory,
    LabourEntry,
    MaterialBudgetLine,
    PersonnelAbsence,
    PhaseExecutionStatus,
    ProjectId,
    ScenarioData,
    Severity
} from "../domain/model.ts";
import {
    addDays,
    addWorkingDays,
    at,
    daysBetween,
    isoWeek,
    isWorkingDay,
    maxDate,
    workingOnOrAfter
} from "../domain/calendar.ts";
import {byId, compare, groupBy, round, sum} from "../domain/collections.ts";
import {topologicalPhases} from "../domain/dependencies.ts";
import {type GenerationContext, type Inventory, inventoryKey, type PhaseState, type PlannedPurchase} from "./state.ts";

export async function simulate(ctx: GenerationContext, onProgress?: (progress: number) => void): Promise<void> {
    const sim = new Simulation(ctx, onProgress);
    await sim.run();
}

class Simulation {
    private readonly data: ScenarioData;
    private readonly people;
    private readonly materialTypes;
    private readonly workforce;
    private readonly order: PhaseState[];
    private readonly phaseGroups;
    private readonly milestoneGroups;
    private readonly stock = new Map<string, Inventory>();
    private readonly deliverySchedule = new Map<CivilDate, PlannedPurchase[]>();
    private readonly orderSchedule = new Map<CivilDate, PlannedPurchase[]>();
    private readonly purchaseGroups = new Map<string, PlannedPurchase[]>();
    private readonly dayHours = new Map<Id<"person">, number>();
    private readonly weekHours = new Map<Id<"person">, number>();
    private readonly absent = new Map<Id<"person">, PersonnelAbsence>();
    private readonly incidentProjects = new Set<ProjectId>();
    private readonly weatherUntil = new Map<ProjectId, CivilDate>();
    private readonly weatherProjects = new Set<ProjectId>();
    private readonly touchedDelays = new Set<string>();
    private readonly siteReports = new Map<ProjectId, Id<"siteReport">>();
    private readonly setupProjects = new Set<ProjectId>();
    private readonly latestMilestones = new Map<Id<"milestone">, ScenarioData["milestoneReports"][number]>();
    private date: CivilDate;

    constructor(private readonly ctx: GenerationContext, private readonly onProgress?: (progress: number) => void) {
        this.data = ctx.data;
        this.date = this.data.metadata.simulationStart;
        this.people = byId(this.data.people);
        this.materialTypes = byId(this.data.materialTypes);
        this.workforce = groupBy(this.data.people, p => p.personnelTypeId);
        this.order = topologicalPhases(this.data.phasePlans, this.data.phaseDependencies).map(p => ctx.phases.get(p.id)!);
        this.phaseGroups = groupBy(this.order, p => p.project.id);
        this.milestoneGroups = groupBy(this.data.milestonePlans, m => m.projectId);
    }

    async run(): Promise<void> {
        this.onProgress?.(0);
        await this.yieldControl();
        for (const state of this.order) for (const budget of state.materials) {
            this.purchase(state, budget, budget.budgetedQuantity, addDays(budget.requiredByDate, -25), budget.requiredByDate, true);
        }
        this.onProgress?.(0.1);
        await this.yieldControl();
        // A supervisor's planned training has no productive assignment and therefore causes no delay.
        const supervisor = this.data.people.find(p => p.personnelTypeId === this.data.personnelTypes[8]!.id)!;
        const trainingDate = addDays(this.data.metadata.simulationStart, 45);
        if (trainingDate <= this.data.metadata.simulationEnd) this.data.personnelAbsences.push({
            id: this.ctx.ids.next("absence"),
            personId: supervisor.id,
            fromDate: trainingDate,
            toDate: addDays(trainingDate, 2),
            type: "training",
            planned: true,
            notes: "Planned supervisor training; no production assignment"
        });
        const totalDays = daysBetween(this.data.metadata.simulationStart, this.data.metadata.simulationEnd) + 1;
        let week: CivilDate | undefined;
        let dayCount = 0;
        for (this.date = this.data.metadata.simulationStart; this.date <= this.data.metadata.simulationEnd; this.date = addDays(this.date, 1)) {
            this.dayHours.clear();
            this.siteReports.clear();
            this.touchedDelays.clear();
            if (week !== isoWeek(this.date)) {
                week = isoWeek(this.date);
                this.weekHours.clear();
            }
            this.processOrdersAndDeliveries();
            if (!isWorkingDay(this.date, this.data.workingCalendars[0]!)) continue;
            this.processAbsencesAndWeather();
            const priority = {critical: 0, high: 1, normal: 2, low: 3};
            const ready = this.order.filter(s => !s.finished && s.plan.plannedStart <= this.date).sort((a, b) =>
                priority[a.project.priority] - priority[b.project.priority] || compare(a.plan.plannedFinish, b.plan.plannedFinish) || compare(a.plan.id, b.plan.id));
            for (const state of ready) this.execute(state);
            this.reorder();
            this.forecastAndReport();
            this.milestones();
            dayCount++;
            if (this.onProgress && totalDays > 0 && dayCount % 5 === 0) {
                const progress = daysBetween(this.data.metadata.simulationStart, this.date) / totalDays;
                this.onProgress(Math.min(0.9, 0.1 + progress * 0.8));
                await this.yieldControl();
            }
        }
        this.onProgress?.(1);
    }

    private async yieldControl(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    private getStock(state: PhaseState, budget: MaterialBudgetLine): Inventory {
        const key = inventoryKey(state.project.id, budget.materialTypeId);
        let stock = this.stock.get(key);
        if (!stock) {
            stock = {quantity: 0, value: 0};
            this.stock.set(key, stock);
        }
        return stock;
    }

    private purchase(state: PhaseState, budget: MaterialBudgetLine, quantity: number, orderedOn: CivilDate, requiredBy: CivilDate, initial: boolean): void {
        const {rng, ids} = this.ctx;
        const material = this.materialTypes.get(budget.materialTypeId)!;
        const suppliers = this.data.suppliers.filter(s => s.materialCategories.includes(material.category));
        const supplier = state.factors.story === "healthy" ? suppliers[0]! : rng.pick(suppliers);
        orderedOn = maxDate(orderedOn, this.data.metadata.simulationStart);
        const expected = maxDate(addDays(orderedOn, supplier.typicalLeadTimeDays), addDays(requiredBy, -2));
        const late = rng.chance(state.factors.supplierRisk);
        const deliveryDate = maxDate(addDays(orderedOn, 1), addDays(expected, late ? rng.int(6, 23) : rng.int(-2, 1)));
        const rejected = state.factors.story !== "healthy" && rng.chance(1 - supplier.qualityRating + 0.015);
        const partial = state.factors.story !== "healthy" && rng.chance(0.1);
        const order = {
            id: ids.next("purchaseOrder"), projectId: state.project.id, supplierId: supplier.id,
            orderedAt: at(orderedOn, 7), status: "ordered" as const, createdById: state.project.siteManagerId
        };
        const line = {
            id: ids.next("purchaseOrderLine"), purchaseOrderId: order.id, materialTypeId: budget.materialTypeId,
            phasePlanId: state.plan.id, quantityOrdered: round(Math.max(0.001, quantity)),
            unitCost: round(budget.budgetUnitCost * (state.factors.story === "healthy" ? 0.95 : rng.normal(1.06, 0.035)), 2),
            requiredByDate: requiredBy, expectedDeliveryDate: expected
        };
        const purchase: PlannedPurchase = {
            order, line, deliveryDate, rejectFraction: rejected ? 0.15 : 0,
            partialFraction: partial ? 0.65 : 1, emitted: false, receivedQuantity: 0, acceptedQuantity: 0
        };
        this.ctx.purchases.push(purchase);
        const key = inventoryKey(state.project.id, budget.materialTypeId);
        const group = this.purchaseGroups.get(key) ?? [];
        group.push(purchase);
        this.purchaseGroups.set(key, group);
        this.schedule(this.deliverySchedule, deliveryDate, purchase);
        if (!initial && orderedOn === this.date) this.emitOrder(purchase); else this.schedule(this.orderSchedule, orderedOn, purchase);
    }

    private schedule(map: Map<CivilDate, PlannedPurchase[]>, date: CivilDate, purchase: PlannedPurchase): void {
        const entries = map.get(date) ?? [];
        entries.push(purchase);
        map.set(date, entries);
    }

    private emitOrder(purchase: PlannedPurchase): void {
        purchase.emitted = true;
        this.data.purchaseOrders.push(purchase.order);
        this.data.purchaseOrderLines.push(purchase.line);
    }

    private processOrdersAndDeliveries(): void {
        for (const purchase of this.orderSchedule.get(this.date) ?? []) this.emitOrder(purchase);
        for (const p of this.deliverySchedule.get(this.date) ?? []) {
            const state = this.ctx.phases.get(p.line.phasePlanId!)!;
            const qty = round(p.receivedQuantity === 0 ? p.line.quantityOrdered * p.partialFraction : p.line.quantityOrdered - p.receivedQuantity);
            const rejected = round(qty * p.rejectFraction);
            const accepted = round(qty - rejected);
            const delivery = {
                id: this.ctx.ids.next("delivery"),
                purchaseOrderId: p.order.id,
                deliveredAt: at(this.date, 8),
                status: rejected > 0 ? "partRejected" as const : "accepted" as const,
                deliveryReference: `DEL-${p.order.id}-${this.date}`
            };
            this.data.deliveries.push(delivery);
            this.data.deliveryLines.push({
                id: this.ctx.ids.next("deliveryLine"), deliveryId: delivery.id, purchaseOrderLineId: p.line.id,
                quantityDelivered: qty, quantityAccepted: accepted, quantityRejected: rejected
            });
            const stock = this.getStock(state, state.materials.find(b => b.materialTypeId === p.line.materialTypeId)!);
            stock.quantity = round(stock.quantity + accepted);
            stock.value += accepted * p.line.unitCost;
            p.receivedQuantity = round(p.receivedQuantity + qty);
            p.acceptedQuantity = round(p.acceptedQuantity + accepted);
            p.order.status = p.receivedQuantity >= p.line.quantityOrdered - 0.0001 ? "delivered" : "partDelivered";
            if (p.order.status !== "delivered") {
                p.deliveryDate = addDays(this.date, 4);
                p.rejectFraction = 0;
                this.schedule(this.deliverySchedule, p.deliveryDate, p);
            }
            if (rejected > 0 && !state.finished) this.createIssue(state, "materialQuality", "medium", p.line.id);
        }
    }

    private processAbsencesAndWeather(): void {
        for (const [person, absence] of this.absent) if (absence.toDate < this.date) this.absent.delete(person);
        for (const person of this.data.people) {
            if (this.absent.has(person.id) || !this.ctx.rng.chance(0.002)) continue;
            const absence: PersonnelAbsence = {
                id: this.ctx.ids.next("absence"), personId: person.id, fromDate: this.date,
                toDate: addDays(this.date, this.ctx.rng.int(1, 4)), type: "sickness", planned: false
            };
            this.absent.set(person.id, absence);
            this.data.personnelAbsences.push(absence);
        }
        for (const state of this.order) {
            if (state.finished || !state.started || state.progress < 0.15) continue;
            if (!this.incidentProjects.has(state.project.id) && state.factors.story !== "healthy") {
                const person = state.assignments[0]!.personId;
                if (!this.absent.has(person)) {
                    const absence: PersonnelAbsence = {
                        id: this.ctx.ids.next("absence"),
                        personId: person,
                        fromDate: this.date,
                        toDate: addDays(this.date, 4),
                        type: "sickness",
                        planned: false,
                        notes: "Crew absence during active production"
                    };
                    this.absent.set(person, absence);
                    this.data.personnelAbsences.push(absence);
                }
                this.incidentProjects.add(state.project.id);
            }
            if (!this.weatherProjects.has(state.project.id) && state.factors.story === "ordinary" && daysBetween(state.started, this.date) >= 8) {
                this.weatherUntil.set(state.project.id, addDays(this.date, 3));
                this.weatherProjects.add(state.project.id);
            }
        }
    }

    private startBlockers(state: PhaseState): PhaseState[] {
        return state.dependencies.filter(d => {
            if (d.type === "finishToFinish") return false;
            const pred = this.ctx.phases.get(d.predecessorPhaseId)!;
            const eventDate = d.type === "finishToStart" ? pred.finished : pred.started;
            return !eventDate || addWorkingDays(eventDate, d.lagWorkingDays + Number(d.type === "finishToStart"), state.calendar) > this.date;
        }).map(d => this.ctx.phases.get(d.predecessorPhaseId)!);
    }

    private execute(state: PhaseState): void {
        if (state.finished || state.plan.plannedStart > this.date) return;
        if (!this.setupProjects.has(state.project.id)) {
            this.data.otherCostEntries.push({
                id: this.ctx.ids.next("otherCost"),
                projectId: state.project.id,
                date: this.date,
                category: "temporaryFacilities",
                description: "Site setup and facilities",
                amount: state.factors.story === "healthy" ? 10500 : 12000,
                reason: "plannedWork"
            });
            this.setupProjects.add(state.project.id);
        }
        const blockers = this.startBlockers(state);
        if (blockers.length) {
            for (const pred of blockers) this.delay(state, "prerequisite", 0, {blockingPhasePlanId: pred.plan.id});
            this.closeDelays(state);
            return;
        }
        if ((this.weatherUntil.get(state.project.id) ?? "") >= this.date && ["Foundation", "Structure", "Roofing"].includes(state.plan.name!)) {
            this.delay(state, "weather", sum(state.labour, b => b.plannedHeadcount) * 7.4);
            this.closeDelays(state);
            return;
        }

        for (const rework of state.rework) {
            if (rework.hoursLeft <= 0.0001) continue;
            const stock = this.getStock(state, rework.materialBudget);
            const possibleHours = rework.materialLeft > 0 ? rework.hoursLeft * Math.min(1, stock.quantity / rework.materialLeft) : rework.hoursLeft;
            const result = this.allocate(state, possibleHours, "defectResolution", rework.issue.id);
            const usedMaterial = Math.min(stock.quantity, rework.materialLeft * result / rework.hoursLeft);
            if (usedMaterial > 0) this.consume(state, rework.materialBudget, usedMaterial, "defectResolution", rework.issue.id);
            rework.materialLeft = round(Math.max(0, rework.materialLeft - usedMaterial));
            rework.hoursLeft = round(Math.max(0, rework.hoursLeft - result));
            if (rework.hoursLeft <= 0.0001) {
                rework.issue.status = "resolved";
                rework.issue.resolvedAt = at(this.date, 17);
            } else {
                this.delay(state, "issue", result, {issueId: rework.issue.id});
                if (possibleHours < 0.01) this.materialDelay(state, rework.materialBudget, 7.4);
            }
        }
        const fullStop = state.rework.some(r => r.hoursLeft > 0.0001 && r.issue.severity === "critical");
        const baselineHours = sum(state.labour, b => b.estimatedHours);
        const overtimeRatio = sum(state.assignments, a => Math.max(0, (this.weekHours.get(a.personId) ?? 0) - this.people.get(a.personId)!.nominalHoursPerWeek)) / Math.max(1, baselineHours);
        const productivity = state.factors.productivity * Math.max(0.85, 1 - overtimeRatio * 0.05) * this.ctx.rng.normal(1, 0.025);
        let delta = fullStop ? 0 : 1 - state.progress;
        const finishBlocked = state.dependencies.some(d => {
            if (d.type !== "finishToFinish") return false;
            const finished = this.ctx.phases.get(d.predecessorPhaseId)!.finished;
            return !finished || addWorkingDays(finished, d.lagWorkingDays, state.calendar) > this.date;
        });
        if (finishBlocked || state.rework.some(r => r.hoursLeft > 0.0001)) delta = Math.min(delta, Math.max(0, 0.999 - state.progress));
        const wasteFactors = new Map(state.materials.map(b => [b.id, Math.max(0, b.plannedWastePct / 100 * this.ctx.rng.normal(state.factors.story === "healthy" ? 0.65 : 1.12, 0.12))]));
        let limitingMaterial: MaterialBudgetLine | undefined;
        for (const budget of state.materials) {
            const supported = this.getStock(state, budget).quantity / (budget.requiredQuantity * (1 + wasteFactors.get(budget.id)!));
            if (supported < delta) {
                delta = supported;
                limitingMaterial = budget;
            }
        }
        const oldProgress = state.progress;
        const hours = this.allocate(state, Math.max(0, delta) * baselineHours / productivity, "plannedWork");
        const actualDelta = Math.min(delta, hours * productivity / baselineHours);
        state.productiveHours = round(state.productiveHours + hours);
        if (actualDelta > 0.00000001) {
            state.started ??= this.date;
            for (const budget of state.materials) {
                this.consume(state, budget, budget.requiredQuantity * actualDelta, "plannedWork");
                this.consume(state, budget, budget.requiredQuantity * actualDelta * wasteFactors.get(budget.id)!, "waste");
            }
            state.progress = Math.min(1, state.progress + actualDelta);
            const forced = !state.injectedIssue && state.factors.story === "quality" && state.progress > 0.2 && state.plan.name === "Electrical";
            if (forced || this.ctx.rng.chance(state.factors.qualityRisk)) {
                const cause = forced ? "workerMistake" : this.ctx.rng.pick(["workmanship", "workerMistake", "design", "coordination"] as const);
                const severity: Severity = forced ? "critical" : this.ctx.rng.pick(["low", "low", "medium", "medium", "high"] as const);
                this.createIssue(state, cause, severity);
                state.injectedIssue = true;
                state.progress = Math.max(oldProgress, Math.min(state.progress, 0.999));
            }
        }
        if (state.progress >= 1 - 1e-8 && !state.rework.some(r => r.hoursLeft > 0.0001) && !finishBlocked) {
            state.progress = 1;
            state.finished = this.date;
            for (const assignment of state.assignments) if (!assignment.endDate) {
                assignment.endDate = this.date;
                assignment.endDateRecordedAt = at(this.date, 17);
            }
        }
        if (!state.finished && limitingMaterial && actualDelta < 0.01) {
            const event = this.materialDelay(state, limitingMaterial, 7.4);
            if (hours < 0.01) this.allocate(state, 1, "standby", undefined, event.id);
        }
        if (!state.finished && hours < sum(state.labour, b => b.plannedHeadcount) * 3 && state.progress < 0.999 && !fullStop && !limitingMaterial) {
            const absence = state.assignments.map(a => this.absent.get(a.personId)).find(Boolean);
            this.delay(state, absence ? "personnelAbsence" : "other", Math.max(0, 7.4 - hours), {absenceId: absence?.id});
        }
        if (finishBlocked && state.progress >= 0.999) {
            const dep = state.dependencies.find(d => d.type === "finishToFinish")!;
            this.delay(state, "prerequisite", 0, {blockingPhasePlanId: dep.predecessorPhaseId});
        }
        if (state.progress < oldProgress) throw new Error("Simulation decreased progress");
        this.closeDelays(state);
    }

    private allocate(state: PhaseState, requested: number, reason: LabourEntry["activityReason"], issueId?: Id<"issue">, delayEventId?: Id<"delay">): number {
        if (requested <= 1e-9) return 0;
        // Entries have four decimal places; round the final work quantum up so a tiny
        // remainder cannot strand a phase at 99.9999% and block every successor.
        requested = Math.ceil(requested * 10000) / 10000;
        const recovery = state.factors.story !== "healthy" && this.date > state.plan.plannedFinish;
        const candidates = state.assignments.filter(a => a.startDate <= this.date && (!a.endDate || a.endDate >= this.date)).map(a => this.people.get(a.personId)!);
        const unavailable = candidates.filter(p => this.absent.has(p.id) || (this.dayHours.get(p.id) ?? 0) >= 7.4 || (this.weekHours.get(p.id) ?? 0) >= p.nominalHoursPerWeek);
        if (state.factors.story === "healthy") for (const _person of unavailable) {
            const replacement = (this.workforce.get(state.labour[0]!.personnelTypeId) ?? []).find(p => !this.absent.has(p.id) && !candidates.includes(p) &&
                !this.dayHours.has(p.id) && (this.weekHours.get(p.id) ?? 0) < p.nominalHoursPerWeek);
            if (replacement) {
                candidates.push(replacement);
                const assignment = {
                    id: this.ctx.ids.next("assignment"),
                    personId: replacement.id,
                    projectId: state.project.id,
                    phasePlanId: state.plan.id,
                    startDate: this.date,
                    endDate: this.date,
                    createdAt: at(this.date, 9),
                    plannedHoursPerWeek: 37,
                    role: "Temporary cover"
                };
                state.assignments.push(assignment);
                this.data.personnelAssignments.push(assignment);
            }
        }
        let remaining = requested;
        for (const person of new Map(candidates.map(p => [p.id, p])).values()) {
            if (this.absent.has(person.id) || remaining < 0.0001) continue;
            const daily = this.dayHours.get(person.id) ?? 0;
            const weekly = this.weekHours.get(person.id) ?? 0;
            const hours = Math.floor(Math.min(remaining, (recovery ? 10 : 7.4) - daily, (recovery ? 50 : person.nominalHoursPerWeek) - weekly) * 10000) / 10000;
            if (hours < 0.0001) continue;
            this.dayHours.set(person.id, round(daily + hours));
            this.weekHours.set(person.id, round(weekly + hours));
            this.data.labourEntries.push({
                id: this.ctx.ids.next("labour"),
                siteReportId: this.siteReport(state),
                personId: person.id,
                projectId: state.project.id,
                phasePlanId: state.plan.id,
                workDate: this.date,
                hours,
                activityReason: reason,
                issueId,
                delayEventId
            });
            remaining -= hours;
        }
        return round(requested - remaining);
    }

    private consume(state: PhaseState, budget: MaterialBudgetLine, quantity: number, reason: "plannedWork" | "waste" | "defectResolution", issueId?: Id<"issue">): void {
        const stock = this.getStock(state, budget);
        quantity = Math.min(stock.quantity, round(quantity));
        if (quantity <= 0) return;
        const cost = stock.quantity > 0 ? stock.value / stock.quantity : budget.budgetUnitCost;
        this.data.materialUsageEntries.push({
            id: this.ctx.ids.next("materialUsage"), siteReportId: this.siteReport(state),
            projectId: state.project.id, phasePlanId: state.plan.id, materialTypeId: budget.materialTypeId,
            usedAt: at(this.date, 16), quantity, usageReason: reason, unitCostApplied: round(cost, 6), issueId
        });
        stock.value = Math.max(0, stock.value - quantity * cost);
        stock.quantity = round(Math.max(0, stock.quantity - quantity));
    }

    private siteReport(state: PhaseState): Id<"siteReport"> {
        let id = this.siteReports.get(state.project.id);
        if (!id) {
            id = this.ctx.ids.next("siteReport");
            this.siteReports.set(state.project.id, id);
            this.data.siteReports.push({
                id,
                projectId: state.project.id,
                reportDate: this.date,
                shift: "day",
                reporterId: state.project.siteManagerId,
                createdAt: at(this.date, 17)
            });
        }
        return id;
    }

    private createIssue(state: PhaseState, cause: IssueCauseCategory, severity: Severity, purchaseOrderLineId?: Id<"purchaseOrderLine">): void {
        const purchase = purchaseOrderLineId ? this.ctx.purchases.find(p => p.line.id === purchaseOrderLineId) : undefined;
        const budget = state.materials.find(b => b.materialTypeId === purchase?.line.materialTypeId) ?? state.materials[0]!;
        const hours = severity === "critical" ? 32 : severity === "high" ? 16 : severity === "medium" ? 8 : 3;
        const material = round(budget.requiredQuantity * (severity === "critical" ? 0.2 : 0.04));
        const issue: Issue = {
            id: this.ctx.ids.next("issue"),
            projectId: state.project.id,
            scopeNodeId: state.plan.scopeNodeId,
            phasePlanId: state.plan.id,
            issueType: cause === "design" ? "design" : cause === "materialQuality" ? "quality" : "defect",
            severity,
            priority: severity === "critical" ? "critical" : "normal",
            status: "open",
            title: `${state.plan.name}: ${cause === "workerMistake" ? "incorrect installation" : cause === "materialQuality" ? "rejected material" : cause === "design" ? "drawing revision required" : "work requires correction"}`,
            description: `${cause} requires corrective work in the affected scope.`,
            reportedAt: at(this.date, purchaseOrderLineId ? 9 : 17),
            reportedById: state.project.siteManagerId,
            assignedToId: state.assignments[0]!.personId,
            dueAt: at(addDays(this.date, severity === "critical" ? 3 : 10)),
            estimatedCostImpact: round(hours * state.labour[0]!.budgetRegularHourlyCost + material * budget.budgetUnitCost, 2),
            estimatedDelayHours: hours
        };
        this.data.issues.push(issue);
        this.data.issueCauses.push({
            id: this.ctx.ids.next("issueCause"), issueId: issue.id, category: cause, status: "confirmed", primary: true,
            personId: cause === "workerMistake" || cause === "workmanship" ? state.assignments[0]!.personId : undefined,
            materialTypeId: purchase?.line.materialTypeId, supplierId: purchase?.order.supplierId, purchaseOrderLineId
        });
        state.rework.push({issue, hoursLeft: hours, materialBudget: budget, materialLeft: material});
        if (severity === "critical") this.data.otherCostEntries.push({
            id: this.ctx.ids.next("otherCost"),
            projectId: state.project.id,
            phasePlanId: state.plan.id,
            date: this.date,
            category: "inspection",
            description: "Specialist inspection after critical defect",
            amount: 2500,
            reason: "defectResolution",
            issueId: issue.id
        });
    }

    private delay(state: PhaseState, cause: DelayCauseType, hours: number, links: Partial<DelayEvent> = {}): DelayEvent {
        const key = `${cause}/${links.blockingPhasePlanId ?? links.issueId ?? links.absenceId ?? links.materialTypeId ?? ""}`;
        const touchedKey = `${state.plan.id}/${key}`;
        let existing = state.openDelays.get(key);
        if (!existing) {
            const event: DelayEvent = {
                id: this.ctx.ids.next("delay"),
                projectId: state.project.id,
                scopeNodeId: state.plan.scopeNodeId,
                affectedPhasePlanIds: [state.plan.id],
                reportedAt: at(this.date, 17),
                startedAt: at(this.date, 9),
                status: "active",
                impactType: cause === "prerequisite" || cause === "weather" ? "fullStop" : cause === "issue" ? "rework" : "reducedCapacity",
                causeType: cause,
                estimatedLostHours: 0,
                estimatedScheduleImpactDays: 0,
                description: `${state.plan.name}: ${cause === "other" ? "shared crew capacity unavailable" : cause}`, ...links
            };
            existing = {event, lastDate: this.date};
            state.openDelays.set(key, existing);
            this.data.delayEvents.push(event);
        }
        if (!this.touchedDelays.has(touchedKey)) {
            existing.lastDate = this.date;
            existing.event.estimatedLostHours = round(existing.event.estimatedLostHours + hours);
            existing.event.estimatedScheduleImpactDays++;
            this.data.delayImpactReports.push({
                id: this.ctx.ids.next("delayImpact"), delayEventId: existing.event.id, date: this.date,
                estimatedLostHours: round(hours), estimatedScheduleImpactDays: 1
            });
        }
        this.touchedDelays.add(touchedKey);
        return existing.event;
    }

    private materialDelay(state: PhaseState, budget: MaterialBudgetLine, hours: number): DelayEvent {
        const pending = (this.purchaseGroups.get(inventoryKey(state.project.id, budget.materialTypeId)) ?? []).find(p => p.emitted && p.receivedQuantity < p.line.quantityOrdered - 0.0001);
        return this.delay(state, pending && pending.line.expectedDeliveryDate < this.date ? "lateDelivery" : "materialShortage", hours,
            {
                materialTypeId: budget.materialTypeId,
                purchaseOrderLineId: pending?.line.id,
                supplierId: pending?.order.supplierId
            });
    }

    private closeDelays(state: PhaseState): void {
        for (const [key, open] of state.openDelays) if (!this.touchedDelays.has(`${state.plan.id}/${key}`) || state.finished) {
            open.event.endedAt = at(this.date, state.finished ? 17 : 9);
            open.event.status = "ended";
            state.openDelays.delete(key);
        }
    }

    private reorder(): void {
        const needs = new Map<string, { state: PhaseState; budget: MaterialBudgetLine; quantity: number }>();
        for (const state of this.order) {
            if (state.finished) continue;
            for (const budget of state.materials) {
                const key = inventoryKey(state.project.id, budget.materialTypeId);
                const need = needs.get(key) ?? {state, budget, quantity: 0};
                need.quantity += budget.requiredQuantity * (1 - state.progress) * (1 + budget.plannedWastePct / 100);
                need.quantity += sum(state.rework.filter(r => r.materialBudget.materialTypeId === budget.materialTypeId), r => r.materialLeft);
                needs.set(key, need);
            }
        }
        for (const [key, need] of needs) {
            const inventory = this.stock.get(key)?.quantity ?? 0;
            const ordered = sum(this.purchaseGroups.get(key) ?? [], p => p.line.quantityOrdered - p.receivedQuantity);
            const shortage = round(need.quantity - inventory - ordered);
            if (shortage > Math.max(0.001, need.quantity * 0.015)) {
                this.purchase(need.state, need.budget, shortage + need.quantity * 0.03, this.date,
                    maxDate(this.date, need.state.plan.plannedStart), false);
            }
        }
    }

    private forecastAndReport(): void {
        for (const state of this.order) {
            if (state.finished && state.lastReportedProgress === 100) continue;
            let earliest = state.started ?? maxDate(state.plan.plannedStart, workingOnOrAfter(addDays(this.date, 1), state.calendar));
            let finishBound = earliest;
            for (const d of state.dependencies) {
                const pred = this.ctx.phases.get(d.predecessorPhaseId)!;
                if (d.type === "finishToFinish") finishBound = maxDate(finishBound, addWorkingDays(pred.forecastFinish, d.lagWorkingDays, state.calendar));
                else if (!state.started) earliest = maxDate(earliest, addWorkingDays(d.type === "finishToStart" ? pred.forecastFinish : pred.forecastStart,
                    d.lagWorkingDays + Number(d.type === "finishToStart"), state.calendar));
            }
            const baseline = sum(state.labour, b => b.estimatedHours);
            const productivity = state.productiveHours > 0 ? Math.max(0.3, baseline * state.progress / state.productiveHours) : 1;
            const capacity = Math.max(3.7, sum(state.labour, b => b.plannedHeadcount) * 7.4);
            const remainingHours = baseline * (1 - state.progress) / productivity + sum(state.rework, r => r.hoursLeft);
            let remainingStart = workingOnOrAfter(maxDate(earliest, addDays(this.date, 1)), state.calendar);
            for (const budget of state.materials) if (this.getStock(state, budget).quantity < budget.requiredQuantity * 0.01) {
                const known = (this.purchaseGroups.get(inventoryKey(state.project.id, budget.materialTypeId)) ?? []).filter(p => p.emitted && p.receivedQuantity < p.line.quantityOrdered - 0.0001);
                const next = known.map(p => p.line.expectedDeliveryDate).sort(compare)[0];
                if (next) remainingStart = workingOnOrAfter(maxDate(remainingStart, next), state.calendar);
            }
            state.forecastStart = state.started ?? remainingStart;
            state.forecastFinish = state.finished ?? maxDate(finishBound, addWorkingDays(remainingStart, Math.max(0, Math.ceil(remainingHours / capacity) - 1), state.calendar));
            if (state.plan.plannedStart > this.date) continue;
            const status: PhaseExecutionStatus = state.finished ? "complete" : state.openDelays.size ? "blocked" : state.started ? "inProgress" : "notStarted";
            const progress = state.finished ? 100 : Math.min(99.9999, round(state.progress * 100, 4));
            const cadence = state.factors.story === "quality" ? 9 : 3;
            if (!state.lastReportDate || status !== state.lastReportedStatus || progress === 100 ||
                daysBetween(state.lastReportDate, this.date) >= cadence || progress - state.lastReportedProgress >= (cadence === 9 ? 25 : 5)) {
                this.data.progressReports.push({
                    id: this.ctx.ids.next("progressReport"),
                    siteReportId: this.siteReport(state),
                    projectId: state.project.id,
                    phasePlanId: state.plan.id,
                    reportedAt: at(this.date, 18),
                    percentComplete: progress,
                    executionStatus: status,
                    forecastFinishDate: state.forecastFinish
                });
                state.lastReportDate = this.date;
                state.lastReportedProgress = progress;
                state.lastReportedStatus = status;
            }
        }
    }

    private milestones(): void {
        for (const [projectId, milestones] of this.milestoneGroups) {
            const phases = this.phaseGroups.get(projectId)!;
            if (phases[0]!.project.plannedStart > this.date) continue;
            for (const milestone of milestones) {
                const states = milestone.phasePlanIds.map(id => this.ctx.phases.get(id)!);
                const finished = states.every(s => s.finished);
                const forecast = maxDate(...states.map(s => s.forecastFinish));
                const status = finished ? "complete" : forecast > milestone.plannedDate ? "atRisk" : "onTrack";
                const previous = this.latestMilestones.get(milestone.id);
                if (!previous || previous.status !== status || Math.abs(daysBetween(previous.forecastDate!, forecast)) >= 3) {
                    const report = {
                        id: this.ctx.ids.next("milestoneReport"),
                        milestonePlanId: milestone.id,
                        reportedAt: at(this.date, 19),
                        status: status as "complete" | "atRisk" | "onTrack",
                        forecastDate: forecast,
                        completedAt: finished ? at(maxDate(...states.map(s => s.finished!)), 18) : undefined
                    };
                    this.data.milestoneReports.push(report);
                    this.latestMilestones.set(milestone.id, report);
                }
            }
        }
    }
}
