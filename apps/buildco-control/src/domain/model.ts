/** Domain facts are independent of the generator, transport and UI. */
export type Id<K extends string> = string & { readonly __entity: K };
export type CivilDate = string & { readonly __civilDate: unique symbol };
export type Instant = string & { readonly __instant: unique symbol };
export type ProjectId = Id<"project">;
export type PersonId = Id<"person">;
export type PhasePlanId = Id<"phase">;
export type ScopeNodeId = Id<"scope">;
export type IssueId = Id<"issue">;
export type MaterialTypeId = Id<"materialType">;
export type PersonnelTypeId = Id<"personnelType">;
export type SupplierId = Id<"supplier">;
export type Priority = "low" | "normal" | "high" | "critical";
export type Severity = "low" | "medium" | "high" | "critical";
export type ProjectType =
    "highRise"
    | "housingDevelopment"
    | "factory"
    | "warehouse"
    | "office"
    | "renovation"
    | "infrastructure";
export type MaterialCategory =
    "masonry"
    | "concrete"
    | "structural"
    | "electrical"
    | "plumbing"
    | "HVAC"
    | "insulation"
    | "windowsDoors"
    | "roofing"
    | "finishes";
export type MaterialUnit = "piece" | "metre" | "squareMetre" | "cubicMetre" | "kilogram" | "spool" | "pallet";
export type PersonnelCategory =
    "general"
    | "carpentry"
    | "electrical"
    | "masonry"
    | "plumbing"
    | "HVAC"
    | "steelwork"
    | "specialist"
    | "supervision";
export type PhaseCategory = "preparation" | "structural" | "envelope" | "services" | "finishes" | "completion";
export type PhaseExecutionStatus = "notStarted" | "inProgress" | "blocked" | "paused" | "complete";
export type DependencyType = "finishToStart" | "startToStart" | "finishToFinish";
export type OtherCostCategory =
    "equipment"
    | "transport"
    | "subcontractor"
    | "permit"
    | "temporaryFacilities"
    | "inspection"
    | "other";
export type CostReason = "plannedWork" | "rework" | "defectResolution" | "changeWork" | "standby" | "waste" | "other";
export type IssueCauseCategory =
    "supplier"
    | "materialQuality"
    | "workmanship"
    | "workerMistake"
    | "design"
    | "planning"
    | "coordination"
    | "equipment"
    | "weather"
    | "clientChange"
    | "regulatory"
    | "transportDamage"
    | "unknown";
export type DelayCauseType =
    "personnelAbsence"
    | "materialShortage"
    | "lateDelivery"
    | "issue"
    | "weather"
    | "equipmentFailure"
    | "prerequisite"
    | "accessRestriction"
    | "permitRegulatory"
    | "clientHold"
    | "other";

export interface MaterialType {
    id: MaterialTypeId;
    code: string;
    name: string;
    category: MaterialCategory;
    unit: MaterialUnit;
    standardUnitCost: number;
    defaultLeadTimeDays: number;
    defaultWasteAllowancePct: number;
    criticality: "normal" | "important" | "critical";
}

export interface PersonnelType {
    id: PersonnelTypeId;
    name: string;
    category: PersonnelCategory;
    defaultNominalHoursPerWeek: number;
    planningRegularHourlyCost: number;
    planningOvertimeHourlyCost: number;
    maxRecommendedHoursPerWeek: number;
}

export interface Person {
    id: PersonId;
    name: string;
    personnelTypeId: PersonnelTypeId;
    employmentKind: "employee" | "subcontractor";
    employerName?: string;
    nominalHoursPerWeek: number;
    supervisorId?: PersonId;
    active: boolean;
}

export interface PersonnelCostRate {
    id: Id<"costRate">;
    personId: PersonId;
    validFrom: CivilDate;
    validTo?: CivilDate;
    regularHourlyCost: number;
    overtimeHourlyCost: number;
}

export interface Supplier {
    id: SupplierId;
    name: string;
    materialCategories: readonly MaterialCategory[];
    typicalLeadTimeDays: number;
    reliabilityRating: number;
    qualityRating: number;
    region?: string;
}

export interface Customer {
    id: Id<"customer">;
    name: string;
    type: "publicAuthority" | "residentialDeveloper" | "commercialDeveloper" | "industrial" | "internal" | "infrastructureAuthority";
    sector?: string;
}

export interface PhaseType {
    id: Id<"phaseType">;
    name: string;
    category: PhaseCategory;
    typicalOutputUnit?: string;
}

