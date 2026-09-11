import type {
    CivilDate,
    DelayEvent,
    Id,
    Issue,
    LabourBudgetLine,
    MaterialBudgetLine,
    PersonnelAssignment,
    PhaseDependency,
    PhasePlan,
    PhasePlanId,
    Project,
    ProjectId,
    PurchaseOrder,
    PurchaseOrderLine,
    ScenarioData,
    WorkingCalendar
} from "../../src/domain/model.ts";
import type {Random} from "./random.ts";

export class IdSequence {
    private counters = new Map<string, number>();

    next<K extends string>(kind: K): Id<K> {
        const n = (this.counters.get(kind) ?? 0) + 1;
        this.counters.set(kind, n);
        return `${kind}-${String(n).padStart(8, "0")}` as Id<K>;
    }
}

export interface ProjectFactors {
    productivity: number;
    qualityRisk: number;
    supplierRisk: number;
    absenceRisk: number;
    cohort: "historic" | "active" | "future";
    story: "healthy" | "supply" | "quality" | "ordinary";
}

export interface Rework {
    issue: Issue;
    hoursLeft: number;
    materialBudget: MaterialBudgetLine;
    materialLeft: number;
}

export interface PhaseState {
    plan: PhasePlan;
    project: Project;
    calendar: WorkingCalendar;
    factors: ProjectFactors;
    labour: LabourBudgetLine[];
    materials: MaterialBudgetLine[];
    assignments: PersonnelAssignment[];
    dependencies: PhaseDependency[];
    progress: number;
    productiveHours: number;
    started?: CivilDate;
    finished?: CivilDate;
    rework: Rework[];
    forecastStart: CivilDate;
    forecastFinish: CivilDate;
    lastReportDate?: CivilDate;
    lastReportedProgress: number;
    lastReportedStatus?: string;
    injectedIssue: boolean;
    injectedAbsence: boolean;
    injectedWeather: boolean;
    openDelays: Map<string, { event: DelayEvent; lastDate: CivilDate }>;
}

export interface PlannedPurchase {
    order: PurchaseOrder;
    line: PurchaseOrderLine;
    /** Hidden realization, never consulted by forecasts before the delivery occurs. */
    deliveryDate: CivilDate;
    rejectFraction: number;
    partialFraction: number;
    emitted: boolean;
    receivedQuantity: number;
    acceptedQuantity: number;
}

export interface Inventory {
    quantity: number;
    value: number
}

export interface GenerationContext {
    data: ScenarioData;
    rng: Random;
    ids: IdSequence;
    factors: Map<ProjectId, ProjectFactors>;
    phases: Map<PhasePlanId, PhaseState>;
    purchases: PlannedPurchase[];
}

export function inventoryKey(projectId: ProjectId, materialId: string): string {
    return `${projectId}/${materialId}`;
}
