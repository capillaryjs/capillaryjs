import type {
    CivilDate,
    MaterialCategory,
    MaterialUnit,
    PersonnelCategory,
    PhaseCategory,
    PhasePlan,
    PhasePlanId,
    Project,
    ProjectType,
    ScenarioData,
    ScenarioGenerationOptions,
    ScopeNode
} from "../../src/domain/model.ts";
import {
    addDays,
    addMonths,
    at,
    civilDate,
    daysBetween,
    maxDate,
    workingDaysInclusive,
    workingOnOrAfter
} from "../../src/domain/calendar.ts";
import {byId, groupBy, round, sum} from "../../src/domain/collections.ts";
import {scheduleBaseline} from "../../src/domain/dependencies.ts";
import {type GenerationContext, IdSequence, type ProjectFactors} from "./state.ts";
import {Random} from "./random.ts";

const MATERIALS: readonly [string, MaterialCategory, MaterialUnit, number][] = [
    ["Ready-mix concrete", "concrete", "cubicMetre", 950], ["Reinforcement steel", "structural", "kilogram", 14],
    ["Facing brick", "masonry", "piece", 9], ["Mortar", "masonry", "kilogram", 3],
    ["Power cable", "electrical", "metre", 11], ["Cable tray", "electrical", "metre", 75],
    ["Water pipe", "plumbing", "metre", 55], ["Pipe fittings", "plumbing", "piece", 40],
    ["Ventilation duct", "HVAC", "metre", 140], ["Air handling unit", "HVAC", "piece", 12500],
    ["Insulation", "insulation", "squareMetre", 65], ["Glazing", "windowsDoors", "squareMetre", 650],
    ["Window frame", "windowsDoors", "piece", 1800], ["Roof membrane", "roofing", "squareMetre", 90],
    ["Roof flashing", "roofing", "metre", 125], ["Interior paint", "finishes", "kilogram", 45],
    ["Floor finish", "finishes", "squareMetre", 160], ["Door set", "windowsDoors", "piece", 2400],
];
const TRADES: readonly [string, PersonnelCategory, number][] = [
    ["General labourer", "general", 290], ["Carpenter", "carpentry", 400], ["Electrician", "electrical", 460],
    ["Bricklayer", "masonry", 385], ["Plumber", "plumbing", 430], ["HVAC technician", "HVAC", 455],
    ["Steelworker", "steelwork", 420], ["Specialist technician", "specialist", 520], ["Site supervisor", "supervision", 560],
];

interface Recipe {
    name: string;
    category: PhaseCategory;
    trade: number;
    hours: number;
    materials: readonly [number, number][];
}

const RECIPES: readonly Recipe[] = [
    {name: "Foundation", category: "preparation", trade: 0, hours: 80, materials: [[0, 10], [1, 500]]},
    {name: "Structure", category: "structural", trade: 6, hours: 50, materials: [[0, 5], [1, 250]]},
    {name: "Walls", category: "structural", trade: 3, hours: 65, materials: [[2, 800], [3, 160]]},
    {name: "Windows", category: "envelope", trade: 1, hours: 35, materials: [[11, 15], [12, 5]]},
    {name: "Electrical", category: "services", trade: 2, hours: 70, materials: [[4, 320], [5, 18]]},
    {name: "Plumbing", category: "services", trade: 4, hours: 50, materials: [[6, 100], [7, 20]]},
    {name: "HVAC", category: "services", trade: 5, hours: 55, materials: [[8, 80], [9, 0.1]]},
    {name: "Interior", category: "finishes", trade: 0, hours: 45, materials: [[10, 80], [15, 20]]},
    {name: "Commissioning", category: "completion", trade: 7, hours: 25, materials: [[5, 2]]},
    {name: "Roofing", category: "envelope", trade: 1, hours: 40, materials: [[13, 100], [14, 25]]},
    {name: "Finishing", category: "finishes", trade: 1, hours: 35, materials: [[16, 60], [17, 2]]},
    {name: "Excavation", category: "preparation", trade: 0, hours: 50, materials: [[1, 10]]},
    {name: "Facade", category: "envelope", trade: 3, hours: 50, materials: [[2, 500], [10, 100]]},
    {name: "Fire protection", category: "services", trade: 4, hours: 25, materials: [[6, 50], [7, 10]]},
    {name: "Testing", category: "completion", trade: 7, hours: 20, materials: [[4, 5]]},
];
const PROJECT_TYPES: ProjectType[] = ["highRise", "factory", "housingDevelopment", "warehouse", "office", "renovation", "infrastructure"];
const PLACES = ["North Harbour", "Factory East", "Riverside", "South Distribution", "Central Offices", "Old Town", "Coastal Link"];
const FIRST_NAMES = ["Anna", "Peter", "Sofia", "Emil", "Freja", "Noah", "Ida", "Oscar", "Alma", "Lars", "Maja", "William"];
const LAST_NAMES = ["Larsen", "Holm", "Jensen", "Nielsen", "Hansen", "Berg", "Madsen", "Lund", "Sørensen", "Olsen", "Khan", "Nowak"];