export interface ProjectRules {
    nightWorkAllowed: boolean;
    weekendWorkAllowed: boolean;
    occupiedSite: boolean;
    restrictedAccess: boolean;
    securityClearanceRequired: boolean;
    noiseRestrictions: boolean;
    environmentalRestrictions: boolean;
}

export interface Project {
    id: ProjectId;
    code: string;
    name: string;
    projectType: ProjectType;
    customerId: Id<"customer">;
    contractType: "fixedPrice" | "costPlus" | "targetCost";
    status: "planned" | "active" | "completed";
    priority: Priority;
    complexity: "low" | "medium" | "high";
    baselineRisk: "low" | "medium" | "high";
    location: string;
    region: string;
    currency: string;
    projectManagerId: PersonId;
    siteManagerId: PersonId;
    plannedStart: CivilDate;
    plannedCompletion: CivilDate;
    workingCalendarId: Id<"calendar">;
    rules: ProjectRules;
}

export interface WorkingCalendar {
    id: Id<"calendar">;
    name: string;
    /** ISO weekdays, Monday = 1, Sunday = 7. */
    workingDays: readonly number[];
    regularHoursPerDay: number;
    holidays: readonly CivilDate[];
}

export interface ScopeNode {
    id: ScopeNodeId;
    projectId: ProjectId;
    parentId?: ScopeNodeId;
    type: "site" | "building" | "floor" | "basement" | "roof" | "unit" | "hall" | "zone" | "room" | "segment" | "external";
    name: string;
    sequence: number;
    areaM2?: number;
    lengthM?: number;
    volumeM3?: number;
    unitCount?: number;
    floorNumber?: number;
    zoneCode?: string;
}

export interface ProjectPlan {
    id: Id<"projectPlan">;
    projectId: ProjectId;
    version: number;
    status: "draft" | "approved" | "superseded";
    createdAt: Instant;
    approvedAt?: Instant;
}

export interface PhasePlan {
    id: PhasePlanId;
    projectPlanId: Id<"projectPlan">;
    projectId: ProjectId;
    scopeNodeId: ScopeNodeId;
    phaseTypeId: Id<"phaseType">;
    name?: string;
    /** Inclusive working dates. A zero-lag finish-to-start successor starts the next working day. */
    plannedStart: CivilDate;
    plannedFinish: CivilDate;
    progressProfile: "linear" | "frontLoaded" | "backLoaded" | "sCurve";
    progressWeight: number;
    plannedOutputQuantity?: number;
    outputUnit?: string;
    priority: Priority;
}

export interface PhaseDependency {
    id: Id<"dependency">;
    predecessorPhaseId: PhasePlanId;
    successorPhaseId: PhasePlanId;
    type: DependencyType;
    lagWorkingDays: number;
}

export interface LabourBudgetLine {
    id: Id<"labourBudget">;
    phasePlanId: PhasePlanId;
    personnelTypeId: PersonnelTypeId;
    estimatedHours: number;
    plannedHeadcount: number;
    budgetRegularHourlyCost: number;
    budgetOvertimeHourlyCost: number;
}

export interface MaterialBudgetLine {
    id: Id<"materialBudget">;
    phasePlanId: PhasePlanId;
    materialTypeId: MaterialTypeId;
    requiredQuantity: number;
    plannedWastePct: number;
    budgetedQuantity: number;
    budgetUnitCost: number;
    requiredByDate: CivilDate;
}

export interface OtherBudgetLine {
    id: Id<"otherBudget">;
    projectId: ProjectId;
    phasePlanId?: PhasePlanId;
    category: OtherCostCategory;
    description: string;
    budgetedAmount: number;
}

export interface MilestonePlan {
    id: Id<"milestone">;
    projectPlanId: Id<"projectPlan">;
    projectId: ProjectId;
    scopeNodeId?: ScopeNodeId;
    name: string;
    category: "structure" | "weatherTight" | "services" | "completion" | "handover";
    plannedDate: CivilDate;
    critical: boolean;
    phasePlanIds: readonly PhasePlanId[];
}

export interface PersonnelAssignment {
    id: Id<"assignment">;
    personId: PersonId;
    projectId: ProjectId;
    phasePlanId: PhasePlanId;
    startDate: CivilDate;
    endDate?: CivilDate;
    plannedHoursPerWeek: number;
    role?: string;
    createdAt?: Instant;
    /** Distinguishes a later recorded actual end from an already-known planned end. */
    endDateRecordedAt?: Instant;
}

export interface PersonnelAbsence {
    id: Id<"absence">;
    personId: PersonId;
    fromDate: CivilDate;
    toDate: CivilDate;
    type: "sickness" | "vacation" | "injury" | "training" | "other";
    planned: boolean;
    notes?: string;
}