export function createPlan(options: ScenarioGenerationOptions): GenerationContext {
    const anchor = civilDate(options.anchorDate);
    if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error("Seed must be an unsigned 32-bit integer");
    if (!["small", "demo", "stress"].includes(options.profile)) throw new Error("Unknown generator profile");
    const projectCount = options.projectCount ?? ({small: 5, demo: 40, stress: 180}[options.profile]);
    const before = options.simulationMonthsBeforeAnchor ?? 18;
    const after = options.simulationMonthsAfterAnchor ?? 0;
    if (!Number.isInteger(projectCount) || projectCount < 1) throw new Error("projectCount must be a positive integer");
    if (!Number.isInteger(before) || before < 1 || before > 120) throw new Error("History window must be 1–120 whole months");
    if (!Number.isInteger(after) || after < 0 || after > 36) throw new Error("Future simulation window must be 0–36 whole months");
    const metadata = {
        schemaVersion: 1 as const, generatorVersion: 1 as const, seed: options.seed,
        anchorDate: anchor, profile: options.profile, projectCount,
        simulationStart: addMonths(anchor, -before), simulationEnd: addMonths(anchor, after),
        simulationMonthsBeforeAnchor: before, simulationMonthsAfterAnchor: after
    };
    const data: ScenarioData = {
        metadata,
        materialTypes: [],
        personnelTypes: [],
        people: [],
        personnelCostRates: [],
        suppliers: [],
        customers: [],
        phaseTypes: [],
        projects: [],
        workingCalendars: [],
        scopeNodes: [],
        projectPlans: [],
        phasePlans: [],
        phaseDependencies: [],
        labourBudgetLines: [],
        materialBudgetLines: [],
        otherBudgetLines: [],
        milestonePlans: [],
        personnelAssignments: [],
        personnelAbsences: [],
        siteReports: [],
        progressReports: [],
        labourEntries: [],
        materialUsageEntries: [],
        purchaseOrders: [],
        purchaseOrderLines: [],
        deliveries: [],
        deliveryLines: [],
        issues: [],
        issueCauses: [],
        otherCostEntries: [],
        delayEvents: [],
        delayImpactReports: [],
        milestoneReports: []
    };
    const ctx: GenerationContext = {
        data,
        rng: new Random(options.seed),
        ids: new IdSequence(),
        factors: new Map(),
        phases: new Map(),
        purchases: []
    };
    createReferenceData(ctx);
    for (let i = 0; i < projectCount; i++) createProject(ctx, i);
    initializePhasesAndAssignments(ctx);
    return ctx;
}

function createReferenceData({data, rng, ids}: GenerationContext): void {
    const holidays: CivilDate[] = [];
    for (let year = Number(data.metadata.simulationStart.slice(0, 4)); year <= Number(data.metadata.anchorDate.slice(0, 4)) + 4; year++) {
        for (const suffix of ["01-01", "12-25", "12-26"]) holidays.push(civilDate(`${year}-${suffix}`));
    }
    data.workingCalendars.push({
        id: ids.next("calendar"),
        name: "Demo weekday calendar",
        workingDays: [1, 2, 3, 4, 5],
        regularHoursPerDay: 7.4,
        holidays
    });
    for (const [name, category, unit, cost] of MATERIALS) data.materialTypes.push({
        id: ids.next("materialType"),
        code: `MAT-${data.materialTypes.length + 1}`,
        name,
        category,
        unit,
        standardUnitCost: cost,
        defaultLeadTimeDays: rng.int(5, 18),
        defaultWasteAllowancePct: category === "HVAC" ? 1 : rng.int(2, 5),
        criticality: category === "electrical" || category === "HVAC" ? "critical" : "normal",
    });
    for (const [name, category, rate] of TRADES) data.personnelTypes.push({
        id: ids.next("personnelType"),
        name,
        category,
        defaultNominalHoursPerWeek: 37,
        planningRegularHourlyCost: rate,
        planningOvertimeHourlyCost: round(rate * 1.5, 2),
        maxRecommendedHoursPerWeek: 48
    });
    const headcount = Math.max(27, Math.round(({
        small: 54,
        demo: 432,
        stress: 1620
    }[data.metadata.profile]) * data.metadata.projectCount / ({
        small: 5,
        demo: 40,
        stress: 180
    }[data.metadata.profile])));
    for (let i = 0; i < headcount; i++) {
        const trade = data.personnelTypes[i % TRADES.length]!;
        const subcontractor = rng.chance(0.15);
        const person = {
            id: ids.next("person"), name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)} ${i + 1}`,
            personnelTypeId: trade.id, employmentKind: subcontractor ? "subcontractor" as const : "employee" as const,
            employerName: subcontractor ? "Nordic Contract Crew" : undefined, nominalHoursPerWeek: 37, active: true
        };
        data.people.push(person);
        const regular = round(trade.planningRegularHourlyCost * (subcontractor ? 1.2 : rng.normal(0.96, 0.035)), 2);
        const change = addMonths(data.metadata.anchorDate, -3);
        data.personnelCostRates.push({
            id: ids.next("costRate"), personId: person.id, validFrom: addMonths(data.metadata.simulationStart, -12),
            validTo: addDays(change, -1), regularHourlyCost: regular, overtimeHourlyCost: round(regular * 1.5, 2)
        });
        data.personnelCostRates.push({
            id: ids.next("costRate"), personId: person.id, validFrom: change,
            regularHourlyCost: round(regular * 1.025, 2), overtimeHourlyCost: round(regular * 1.025 * 1.5, 2)
        });
    }
    const supervisors = data.people.filter(p => p.personnelTypeId === data.personnelTypes[8]!.id);
    for (const person of data.people) if (!supervisors.includes(person)) person.supervisorId = supervisors[data.people.indexOf(person) % supervisors.length]!.id;
    const categories = [...new Set(data.materialTypes.map(m => m.category))];
    for (let i = 0; i < 24; i++) data.suppliers.push({
        id: ids.next("supplier"),
        name: `${["Nordic", "Harbour", "Baltic", "Central"][i % 4]} ${categories[i % categories.length]} Supply ${i + 1}`,
        materialCategories: [categories[i % categories.length]!],
        typicalLeadTimeDays: rng.int(5, 15),
        reliabilityRating: i < 10 ? 0.98 : rng.normal(0.78, 0.06),
        qualityRating: i < 10 ? 0.99 : 0.82,
        region: "Denmark"
    });
    for (let i = 0; i < 18; i++) data.customers.push({
        id: ids.next("customer"), name: `${PLACES[i % PLACES.length]} Development ${i + 1}`,
        type: i % 3 === 0 ? "publicAuthority" : i % 3 === 1 ? "industrial" : "residentialDeveloper"
    });
    for (const recipe of RECIPES) data.phaseTypes.push({
        id: ids.next("phaseType"),
        name: recipe.name,
        category: recipe.category,
        typicalOutputUnit: "squareMetre"
    });
}

function createProject(ctx: GenerationContext, index: number): void {
    const {data, rng, ids} = ctx;
    const calendar = data.workingCalendars[0]!;
    const historicCount = data.metadata.projectCount >= 3 ? Math.max(1, Math.floor(data.metadata.projectCount * 0.2)) : data.metadata.projectCount - 1;
    const futureCount = data.metadata.projectCount >= 3 ? Math.max(1, Math.floor(data.metadata.projectCount * 0.2)) : 0;
    const cohort = index < historicCount ? "historic" : index >= data.metadata.projectCount - futureCount ? "future" : "active";
    const story = cohort === "historic" && index === 0 ? "healthy" : index % 4 === 1 ? "supply" : index % 4 === 2 ? "quality" : index % 4 === 3 ? "healthy" : "ordinary";
    const factors: ProjectFactors = {
        cohort, story, productivity: story === "healthy" ? 1.14 : story === "quality" ? 0.77 : 0.95,
        qualityRisk: story === "healthy" ? 0.003 : story === "quality" ? 0.055 : 0.014,
        supplierRisk: story === "supply" ? 0.7 : story === "healthy" ? 0.01 : 0.12,
        absenceRisk: story === "healthy" ? 0.001 : 0.007
    };
    const supervisors = data.people.filter(p => p.personnelTypeId === data.personnelTypes[8]!.id);
    const project: Project = {
        id: ids.next("project"),
        code: `BC-${String(index + 1).padStart(3, "0")}`,
        name: `${PLACES[index % PLACES.length]} ${Math.floor(index / PLACES.length) + 1}`,
        projectType: PROJECT_TYPES[index % PROJECT_TYPES.length]!,
        customerId: data.customers[index % data.customers.length]!.id,
        contractType: rng.pick(["fixedPrice", "costPlus", "targetCost"]),
        status: "planned",
        priority: story === "supply" ? "high" : "normal",
        complexity: story === "quality" ? "high" : "medium",
        baselineRisk: story === "healthy" ? "low" : "medium",
        location: rng.pick(["Copenhagen", "Aarhus", "Odense", "Aalborg"]),
        region: "Denmark",
        currency: "DKK",
        projectManagerId: supervisors[index % supervisors.length]!.id,
        siteManagerId: supervisors[(index + 1) % supervisors.length]!.id,
        plannedStart: data.metadata.anchorDate,
        plannedCompletion: data.metadata.anchorDate,
        workingCalendarId: calendar.id,
        rules: {
            nightWorkAllowed: false,
            weekendWorkAllowed: story !== "healthy",
            occupiedSite: cohort === "active" && index % 3 === 0,
            restrictedAccess: story === "quality",
            securityClearanceRequired: false,
            noiseRestrictions: index % 2 === 0,
            environmentalRestrictions: index % 3 === 0
        }
    };
    data.projects.push(project);
    ctx.factors.set(project.id, factors);
    const plan = {
        id: ids.next("projectPlan"),
        projectId: project.id,
        version: 1,
        status: "approved" as const,
        createdAt: at(data.metadata.simulationStart)
    };
    data.projectPlans.push(plan);
    const root: ScopeNode = {
        id: ids.next("scope"),
        projectId: project.id,
        type: "site",
        name: project.name,
        sequence: 0
    };
    data.scopeNodes.push(root);
    const phases: PhasePlan[] = [];
    const dependencies: ScenarioData["phaseDependencies"] = [];
    const durations = new Map<PhasePlanId, number>();
    const createPhase = (scope: ScopeNode, recipeIndex: number, scale: number): PhasePlan => {
        const recipe = RECIPES[recipeIndex]!;
        const trade = data.personnelTypes[recipe.trade]!;
        const hours = round(recipe.hours * scale * rng.normal(1, 0.04), 2);
        const headcount = hours > 90 ? 2 : 1;
        const phase: PhasePlan = {
            id: ids.next("phase"),
            projectPlanId: plan.id,
            projectId: project.id,
            scopeNodeId: scope.id,
            phaseTypeId: data.phaseTypes[recipeIndex]!.id,
            name: recipe.name,
            plannedStart: project.plannedStart,
            plannedFinish: project.plannedStart,
            progressProfile: "linear",
            progressWeight: hours,
            plannedOutputQuantity: scope.areaM2 ?? scope.lengthM ?? 100,
            outputUnit: scope.lengthM ? "metre" : "squareMetre",
            priority: project.priority
        };
        phases.push(phase);
        durations.set(phase.id, Math.max(2, Math.ceil(hours / (headcount * calendar.regularHoursPerDay))));
        data.labourBudgetLines.push({
            id: ids.next("labourBudget"),
            phasePlanId: phase.id,
            personnelTypeId: trade.id,
            estimatedHours: hours,
            plannedHeadcount: headcount,
            budgetRegularHourlyCost: trade.planningRegularHourlyCost,
            budgetOvertimeHourlyCost: trade.planningOvertimeHourlyCost
        });
        for (const [materialIndex, quantity] of recipe.materials) {
            const material = data.materialTypes[materialIndex]!;
            const requiredQuantity = round(quantity * scale);
            data.materialBudgetLines.push({
                id: ids.next("materialBudget"),
                phasePlanId: phase.id,
                materialTypeId: material.id,
                requiredQuantity,
                plannedWastePct: material.defaultWasteAllowancePct,
                budgetedQuantity: round(requiredQuantity * (1 + material.defaultWasteAllowancePct / 100)),
                budgetUnitCost: material.standardUnitCost,
                requiredByDate: project.plannedStart
            });
        }
        return phase;
    };
    const link = (pred: PhasePlan, successor: PhasePlan, type: "finishToStart" | "startToStart" | "finishToFinish" = "finishToStart", lag = 0): void => {
        dependencies.push({
            id: ids.next("dependency"),
            predecessorPhaseId: pred.id,
            successorPhaseId: successor.id,
            type,
            lagWorkingDays: lag
        });
    };
    const leafCount = data.metadata.profile === "small" ? rng.int(7, 11) : data.metadata.profile === "demo" ? rng.int(30, 46) : rng.int(40, 64);
    for (let building = 0; building < 2; building++) {
        const container: ScopeNode = {
            id: ids.next("scope"),
            projectId: project.id,
            parentId: root.id,
            type: "building",
            name: `${project.projectType === "highRise" ? "Tower" : project.projectType === "factory" ? "Production hall" : "Section"} ${building === 0 ? "A" : "B"}`,
            sequence: building
        };
        data.scopeNodes.push(container);
        const foundation = createPhase(container, project.projectType === "renovation" ? 11 : 0, 1.2);
        let previousStructure: PhasePlan | undefined;
        for (let n = building; n < leafCount; n += 2) {
            const type = project.projectType === "highRise" || project.projectType === "office" ? "floor" : project.projectType === "housingDevelopment" ? "unit" : project.projectType === "renovation" ? "room" : project.projectType === "infrastructure" ? "segment" : "zone";
            const scope: ScopeNode = {
                id: ids.next("scope"),
                projectId: project.id,
                parentId: container.id,
                type,
                name: `${type[0]!.toUpperCase()}${type.slice(1)} ${String(Math.floor(n / 2) + 1).padStart(2, "0")}`,
                sequence: n,
                areaM2: type === "segment" ? undefined : rng.int(200, 450),
                lengthM: type === "segment" ? rng.int(100, 300) : undefined,
                floorNumber: type === "floor" ? Math.floor(n / 2) + 1 : undefined
            };
            data.scopeNodes.push(scope);
            const scale = (scope.areaM2 ?? scope.lengthM!) / 300;
            if (project.projectType === "infrastructure") {
                const excavation = createPhase(scope, 11, scale);
                link(foundation, excavation);
                const structure = createPhase(scope, 1, scale);
                link(excavation, structure);
                const utilities = createPhase(scope, 5, scale);
                link(structure, utilities);
                const testing = createPhase(scope, 14, scale);
                link(utilities, testing);
                continue;
            }
            const structure = createPhase(scope, 1, scale);
            link(foundation, structure);
            if (previousStructure && type === "floor") link(previousStructure, structure);
            previousStructure = structure;
            const walls = createPhase(scope, 2, scale);
            link(structure, walls);
            const windows = createPhase(scope, 3, scale);
            link(walls, windows);
            const electrical = createPhase(scope, 4, scale);
            link(walls, electrical);
            const plumbing = createPhase(scope, 5, scale);
            link(walls, plumbing, "startToStart", 1);
            const hvac = createPhase(scope, 6, scale);
            link(walls, hvac);
            link(electrical, hvac, "finishToFinish");
            const interior = createPhase(scope, 7, scale);
            for (const pred of [windows, electrical, plumbing, hvac]) link(pred, interior);
            const finishing = createPhase(scope, 10, scale);
            link(interior, finishing);
            const commissioning = createPhase(scope, 8, scale);
            link(finishing, commissioning);
        }
        if (project.projectType !== "infrastructure") {
            const roof: ScopeNode = {
                id: ids.next("scope"),
                projectId: project.id,
                parentId: container.id,
                type: "roof",
                name: "Roof",
                sequence: leafCount,
                areaM2: 500
            };
            data.scopeNodes.push(roof);
            const roofing = createPhase(roof, 9, 1.5);
            link(previousStructure ?? foundation, roofing);
        }
    }
    scheduleBaseline(phases, dependencies, durations, workingOnOrAfter(data.metadata.anchorDate, calendar), calendar);
    const span = daysBetween(data.metadata.anchorDate, maxDate(...phases.map(p => p.plannedFinish)));
    const desiredStart = cohort === "historic" ? addDays(data.metadata.anchorDate, -Math.ceil(span * 2.2) - 90 - rng.int(0, 25))
        : cohort === "future" ? addDays(data.metadata.anchorDate, rng.int(30, 110))
            : addDays(data.metadata.anchorDate, -Math.ceil(span * rng.normal(0.48, 0.08)));
    project.plannedStart = workingOnOrAfter(maxDate(addDays(data.metadata.simulationStart, 30), desiredStart), calendar);
    scheduleBaseline(phases, dependencies, durations, project.plannedStart, calendar);
    project.plannedCompletion = maxDate(...phases.map(p => p.plannedFinish));
    plan.createdAt = at(addDays(project.plannedStart, -25));
    Object.assign(plan, {approvedAt: at(addDays(project.plannedStart, -20))});
    data.phasePlans.push(...phases);
    data.phaseDependencies.push(...dependencies);
    const phasesById = byId(phases);
    for (const budget of data.materialBudgetLines) {
        const phase = phasesById.get(budget.phasePlanId);
        if (phase) budget.requiredByDate = phase.plannedStart;
    }
    for (const [name, category, subset] of [
        ["Structure complete", "structure", phases.filter(p => p.name === "Structure")],
        ["Building weather-tight", "weatherTight", phases.filter(p => p.name === "Windows" || p.name === "Roofing")],
        ["Handover", "handover", phases],
    ] as const) if (subset.length) data.milestonePlans.push({
        id: ids.next("milestone"),
        projectPlanId: plan.id,
        projectId: project.id,
        name,
        category,
        plannedDate: maxDate(...subset.map(p => p.plannedFinish)),
        critical: category === "handover",
        phasePlanIds: subset.map(p => p.id)
    });
    data.otherBudgetLines.push({
        id: ids.next("otherBudget"),
        projectId: project.id,
        category: "temporaryFacilities",
        description: "Site setup and facilities",
        budgetedAmount: 12000
    });
}

function initializePhasesAndAssignments(ctx: GenerationContext): void {
    const {data, ids, rng} = ctx;
    const labour = groupBy(data.labourBudgetLines, b => b.phasePlanId);
    const materials = groupBy(data.materialBudgetLines, b => b.phasePlanId);
    const dependencies = groupBy(data.phaseDependencies, d => d.successorPhaseId);
    const people = groupBy(data.people, p => p.personnelTypeId);
    const projects = byId(data.projects);
    const loads = new Map<string, number>();
    // Stable plan order and interval loads distribute people without pretending baseline demand was resource-levelled.
    for (const phase of [...data.phasePlans].sort((a, b) => a.plannedStart < b.plannedStart ? -1 : a.plannedStart > b.plannedStart ? 1 : a.id < b.id ? -1 : 1)) {
        const project = projects.get(phase.projectId)!;
        const calendar = data.workingCalendars[0]!;
        const state = {
            plan: phase,
            project,
            calendar,
            factors: ctx.factors.get(project.id)!,
            labour: labour.get(phase.id)!,
            materials: materials.get(phase.id)!,
            assignments: [] as ScenarioData["personnelAssignments"],
            dependencies: dependencies.get(phase.id) ?? [],
            progress: 0,
            productiveHours: 0,
            rework: [],
            forecastStart: phase.plannedStart,
            forecastFinish: phase.plannedFinish,
            lastReportedProgress: 0,
            injectedIssue: false,
            injectedAbsence: false,
            injectedWeather: false,
            openDelays: new Map()
        };
        ctx.phases.set(phase.id, state);
        for (const budget of state.labour) {
            const candidates = rng.shuffle(people.get(budget.personnelTypeId)!).sort((a, b) => (loads.get(a.id) ?? 0) - (loads.get(b.id) ?? 0));
            for (const person of candidates.slice(0, budget.plannedHeadcount)) {
                const assignment = {
                    id: ids.next("assignment"),
                    personId: person.id,
                    projectId: project.id,
                    phasePlanId: phase.id,
                    startDate: phase.plannedStart,
                    createdAt: at(data.metadata.simulationStart, 0),
                    plannedHoursPerWeek: Math.min(person.nominalHoursPerWeek,
                        sum(state.labour, b => b.estimatedHours) / workingDaysInclusive(phase.plannedStart, phase.plannedFinish, calendar) * 5),
                    role: "Production crew"
                };
                state.assignments.push(assignment);
                data.personnelAssignments.push(assignment);
                loads.set(person.id, (loads.get(person.id) ?? 0) + budget.estimatedHours / budget.plannedHeadcount);
            }
        }
    }
}