export interface SiteReport {
    id: Id<"siteReport">;
    projectId: ProjectId;
    scopeNodeId?: ScopeNodeId;
    reportDate: CivilDate;
    shift: "day" | "evening" | "night";
    reporterId: PersonId;
    createdAt: Instant;
    notes?: string;
}

export interface ProgressReport {
    id: Id<"progressReport">;
    siteReportId?: Id<"siteReport">;
    projectId: ProjectId;
    phasePlanId: PhasePlanId;
    reportedAt: Instant;
    percentComplete: number;
    executionStatus: PhaseExecutionStatus;
    forecastFinishDate?: CivilDate;
    comment?: string;
}

export interface LabourEntry {
    id: Id<"labour">;
    siteReportId?: Id<"siteReport">;
    personId: PersonId;
    projectId: ProjectId;
    phasePlanId: PhasePlanId;
    workDate: CivilDate;
    hours: number;
    activityReason: Exclude<CostReason, "waste">;
    issueId?: IssueId;
    delayEventId?: Id<"delay">;
    description?: string;
}

export interface MaterialUsageEntry {
    id: Id<"materialUsage">;
    siteReportId?: Id<"siteReport">;
    projectId: ProjectId;
    phasePlanId: PhasePlanId;
    materialTypeId: MaterialTypeId;
    usedAt: Instant;
    quantity: number;
    usageReason: Exclude<CostReason, "standby">;
    unitCostApplied: number;
    issueId?: IssueId;
    description?: string;
}

export interface PurchaseOrder {
    id: Id<"purchaseOrder">;
    projectId: ProjectId;
    supplierId: SupplierId;
    orderedAt: Instant;
    status: "ordered" | "partDelivered" | "delivered" | "cancelled";
    createdById: PersonId;
}

export interface PurchaseOrderLine {
    id: Id<"purchaseOrderLine">;
    purchaseOrderId: Id<"purchaseOrder">;
    materialTypeId: MaterialTypeId;
    phasePlanId?: PhasePlanId;
    quantityOrdered: number;
    unitCost: number;
    requiredByDate: CivilDate;
    expectedDeliveryDate: CivilDate;
}

export interface Delivery {
    id: Id<"delivery">;
    purchaseOrderId: Id<"purchaseOrder">;
    deliveredAt: Instant;
    status: "accepted" | "partRejected" | "rejected";
    deliveryReference?: string;
}

export interface DeliveryLine {
    id: Id<"deliveryLine">;
    deliveryId: Id<"delivery">;
    purchaseOrderLineId: Id<"purchaseOrderLine">;
    quantityDelivered: number;
    quantityAccepted: number;
    quantityRejected: number;
}

export interface Issue {
    id: IssueId;
    projectId: ProjectId;
    scopeNodeId: ScopeNodeId;
    phasePlanId?: PhasePlanId;
    issueType: "defect" | "quality" | "safety" | "supply" | "design" | "coordination" | "damage" | "other";
    severity: Severity;
    priority: Priority;
    status: "open" | "investigating" | "planned" | "inResolution" | "resolved" | "closed";
    title: string;
    description: string;
    reportedAt: Instant;
    reportedById: PersonId;
    assignedToId?: PersonId;
    dueAt?: Instant;
    resolvedAt?: Instant;
    estimatedCostImpact: number;
    estimatedDelayHours: number;
}

export interface IssueCause {
    id: Id<"issueCause">;
    issueId: IssueId;
    category: IssueCauseCategory;
    status: "suspected" | "confirmed" | "rejected";
    primary: boolean;
    supplierId?: SupplierId;
    personId?: PersonId;
    materialTypeId?: MaterialTypeId;
    purchaseOrderLineId?: Id<"purchaseOrderLine">;
    description?: string;
}

export interface OtherCostEntry {
    id: Id<"otherCost">;
    projectId: ProjectId;
    phasePlanId?: PhasePlanId;
    date: CivilDate;
    category: OtherCostCategory;
    description: string;
    amount: number;
    reason: CostReason;
    issueId?: IssueId;
    delayEventId?: Id<"delay">;
}

export interface DelayEvent {
    id: Id<"delay">;
    projectId: ProjectId;
    scopeNodeId?: ScopeNodeId;
    affectedPhasePlanIds: readonly PhasePlanId[];
    reportedAt: Instant;
    startedAt: Instant;
    endedAt?: Instant;
    status: "active" | "ended";
    impactType: "fullStop" | "reducedCapacity" | "waiting" | "rework" | "resequenced";
    causeType: DelayCauseType;
    estimatedLostHours: number;
    estimatedScheduleImpactDays: number;
    description: string;
    issueId?: IssueId;
    absenceId?: Id<"absence">;
    purchaseOrderLineId?: Id<"purchaseOrderLine">;
    deliveryId?: Id<"delivery">;
    materialTypeId?: MaterialTypeId;
    supplierId?: SupplierId;
    blockingPhasePlanId?: PhasePlanId;
}

/** Dated estimates prevent a later extension of a delay leaking into historical queries. */
export interface DelayImpactReport {
    id: Id<"delayImpact">;
    delayEventId: Id<"delay">;
    date: CivilDate;
    estimatedLostHours: number;
    estimatedScheduleImpactDays: number;
}

export interface MilestoneReport {
    id: Id<"milestoneReport">;
    milestonePlanId: Id<"milestone">;
    reportedAt: Instant;
    status: "planned" | "onTrack" | "atRisk" | "complete";
    forecastDate?: CivilDate;
    completedAt?: Instant;
    comment?: string;
}

export interface ScenarioGenerationOptions {
    seed: number;
    anchorDate: string;
    profile: "small" | "demo" | "stress";
    projectCount?: number;
    simulationMonthsBeforeAnchor?: number;
    simulationMonthsAfterAnchor?: number;
}

export interface ScenarioMetadata {
    schemaVersion: 1;
    generatorVersion: 1;
    seed: number;
    anchorDate: CivilDate;
    profile: ScenarioGenerationOptions["profile"];
    projectCount: number;
    simulationStart: CivilDate;
    simulationEnd: CivilDate;
    simulationMonthsBeforeAnchor: number;
    simulationMonthsAfterAnchor: number;
    asOfDate?: CivilDate;
}

export interface ScenarioData {
    metadata: ScenarioMetadata;
    materialTypes: MaterialType[];
    personnelTypes: PersonnelType[];
    people: Person[];
    personnelCostRates: PersonnelCostRate[];
    suppliers: Supplier[];
    customers: Customer[];
    phaseTypes: PhaseType[];
    projects: Project[];
    workingCalendars: WorkingCalendar[];
    scopeNodes: ScopeNode[];
    projectPlans: ProjectPlan[];
    phasePlans: PhasePlan[];
    phaseDependencies: PhaseDependency[];
    labourBudgetLines: LabourBudgetLine[];
    materialBudgetLines: MaterialBudgetLine[];
    otherBudgetLines: OtherBudgetLine[];
    milestonePlans: MilestonePlan[];
    personnelAssignments: PersonnelAssignment[];
    personnelAbsences: PersonnelAbsence[];
    siteReports: SiteReport[];
    progressReports: ProgressReport[];
    labourEntries: LabourEntry[];
    materialUsageEntries: MaterialUsageEntry[];
    purchaseOrders: PurchaseOrder[];
    purchaseOrderLines: PurchaseOrderLine[];
    deliveries: Delivery[];
    deliveryLines: DeliveryLine[];
    issues: Issue[];
    issueCauses: IssueCause[];
    otherCostEntries: OtherCostEntry[];
    delayEvents: DelayEvent[];
    delayImpactReports: DelayImpactReport[];
    milestoneReports: MilestoneReport[];
}

export interface PhaseHealth {
    phasePlanId: PhasePlanId;
    reportedProgress: number;
    plannedProgressAtDate: number;
    progressVariance: number;
    plannedStart: CivilDate;
    plannedFinish: CivilDate;
    forecastStart: CivilDate;
    forecastFinish: CivilDate;
    scheduleVarianceDays: number;
    prerequisiteBlocked: boolean;
    blockingPhaseIds: readonly PhasePlanId[];
    budgetLabourHours: number;
    actualLabourHours: number;
    overtimeHours: number;
    budgetLabourCost: number;
    actualLabourCost: number;
    budgetMaterialCost: number;
    actualMaterialCost: number;
    totalBudgetCost: number;
    actualDirectCost: number;
    costVariance: number;
    expectedCostAtProgress: number;
    plannedHeadcount: number;
    assignedHeadcount: number;
    plannedHoursPerWeek: number;
    availableHoursPerWeek: number;
    materialShortageCount: number;
    lateMaterialCount: number;
    openIssueCount: number;
    overdueIssueCount: number;
    criticalIssueCount: number;
    issueAttributedCost: number;
    activeDelayCount: number;
    estimatedDelayDays: number;
    staleReportingDays: number;
}
