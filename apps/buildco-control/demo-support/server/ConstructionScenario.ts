import type {DemoScenario, ScenarioRequest, ScenarioResponse} from "../../src/api/ScenarioFetch.js";
import {DEFAULT_SCENARIO, generateScenario} from "../scenario/generate.ts";
import {analyzeScenario, classifyHealth, plannedProgress} from "../../src/domain/projections.ts";
import {scenarioAtDate} from "../../src/domain/snapshot.ts";
import {addDays, at, civilDate, dateOf, daysBetween, isoWeek, maxDate} from "../../src/domain/calendar.ts";
import {byId, compare, groupBy, round, sum} from "../../src/domain/collections.ts";
import type {
  CivilDate,
  DelayEvent,
  Id,
  Issue,
  PhasePlanId,
  ScenarioData,
  ScenarioGenerationOptions
} from "../../src/domain/model.ts";
import type {
  Bootstrap,
  Choice,
  Detail,
  Mutation,
  Parameters,
  Row,
  Screen,
  SemanticMode,
  ViewResult
} from "../../src/api/ScenarioApi.ts";
import {human, matchesConditions} from "../../src/api/ScenarioApi.ts";

const headers = {"content-type": "application/json; charset=utf-8"};
const result = (body: unknown, status = 200): ScenarioResponse => ({status, headers, body});

/** Application policy shared by the embedded worker and the generic HTTP adapter. */
export class ConstructionScenario implements DemoScenario {
    readonly id = "buildco-control";
    private corpus: ScenarioData;
    private data!: ScenarioData;
    private analysis!: ReturnType<typeof analyzeScenario>;
    private phaseRows: Row[] = [];
    private issueRows: Row[] = [];
    private delayRows: Row[] = [];
    private projectRows: Row[] = [];
    private peopleRows: Row[] = [];
    private materialRows: Row[] = [];
    private labourRows: Row[] = [];
    private userSequence = 0;
    private scopeParents = new Map<string, string | undefined>();
    private options: ScenarioGenerationOptions;

    constructor(options: ScenarioGenerationOptions = DEFAULT_SCENARIO, corpus: ScenarioData) {
        this.options = {...options};
        this.corpus = corpus;
        this.rebuild();
    }

    static async create(options: ScenarioGenerationOptions = DEFAULT_SCENARIO, onProgress?: (progress: number) => void): Promise<ConstructionScenario> {
        const corpus = await generateScenario(options, onProgress);
        return new ConstructionScenario(options, corpus);
    }

    delayFor(): number {
        return 100;
    }

    async reset(): Promise<void> {
        this.corpus = await generateScenario(this.options);
        this.userSequence = 0;
        this.rebuild();
    }

    async handle(request: ScenarioRequest, onProgress?: (progress: number) => void): Promise<ScenarioResponse> {
        try {
            const url = new URL(request.url, "http://buildco.local");
            if (url.pathname === "/api/bootstrap" && request.method === "GET") return result(this.bootstrap());
            if (url.pathname === "/api/choices" && request.method === "GET") return result(this.projectChoices(url.searchParams.get("project") ?? ""));
            if (url.pathname.startsWith("/api/view/") && request.method === "GET") {
                const params: unknown = JSON.parse(url.searchParams.get("params") ?? "{}");
                if (!params || typeof params !== "object" || Object.values(params).some(v => typeof v !== "string")) throw new Error("Invalid view parameters");
                return result(this.view(url.pathname.slice(10) as Screen, params as Parameters));
            }
            if (url.pathname === "/api/scenario/reset" && request.method === "POST") {
                const body = request.body as {
                    seed?: number;
                    profile?: ScenarioGenerationOptions["profile"]
                } | undefined;
                const options = {
                    ...this.options,
                    seed: body?.seed ?? this.options.seed,
                    profile: body?.profile ?? this.options.profile
                };
                const next = await generateScenario(options, onProgress);
                this.options = options;
                this.corpus = next;
                this.userSequence = 0;
                this.rebuild();
                return result(this.bootstrap());
            }
            if (url.pathname === "/api/mutate" && request.method === "POST") return result(this.mutate(request.body as Mutation));
            return result({error: {message: "Endpoint not found"}}, 404);
        } catch (error) {
            return result({error: {message: error instanceof Error ? error.message : String(error)}}, 400);
        }
    }

    private rebuild(): void {
        this.data = scenarioAtDate(this.corpus, this.corpus.metadata.anchorDate);
        this.analysis = analyzeScenario(this.corpus);
        const d = this.data, a = this.analysis;
        this.scopeParents = new Map(d.scopeNodes.map(s => [s.id, s.parentId]));
        const projects = byId(d.projects), scopes = byId(d.scopeNodes), phases = byId(d.phasePlans),
            people = byId(d.people);
        const types = byId(d.personnelTypes), materialTypes = byId(d.materialTypes), suppliers = byId(d.suppliers);
        const health = new Map(a.phases.map(p => [p.phasePlanId, p]));
        this.phaseRows = d.phasePlans.map(p => {
            const h = health.get(p.id)!, traits = classifyHealth(h), project = projects.get(p.projectId)!;
            return {
                id: p.id,
                name: `${scopes.get(p.scopeNodeId)!.name} · ${p.name}`,
                phase: p.name,
                phaseId: p.id,
                projectId: p.projectId,
                project: project.name,
                projectType: project.projectType,
                lifecycle: project.status,
                scopeId: p.scopeNodeId,
                scope: scopes.get(p.scopeNodeId)!.name,
                status: h.reportedProgress === 100 ? "complete" : h.prerequisiteBlocked ? "blocked" : traits.highRisk ? "atRisk" : h.reportedProgress > 0 ? "inProgress" : "ready",
                progress: h.reportedProgress,
                plannedProgress: h.plannedProgressAtDate,
                start: p.plannedStart,
                finish: p.plannedFinish,
                forecastStart: h.forecastStart,
                forecast: h.forecastFinish,
                variance: h.scheduleVarianceDays,
                cost: h.actualDirectCost,
                budget: h.totalBudgetCost,
                costVariance: h.costVariance,
                hours: h.actualLabourHours,
                budgetHours: h.budgetLabourHours,
                overtime: h.overtimeHours,
                headcount: h.assignedHeadcount,
                plannedHeadcount: h.plannedHeadcount,
                availableHours: h.availableHoursPerWeek,
                shortage: h.materialShortageCount,
                late: h.lateMaterialCount,
                openIssues: h.openIssueCount,
                issueCost: h.issueAttributedCost,
                delays: h.activeDelayCount,
                stale: h.staleReportingDays,
                priority: p.priority,
                type: d.phaseTypes.find(t => t.id === p.phaseTypeId)!.name,
                traits
            };
        });
        this.projectRows = a.projects.map(p => {
            const project = projects.get(p.projectId)!;
            const rows = this.phaseRows.filter(r => r.projectId === p.projectId);
            const variance = Math.max(0, ...rows.map(r => Number(r.variance)));
            return {
                id: project.id,
                name: project.name,
                projectId: project.id,
                code: project.code,
                status: project.status,
                progress: p.progress,
                type: project.projectType,
                location: project.location,
                start: project.plannedStart,
                finish: project.plannedCompletion,
                forecast: maxDate(...rows.map(r => r.forecast as CivilDate)),
                variance,
                cost: p.actualCost,
                budget: p.budgetCost,
                costVariance: p.costVariance,
                risk: project.status === "active" && rows.some(r => r.traits?.highRisk),
                openIssues: sum(rows, r => Number(r.openIssues)),
                customer: d.customers.find(c => c.id === project.customerId)!.name,
                manager: people.get(project.projectManagerId)!.name
            };
        });
        const causes = groupBy(d.issueCauses, c => c.issueId);
        this.issueRows = d.issues.map(i => {
            const linked = causes.get(i.id) ?? [],
                primary = linked.find(c => c.primary && c.status === "confirmed") ?? linked[0];
            return {
                ...i,
                id: i.id,
                name: i.title,
                project: projects.get(i.projectId)!.name,
                scopeId: i.scopeNodeId,
                scope: scopes.get(i.scopeNodeId)!.name,
                phaseId: i.phasePlanId,
                phase: i.phasePlanId ? phases.get(i.phasePlanId)!.name : "—",
                cause: primary?.category ?? "unknown",
                type: i.issueType,
                cost: a.issueCosts.get(i.id) ?? 0,
                estimate: i.estimatedCostImpact,
                date: dateOf(i.reportedAt),
                due: i.dueAt ? dateOf(i.dueAt) : "",
                person: i.assignedToId ? people.get(i.assignedToId)!.name : "Unassigned",
                supplier: primary?.supplierId ? suppliers.get(primary.supplierId)!.name : "—",
                supplierIds: linked.flatMap(c => c.supplierId ? [c.supplierId] : []),
                materialIds: linked.flatMap(c => c.materialTypeId ? [c.materialTypeId] : [])
            };
        });
        const delayLabour = groupBy(a.labour, l => l.entry.delayEventId ?? ""),
            delayCosts = groupBy(d.otherCostEntries, c => c.delayEventId ?? "");
        this.delayRows = d.delayEvents.map(e => ({
            ...e,
            id: e.id,
            name: e.description,
            project: projects.get(e.projectId)!.name,
            scopeId: e.scopeNodeId,
            scope: e.scopeNodeId ? scopes.get(e.scopeNodeId)!.name : "Project",
            phaseId: e.affectedPhasePlanIds[0],
            phase: e.affectedPhasePlanIds.map(id => phases.get(id)!.name).join(", "),
            cause: e.causeType,
            date: dateOf(e.startedAt),
            duration: daysBetween(dateOf(e.startedAt), e.endedAt ? dateOf(e.endedAt) : d.metadata.anchorDate) + 1,
            impact: e.estimatedScheduleImpactDays,
            hours: e.estimatedLostHours,
            cost: sum(delayLabour.get(e.id) ?? [], l => l.totalCost) + sum(delayCosts.get(e.id) ?? [], c => c.amount)
        }));
        this.labourRows = a.labour.map(l => ({
            id: l.entry.id,
            name: people.get(l.entry.personId)!.name,
            personId: l.entry.personId,
            projectId: l.entry.projectId,
            project: projects.get(l.entry.projectId)!.name,
            phaseId: l.entry.phasePlanId,
            scopeId: phases.get(l.entry.phasePlanId)!.scopeNodeId,
            phase: phases.get(l.entry.phasePlanId)!.name,
            type: types.get(people.get(l.entry.personId)!.personnelTypeId)!.name,
            reason: l.entry.activityReason,
            date: l.entry.workDate,
            hours: l.entry.hours,
            overtime: l.overtimeHours,
            cost: l.totalCost,
            issueId: l.entry.issueId,
            delayId: l.entry.delayEventId
        }));
        const labourByPerson = groupBy(this.labourRows, l => String(l.personId));
        const assignmentsByPerson = groupBy(d.personnelAssignments.filter(x => x.startDate <= d.metadata.anchorDate && (!x.endDate || x.endDate >= d.metadata.anchorDate)), x => x.personId);
        this.peopleRows = d.people.map(p => {
            const entries = labourByPerson.get(p.id) ?? [],
                week = entries.filter(l => isoWeek(l.date as CivilDate) === isoWeek(d.metadata.anchorDate));
            const assignments = assignmentsByPerson.get(p.id) ?? [];
            const absent = d.personnelAbsences.some(x => x.personId === p.id && x.fromDate <= d.metadata.anchorDate && x.toDate >= d.metadata.anchorDate);
            return {
                id: p.id,
                name: p.name,
                type: types.get(p.personnelTypeId)!.name,
                typeId: p.personnelTypeId,
                kind: p.employmentKind,
                status: absent ? "absent" : assignments.length ? "assigned" : "available",
                hours: sum(week, l => Number(l.hours)),
                overtime: sum(week, l => Number(l.overtime)),
                nominal: p.nominalHoursPerWeek,
                projectIds: [...new Set(assignments.map(x => x.projectId))],
                project: [...new Set(assignments.map(x => projects.get(x.projectId)!.name))].slice(0, 3).join(", ") || "Available for assignment"
            };
        });
        const purchaseOrders = byId(d.purchaseOrders), purchaseLines = byId(d.purchaseOrderLines);
        const materialMap = new Map<string, Row>();
        for (const budget of d.materialBudgetLines) {
            const phase = phases.get(budget.phasePlanId)!, key = `${phase.projectId}/${budget.materialTypeId}`,
                m = materialTypes.get(budget.materialTypeId)!;
            const row = materialMap.get(key) ?? {
                id: key,
                name: m.name,
                materialId: m.id,
                category: m.category,
                unit: m.unit,
                projectId: phase.projectId,
                project: projects.get(phase.projectId)!.name,
                planned: 0,
                ordered: 0,
                delivered: 0,
                used: 0,
                waste: 0,
                budget: 0,
                cost: 0,
                due: budget.requiredByDate,
                late: 0
            };
            row.planned = Number(row.planned) + budget.budgetedQuantity;
            row.budget = Number(row.budget) + budget.budgetedQuantity * budget.budgetUnitCost;
            if (budget.requiredByDate >= d.metadata.anchorDate && String(row.due) < d.metadata.anchorDate) row.due = budget.requiredByDate;
            materialMap.set(key, row);
        }
        const received = groupBy(d.deliveryLines, l => l.purchaseOrderLineId);
        for (const line of d.purchaseOrderLines) {
            const row = materialMap.get(`${purchaseOrders.get(line.purchaseOrderId)!.projectId}/${line.materialTypeId}`);
            if (row) {
                row.ordered = Number(row.ordered) + line.quantityOrdered;
                if (line.expectedDeliveryDate < d.metadata.anchorDate && sum(received.get(line.id) ?? [], l => l.quantityDelivered) < line.quantityOrdered - 0.001) row.late = Number(row.late) + 1;
            }
        }
        for (const delivery of d.deliveryLines) {
            const line = purchaseLines.get(delivery.purchaseOrderLineId)!;
            const row = materialMap.get(`${purchaseOrders.get(line.purchaseOrderId)!.projectId}/${line.materialTypeId}`);
            if (row) row.delivered = Number(row.delivered) + delivery.quantityAccepted;
        }
        for (const usage of d.materialUsageEntries) {
            const row = materialMap.get(`${usage.projectId}/${usage.materialTypeId}`);
            if (row) {
                row.used = Number(row.used) + usage.quantity;
                row.cost = Number(row.cost) + usage.quantity * usage.unitCostApplied;
                if (usage.usageReason === "waste") row.waste = Number(row.waste) + usage.quantity;
            }
        }
        this.materialRows = [...materialMap.values()].map(r => ({
            ...r, available: Math.max(0, Number(r.delivered) - Number(r.used)),
            status: Number(r.late) > 0 ? "late" : Number(r.delivered) - Number(r.used) < Number(r.planned) * 0.02 && Number(r.used) < Number(r.planned) * 0.95 ? "low" : "available"
        }));
    }

    private bootstrap(): Bootstrap {
        const choice = <T extends { id: string; name: string }>(rows: T[]): Choice[] => rows.map(r => ({
            value: r.id,
            label: r.name
        }));
        return {
            metadata: this.data.metadata, projects: this.projectRows,
            choices: {
                projects: choice(this.data.projects),
                phaseTypes: this.data.phaseTypes.map(p => ({value: p.name, label: p.name})),
                projectTypes: [...new Set(this.data.projects.map(p => p.projectType))].map(p => ({
                    value: p,
                    label: human(p)
                })),
                trades: choice(this.data.personnelTypes),
                people: choice(this.data.people),
                materials: choice(this.data.materialTypes),
                suppliers: choice(this.data.suppliers)
            }
        };
    }

    private projectChoices(project: string): Record<string, Choice[]> {
        const scopes = this.data.scopeNodes.filter(s => s.projectId === project), names = byId(scopes);
        return {
            scopes: scopes.map(s => ({value: s.id, label: s.name})),
            phases: this.data.phasePlans.filter(p => p.projectId === project).map(p => ({
                value: p.id,
                label: `${names.get(p.scopeNodeId)?.name} · ${p.name}`
            }))
        };
    }

    private page(rows: Row[], p: Parameters, extra: Partial<ViewResult> = {}, pageSize = 30): ViewResult {
        let filtered = rows;
        if (p.search) {
            const q = p.search.toLowerCase();
            filtered = filtered.filter(r => [r.name, r.project, r.scope, r.phase, r.id, r.cause, r.person].some(v => String(v ?? "").toLowerCase().includes(q)));
        }
        if (p.tableFilters) {
            const filters = JSON.parse(p.tableFilters) as Record<string, [unknown, SemanticMode][]>;
            filtered = filtered.filter(row => Object.entries(filters).every(([field, entries]) => matchesConditions(
                Object.fromEntries(entries.map(([v]) => [String(v), row[field] === v])), Object.fromEntries(entries.map(([v, mode]) => [String(v), mode])))));
        }
        if (p.sort) {
            const [field, direction] = p.sort.split(":");
            filtered = [...filtered].sort((a, b) => {
                const av = a[field!], bv = b[field!];
                const c = typeof av === "number" && typeof bv === "number" ? av - bv : compare(String(av ?? ""), String(bv ?? ""));
                return c * (direction === "desc" ? -1 : 1) || compare(a.id, b.id);
            });
        }
        const page = Math.min(Math.max(0, Number(p.page) || 0), Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
        return {
            rows: filtered.slice(page * pageSize, (page + 1) * pageSize),
            total: filtered.length,
            page,
            pageSize,
            metrics: [], ...extra
        };
    }

    private inScope(scope: string, candidate: string | undefined): boolean {
        if (!scope) return true;
        for (let id = candidate; id;) {
            if (id === scope) return true;
            id = this.scopeParents.get(id);
        }
        return false;
    }

    private phaseDetail(id: string): Detail | undefined {
        const row = this.phaseRows.find(p => p.id === id);
        if (!row) return undefined;
        const d = this.data;
        const links: Row[] = [], visited = new Set<string>();
        const prerequisites = (phase: string, depth: number): void => {
            for (const dep of d.phaseDependencies.filter(x => x.successorPhaseId === phase)) {
                if (visited.has(dep.id)) continue;
                visited.add(dep.id);
                links.push({
                    ...this.phaseRows.find(p => p.id === dep.predecessorPhaseId)!,
                    id: dep.id,
                    relationship: `${human(dep.type)} · ${depth === 1 ? "direct" : `upstream ${depth}`}`,
                    lag: dep.lagWorkingDays
                });
                prerequisites(dep.predecessorPhaseId, depth + 1);
            }
        };
        prerequisites(id, 1);
        return {
            id,
            title: row.name,
            subtitle: row.project,
            projectId: row.projectId,
            scopeId: row.scopeId,
            phaseId: id,
            record: row,
            fields: [{
                label: "Reported progress",
                value: Number(row.progress),
                format: "percent"
            }, {label: "Planned progress", value: Number(row.plannedProgress), format: "percent"},
                {label: "Baseline finish", value: String(row.finish)}, {
                    label: "Forecast finish",
                    value: String(row.forecast)
                },
                {
                    label: "Labour · actual / plan",
                    value: `${round(Number(row.hours), 1)} / ${round(Number(row.budgetHours), 1)} h`
                },
                {
                    label: "Overtime",
                    value: Number(row.overtime),
                    format: "hours"
                }, {label: "Staffing · assigned / planned", value: `${row.headcount} / ${row.plannedHeadcount}`},
                {label: "Available crew capacity", value: Number(row.availableHours), format: "hours"},
                {label: "Actual direct cost", value: Number(row.cost), format: "money"}, {
                    label: "Variance at progress",
                    value: Number(row.costVariance),
                    format: "money"
                }],
            sections: [{title: "Prerequisites", rows: links},
                {
                    title: "Assigned crew",
                    rows: d.personnelAssignments.filter(x => x.phasePlanId === id && x.startDate <= d.metadata.anchorDate && (!x.endDate || x.endDate >= d.metadata.anchorDate)).map(x => ({
                        id: x.id, name: d.people.find(p => p.id === x.personId)!.name, hours: x.plannedHoursPerWeek,
                        status: d.personnelAbsences.some(a => a.personId === x.personId && a.fromDate <= d.metadata.anchorDate && a.toDate >= d.metadata.anchorDate) ? "absent" : "assigned"
                    }))
                },
                {
                    title: "Materials · planned and consumed",
                    rows: d.materialBudgetLines.filter(b => b.phasePlanId === id).map(b => ({
                        id: b.id,
                        name: d.materialTypes.find(m => m.id === b.materialTypeId)!.name,
                        planned: b.budgetedQuantity,
                        used: sum(d.materialUsageEntries.filter(u => u.phasePlanId === id && u.materialTypeId === b.materialTypeId), u => u.quantity),
                        unit: d.materialTypes.find(m => m.id === b.materialTypeId)!.unit
                    }))
                },
                {title: "Issues", rows: this.issueRows.filter(i => i.phaseId === id).slice(0, 12)},
                {title: "Delays", rows: this.delayRows.filter(i => i.phaseId === id).slice(0, 12)},
                {
                    title: "Affected milestones",
                    rows: this.milestones(String(row.projectId)).filter(m => (m.phaseIds as string[]).includes(id))
                }]
        };
    }

    private milestones(project: string): Row[] {
        return this.data.milestonePlans.filter(m => m.projectId === project).map(m => {
            const reports = this.data.milestoneReports.filter(r => r.milestonePlanId === m.id);
            const report = reports.at(-1);
            return {
                id: m.id,
                name: m.name,
                projectId: project,
                phaseIds: m.phasePlanIds,
                status: report?.status ?? "planned",
                date: m.plannedDate,
                forecast: report?.forecastDate ?? m.plannedDate,
                critical: m.critical
            };
        });
    }

    private view(screen: Screen, p: Parameters): ViewResult {
        p = Object.fromEntries(Object.entries(p).map(([key, value]) => [key, value === "__all" ? "" : value]));
        const d = this.data;
        if (screen === "overview") {
            const rows = this.projectRows.filter(r => p.scope === "active" ? r.status === "active" : p.scope === "risk" ? r.risk : true);
            const attention = [...this.phaseRows.filter(r => r.lifecycle === "active" && (r.traits?.highRisk || Number(r.openIssues) > 0))]
                .sort((a, b) => Number(b.openIssues) * 5 + Number(b.variance) - Number(a.openIssues) * 5 - Number(a.variance)).slice(0, 8);
            const milestones = this.projectRows.filter(r => r.status === "active").flatMap(project => this.milestones(project.id).map(m => ({
                ...m,
                project: project.name
            })))
                .filter(m => m.status === "atRisk" && String(m.date) <= addDays(d.metadata.anchorDate, 30)).sort((a, b) => compare(String(a.date), String(b.date))).slice(0, 4);
            return this.page(rows, p, {
                attention, milestones,
                metrics: [{label: "Active projects", value: this.projectRows.filter(r => r.status === "active").length},
                    {label: "Projects at risk", value: this.projectRows.filter(r => r.risk).length},
                    {label: "Completed projects", value: this.projectRows.filter(r => r.status === "completed").length},
                    {
                        label: "Resource cost variance",
                        value: sum(this.projectRows, r => Number(r.costVariance)) / Math.max(1, sum(this.projectRows, r => Number(r.cost) - Number(r.costVariance))) * 100,
                        format: "percent"
                    }]
            }, 8);
        }
        if (screen === "projects") {
            const projectId = p.project || this.projectRows.find(r => r.status === "active")!.id;
            const project = this.projectRows.find(r => r.id === projectId);
            if (!project) throw new Error("Project not found");
            const phases = this.phaseRows.filter(r => r.projectId === projectId && this.inScope(p.scope ?? "", r.scopeId));
            let rows = phases;
            if (p.tab === "reports") rows = d.progressReports.filter(r => phases.some(p => p.id === r.phasePlanId)).map(r => ({
                id: r.id,
                name: this.phaseRows.find(p => p.id === r.phasePlanId)!.name,
                phaseId: r.phasePlanId,
                date: dateOf(r.reportedAt),
                progress: r.percentComplete,
                status: r.executionStatus,
                forecast: r.forecastFinishDate
            }));
            const scope = d.scopeNodes.find(s => s.id === p.scope);
            const detail = p.phase ? this.phaseDetail(p.phase) : {
                id: projectId,
                title: scope?.name ?? project.name,
                subtitle: project.name,
                projectId,
                fields: [{label: "Customer", value: String(project.customer)}, {
                    label: "Project manager",
                    value: String(project.manager)
                },
                    {label: "Location", value: String(project.location)}, {
                        label: "Project type",
                        value: human(project.type)
                    },
                    {label: "Baseline start", value: String(project.start)}, {
                        label: "Baseline completion",
                        value: String(project.finish)
                    },
                    {label: "Forecast completion", value: String(project.forecast)}, {
                        label: "Status",
                        value: human(project.status)
                    }],
                sections: []
            };
            return this.page(rows, p, {
                tree: d.scopeNodes.filter(s => s.projectId === projectId),
                detail,
                milestones: this.milestones(projectId),
                metrics: [{
                    label: "Progress in scope",
                    value: sum(phases, r => Number(r.progress) * Number(r.budgetHours)) / Math.max(1, sum(phases, r => Number(r.budgetHours))),
                    format: "percent"
                },
                    {label: "Open issues", value: sum(phases, r => Number(r.openIssues))}, {
                        label: "Actual cost",
                        value: sum(phases, r => Number(r.cost)),
                        format: "money"
                    },
                    {label: "Cost variance", value: sum(phases, r => Number(r.costVariance)), format: "money"}]
            });
        }
        if (screen === "planning" || screen === "queue") {
            let rows = this.phaseRows.filter(r => !p.project || r.projectId === p.project);
            if (screen === "planning") {
                const focus = civilDate(p.focus || d.metadata.anchorDate),
                    end = addDays(focus, Math.min(180, Math.max(1, Number(p.horizon) || 30)));
                rows = rows.filter(r => r.progress !== 100 && String(r.start) <= end && String(r.forecast) >= focus);
                if (p.view === "delayed") rows = rows.filter(r => Number(r.variance) > 0);
                if (p.view === "blocked") rows = rows.filter(r => r.traits?.blocked);
                if (p.critical === "on") {
                    const criticalPhases = new Set(d.milestonePlans.filter(m => m.critical).flatMap(m => m.phasePlanIds));
                    rows = rows.filter(r => criticalPhases.has(r.id as PhasePlanId) || r.priority === "high" || r.priority === "critical" || Number(r.openIssues) > 0 || r.traits?.highRisk);
                }
            } else {
                if (p.type) rows = rows.filter(r => r.projectType === p.type);
                if (p.phaseType) rows = rows.filter(r => r.type === p.phaseType);
                const modes = JSON.parse(p.conditions || "{}") as Record<string, SemanticMode>;
                rows = rows.filter(r => matchesConditions(r.traits ?? {}, modes));
                const lifecycle = JSON.parse(p.lifecycle || "{}") as Record<string, SemanticMode>;
                rows = rows.filter(r => matchesConditions({
                    active: r.lifecycle === "active",
                    completed: r.lifecycle === "completed",
                    planned: r.lifecycle === "planned"
                }, lifecycle));
                const urgency = (r: Row): number => (r.lifecycle === "active" ? 10_000 : 0) + (r.traits?.highRisk ? 1000 : 0) + Number(r.openIssues) * 30 + Number(r.variance);
                rows = [...rows].sort((a, b) => urgency(b) - urgency(a) || compare(a.id, b.id));
            }
            return this.page(rows, p, {detail: this.phaseDetail(p.selected ?? "")});
        }
        if (screen === "resources") return this.resources(p);
        if (screen === "issues") return this.exceptions(p);
        if (screen === "analytics") return this.analytics(p);
        throw new Error("Unknown application screen");
    }

    private resources(p: Parameters): ViewResult {
        const d = this.data;
        if (p.tab === "labour") {
            let rows = this.labourRows.filter(r => (!p.project || r.projectId === p.project) && (!p.reason || r.reason === p.reason) && (!p.from || String(r.date) >= p.from) && (!p.to || String(r.date) <= p.to));
            if (p.overtime === "prefer") rows = rows.filter(r => Number(r.overtime) > 0);
            if (p.overtime === "deny") rows = rows.filter(r => Number(r.overtime) === 0);
            return this.page(rows, p, {
                metrics: [{
                    label: "Logged hours",
                    value: sum(rows, r => Number(r.hours)),
                    format: "hours"
                }, {
                    label: "Overtime",
                    value: sum(rows, r => Number(r.overtime)),
                    format: "hours"
                }, {label: "Labour cost", value: sum(rows, r => Number(r.cost)), format: "money"}]
            });
        }
        if (p.tab === "materials") {
            const rows = this.materialRows.filter(r => (!p.project || r.projectId === p.project) && (!p.material || r.materialId === p.material));
            const row = rows.find(r => r.id === p.selected);
            const orders = row ? d.purchaseOrderLines.filter(l => l.materialTypeId === row.materialId && d.purchaseOrders.find(o => o.id === l.purchaseOrderId)!.projectId === row.projectId) : [];
            const detail: Detail | undefined = row ? {
                id: row.id, title: row.name, subtitle: row.project,
                fields: [{label: "Unit", value: human(row.unit)}, {
                    label: "Accepted stock remaining",
                    value: Number(row.available)
                },
                    {label: "Actual consumed cost", value: Number(row.cost), format: "money"}], record: row, sections: [
                    {
                        title: "Orders and deliveries", rows: orders.map(l => {
                            const order = d.purchaseOrders.find(o => o.id === l.purchaseOrderId)!;
                            return {
                                id: l.id,
                                name: d.suppliers.find(s => s.id === order.supplierId)!.name,
                                date: dateOf(order.orderedAt),
                                due: l.expectedDeliveryDate,
                                ordered: l.quantityOrdered,
                                delivered: sum(d.deliveryLines.filter(x => x.purchaseOrderLineId === l.id), x => x.quantityAccepted),
                                status: order.status
                            };
                        })
                    }]
            } : undefined;
            return this.page(rows, p, {
                detail,
                metrics: [{label: "Material lines", value: rows.length}, {
                    label: "Late orders",
                    value: sum(rows, r => Number(r.late))
                }, {label: "Consumed material cost", value: sum(rows, r => Number(r.cost)), format: "money"}]
            });
        }
        let rows = this.peopleRows.filter(r => (!p.project || (r.projectIds as string[]).includes(p.project)) && (!p.trade || r.typeId === p.trade) && (!p.availability || r.status === p.availability));
        if (p.group) rows = [...rows].sort((a, b) => compare(String(a[p.group!] ?? ""), String(b[p.group!] ?? "")) || compare(a.name, b.name));
        const person = rows.find(r => r.id === p.selected);
        return this.page(rows, p, {
            detail: person ? {
                id: person.id, title: person.name, subtitle: `${person.type} · ${human(person.kind)}`, record: person,
                fields: [{
                    label: "Nominal weekly hours",
                    value: Number(person.nominal),
                    format: "hours"
                }, {label: "This week", value: Number(person.hours), format: "hours"},
                    {
                        label: "Derived overtime",
                        value: Number(person.overtime),
                        format: "hours"
                    }, {label: "Availability", value: human(person.status)}],
                sections: [{
                    title: "Current assignments",
                    rows: d.personnelAssignments.filter(a => a.personId === person.id && a.startDate <= d.metadata.anchorDate && (!a.endDate || a.endDate >= d.metadata.anchorDate)).map(a => ({
                        ...this.phaseRows.find(r => r.id === a.phasePlanId)!,
                        id: a.id,
                        hours: a.plannedHoursPerWeek,
                        role: a.role
                    }))
                },
                    {
                        title: "Recent labour",
                        rows: this.labourRows.filter(r => r.personId === person.id).slice(-10).reverse()
                    }]
            } : undefined,
            metrics: [{label: "People in view", value: rows.length}, {
                label: "Available",
                value: rows.filter(r => r.status === "available").length
            }, {label: "This week's hours", value: sum(rows, r => Number(r.hours)), format: "hours"}]
        });
    }

    private exceptions(p: Parameters): ViewResult {
        const delay = p.tab === "delays";
        let rows = (delay ? this.delayRows : this.issueRows).filter(r => (!p.project || r.projectId === p.project) && (!p.scope || r.scopeId === p.scope) &&
            (!p.phase || r.phaseId === p.phase) && (!p.status || r.status === p.status) && (!p.severity || r.severity === p.severity) &&
            (!p.cause || r.cause === p.cause) && (!p.type || r.type === p.type) && (!p.person || r.assignedToId === p.person) &&
            (!p.supplier || (r.supplierIds as string[] | undefined)?.includes(p.supplier)) && (!p.material || (r.materialIds as string[] | undefined)?.includes(p.material)) &&
            (!p.due || String(r.due || "9999") <= p.due) && (!p.minCost || Number(r.cost) >= Number(p.minCost)) && (!p.maxCost || Number(r.cost) <= Number(p.maxCost)));
        if (p.costView === "overEstimate") rows = rows.filter(r => Number(r.cost) > Number(r.estimate));
        const row = rows.find(r => r.id === p.selected);
        let detail: Detail | undefined;
        if (row) {
            const labour = this.labourRows.filter(l => delay ? l.delayId === row.id : l.issueId === row.id).slice(0, 15);
            const sections: Detail["sections"] = delay ? [{
                title: "Cause and origin", rows: [
                    ...(row.issueId ? this.issueRows.filter(i => i.id === row.issueId) : []),
                    ...(row.blockingPhasePlanId ? this.phaseRows.filter(i => i.id === row.blockingPhasePlanId) : []),
                    ...(row.absenceId ? this.data.personnelAbsences.filter(a => a.id === row.absenceId).map(a => ({
                        id: a.id,
                        name: `${this.data.people.find(p => p.id === a.personId)!.name} · ${human(a.type)}`,
                        date: a.fromDate,
                        end: a.toDate
                    })) : []),
                    ...(row.purchaseOrderLineId ? this.data.purchaseOrderLines.filter(l => l.id === row.purchaseOrderLineId).map(l => ({
                        id: l.id, name: this.data.materialTypes.find(m => m.id === l.materialTypeId)!.name,
                        ordered: l.quantityOrdered, due: l.expectedDeliveryDate
                    })) : []),
                ]
            }] : [{
                title: "Confirmed and suspected causes",
                rows: this.data.issueCauses.filter(c => c.issueId === row.id).map(c => ({
                    id: c.id,
                    name: human(c.category),
                    status: c.status,
                    supplier: c.supplierId ? this.data.suppliers.find(s => s.id === c.supplierId)!.name : "",
                    person: c.personId ? this.data.people.find(p => p.id === c.personId)!.name : ""
                }))
            },
                {
                    title: "Attributed materials",
                    rows: this.data.materialUsageEntries.filter(m => m.issueId === row.id).slice(0, 15).map(m => ({
                        id: m.id, name: this.data.materialTypes.find(t => t.id === m.materialTypeId)!.name,
                        quantity: m.quantity, cost: m.quantity * m.unitCostApplied, date: dateOf(m.usedAt)
                    }))
                }];
            sections.push({title: "Attributed labour", rows: labour});
            sections.push({
                title: "Attributed other costs",
                rows: this.data.otherCostEntries.filter(c => delay ? c.delayEventId === row.id : c.issueId === row.id).map(c => ({
                    id: c.id,
                    name: c.description,
                    cost: c.amount,
                    date: c.date
                }))
            });
            detail = {
                id: row.id,
                title: row.name,
                subtitle: `${row.project} · ${row.scope}`,
                projectId: row.projectId,
                scopeId: row.scopeId,
                phaseId: row.phaseId,
                record: row,
                fields: [{label: "Description", value: String(row.description || row.name)}, {
                    label: "Status",
                    value: human(row.status)
                }, {label: "Cause", value: human(row.cause)}, {label: "Reported", value: String(row.date)},
                    {
                        label: delay ? "Estimated lost hours" : "Estimated cost",
                        value: Number(delay ? row.hours : row.estimate),
                        format: delay ? "hours" : "money"
                    },
                    {
                        label: "Attributed actual cost",
                        value: Number(row.cost),
                        format: "money"
                    }, {
                        label: delay ? "Schedule impact" : "Due date",
                        value: delay ? `${row.impact} days` : String(row.due || "Not set")
                    }],
                sections
            };
        }
        return this.page(rows, p, {
            detail, options: p.project ? this.projectChoices(p.project) : {scopes: [], phases: []},
            metrics: [{
                label: delay ? "Delay events" : "Issues in view",
                value: rows.length
            }, {
                label: delay ? "Active delays" : "Open issues",
                value: rows.filter(r => delay ? r.status === "active" : !["resolved", "closed"].includes(String(r.status))).length
            },
                {label: "Attributed cost", value: sum(rows, r => Number(r.cost)), format: "money"}]
        });
    }

    private analytics(p: Parameters): ViewResult {
        const subject = p.subject || "phases", d = this.data;
        const source = subject === "labour" ? this.labourRows : subject === "materials" ? d.materialUsageEntries.map(m => ({
                id: m.id,
                name: d.materialTypes.find(t => t.id === m.materialTypeId)!.name,
                projectId: m.projectId,
                project: this.projectRows.find(p => p.id === m.projectId)!.name,
                category: m.usageReason,
                status: m.issueId ? "Issue attributed" : "Production",
                cost: m.quantity * m.unitCostApplied,
                phaseId: m.phasePlanId
            }))
            : subject === "issues" ? this.issueRows : subject === "delays" ? this.delayRows : this.phaseRows;
        const rows: Row[] = source.filter(r => !p.project || r.projectId === p.project);
        if (p.tab !== "trends") {
            const items = rows.map(r => ({
                id: r.id,
                name: r.name,
                projectId: r.projectId,
                project: r.project,
                scopeId: r.scopeId,
                phaseId: r.phaseId,
                category: human(r.cause ?? r.reason ?? r.category ?? r.type),
                classification: human(r.severity ?? r.status ?? "Recorded"),
                status: r.status,
                cost: r.cost ?? 0,
                progress: r.progress
            }));
            return this.page([], p, {
                chartItems: items,
                total: items.length,
                metrics: [{label: "Records analysed", value: items.length}, {
                    label: "Projects",
                    value: new Set(items.map(r => r.projectId)).size
                },
                    {label: "Recorded cost", value: sum(items, r => Number(r.cost)), format: "money"}]
            });
        }
        const group = p.metric || "progress", days = Math.max(14, Math.min(365, Number(p.days) || 90));
        const from = maxDate(d.metadata.simulationStart, addDays(d.metadata.anchorDate, -days));
        const phases = d.phasePlans.filter(x => !p.project || x.projectId === p.project);
        const ids = new Set(phases.map(x => x.id));
        const phasesById = byId(phases);
        const labour = this.analysis.labour.filter(l => ids.has(l.entry.phasePlanId));
        const materials = d.materialUsageEntries.filter(m => ids.has(m.phasePlanId));
        const issues = d.issues.filter(i => !p.project || i.projectId === p.project);
        const reports = groupBy(d.progressReports.filter(r => ids.has(r.phasePlanId)), r => r.phasePlanId);
        const budgetHours = sum(d.labourBudgetLines.filter(b => ids.has(b.phasePlanId)), b => b.estimatedHours);
        const budgetMaterial = sum(d.materialBudgetLines.filter(b => ids.has(b.phasePlanId)), b => b.budgetedQuantity * b.budgetUnitCost);
        const values: Record<string, Record<string, number>> = {first: {}, second: {}, third: {}, fourth: {}};
        for (let day = from; day <= d.metadata.anchorDate; day = addDays(day, Math.min(7, Math.max(1, daysBetween(day, d.metadata.anchorDate))))) {
            const end = day;
            const before = addDays(day, -7);
            const ls = labour.filter(l => l.entry.workDate <= end), ms = materials.filter(m => dateOf(m.usedAt) <= end);
            if (group === "progress" || group === "cost" || group === "schedule") {
                let planned = 0, reported = 0, late = 0, blocked = 0;
                for (const phase of phases) {
                    const history = reports.get(phase.id) ?? [];
                    const report = history.findLast(r => dateOf(r.reportedAt) <= end);
                    planned += plannedProgress(phase, end, d) * phase.progressWeight;
                    reported += (report?.percentComplete ?? 0) * phase.progressWeight;
                    if (report && report.percentComplete < 100 && report.forecastFinishDate && report.forecastFinishDate > phase.plannedFinish) late++;
                    if (report?.executionStatus === "blocked") blocked++;
                }
                const weight = Math.max(1, sum(phases, x => x.progressWeight));
                if (group === "progress") {
                    values.first![day] = planned / weight;
                    values.second![day] = reported / weight;
                    values.third![day] = sum(ls, l => l.entry.hours) / Math.max(1, budgetHours) * 100;
                    values.fourth![day] = sum(ms, m => m.quantity * m.unitCostApplied) / Math.max(1, budgetMaterial) * 100;
                } else if (group === "schedule") {
                    values.first![day] = late;
                    values.second![day] = blocked;
                } else {
                    values.first![day] = sum(this.phaseRows.filter(r => ids.has(r.id as PhasePlanId)), r => Number(r.budget) * plannedProgress(phasesById.get(r.id as PhasePlanId)!, end, d) / 100);
                    values.second![day] = sum(ls, l => l.totalCost) + sum(ms, m => m.quantity * m.unitCostApplied) + sum(d.otherCostEntries.filter(c => (!p.project || c.projectId === p.project) && c.date <= end), c => c.amount);
                    values.third![day] = sum(ls.filter(l => l.entry.issueId), l => l.totalCost) + sum(ms.filter(m => m.issueId), m => m.quantity * m.unitCostApplied);
                }
            } else if (group === "labour") {
                const week = ls.filter(l => l.entry.workDate > before);
                values.first![day] = sum(week, l => l.entry.hours);
                values.second![day] = sum(week, l => l.overtimeHours);
                values.third![day] = sum(week.filter(l => l.entry.activityReason === "defectResolution" || l.entry.activityReason === "rework"), l => l.entry.hours);
            } else if (group === "materials") {
                values.first![day] = sum(ms, m => m.quantity * m.unitCostApplied);
                values.second![day] = sum(ms.filter(m => m.usageReason === "waste"), m => m.quantity * m.unitCostApplied);
                values.third![day] = sum(ms.filter(m => m.issueId), m => m.quantity * m.unitCostApplied);
            } else {
                values.first![day] = issues.filter(i => dateOf(i.reportedAt) > before && dateOf(i.reportedAt) <= end).length;
                values.second![day] = issues.filter(i => i.resolvedAt && dateOf(i.resolvedAt) > before && dateOf(i.resolvedAt) <= end).length;
            }
            if (day === d.metadata.anchorDate) break;
        }
        const labels = group === "progress" ? ["Planned progress", "Reported progress", "Labour budget consumed", "Material budget consumed"]
            : group === "labour" ? ["Hours worked", "Overtime hours", "Rework hours"] : group === "materials" ? ["Consumed material cost", "Waste cost", "Issue-attributed material cost"]
                : group === "schedule" ? ["Delayed phases", "Blocked phases"] : group === "cost" ? ["Planned cost to date", "Actual direct cost", "Issue-attributed resources"] : ["Issues opened", "Issues resolved"];
        const colors = ["#427789", "#c5743c", "#8a689e", "#699470"];
        return this.page([], p, {
            chartLabel: `${human(group)} over time`,
            chartUnit: group === "progress" ? "%" : ["materials", "cost"].includes(group) ? "DKK" : group === "labour" ? "hours" : "count",
            series: labels.map((label, i) => ({
                key: String(i),
                label,
                color: colors[i]!,
                values: values[["first", "second", "third", "fourth"][i]!]!,
                carryForward: true
            })),
            notice: group === "quality" || group === "labour" ? "Each point covers the preceding seven days." : "Cumulative values from operational records; no chart-specific fixtures."
        });
    }

    private mutate(input: Mutation): { id: string; message: string } {
        if (!input || !["issue", "delay"].includes(input.kind) || !["create", "edit", "resolve"].includes(input.action)) throw new Error("Invalid command");
        const d = this.corpus, now = at(d.metadata.anchorDate, 20);
        const collection = input.kind === "issue" ? d.issues : d.delayEvents;
        const existing = collection.find(r => r.id === input.id);
        if (input.action !== "create" && !existing) throw new Error("Record not found");
        if (input.action === "resolve") {
            if (input.kind === "issue") {
                const issue = existing as Issue;
                issue.status = "resolved";
                issue.resolvedAt = now;
            } else {
                const delay = existing as DelayEvent;
                delay.status = "ended";
                delay.endedAt = now;
            }
            this.rebuild();
            return {id: existing!.id, message: input.kind === "issue" ? "Issue resolved" : "Delay ended"};
        }
        const title = String(input.title ?? "").trim();
        if (title.length < 3 || title.length > 180) throw new Error("Enter a title between 3 and 180 characters");
        const phase = d.phasePlans.find(p => p.id === (input.phaseId ?? (existing && "phasePlanId" in existing ? existing.phasePlanId : undefined)));
        if (!phase || input.projectId && input.projectId !== phase.projectId) throw new Error("Select a phase in the chosen project");
        if (existing && (existing.projectId !== phase.projectId || ("phasePlanId" in existing ? existing.phasePlanId !== phase.id : !(existing as DelayEvent).affectedPhasePlanIds.includes(phase.id)))) throw new Error("An existing record's location cannot be changed");
        const project = d.projects.find(p => p.id === phase.projectId)!;
        if (input.personId && !d.people.some(p => p.id === input.personId)) throw new Error("Assigned person not found");
        if (input.estimatedCost !== undefined && (!Number.isFinite(input.estimatedCost) || input.estimatedCost < 0)) throw new Error("Estimated cost must be a non-negative number");
        const due = input.dueDate ? at(civilDate(input.dueDate), 20) : undefined;
        const id = existing?.id ?? `${input.kind}-user-${++this.userSequence}`;
        if (input.kind === "issue") {
            if (!["low", "medium", "high", "critical"].includes(input.severity ?? "medium")) throw new Error("Invalid severity");
            const issue: Issue = {
                ...(existing as Issue | undefined),
                id: id as Id<"issue">,
                projectId: project.id,
                scopeNodeId: phase.scopeNodeId,
                phasePlanId: phase.id,
                issueType: (existing as Issue | undefined)?.issueType ?? "other",
                severity: (input.severity ?? "medium") as Issue["severity"],
                priority: input.severity === "critical" ? "critical" : "normal",
                status: (existing as Issue | undefined)?.status ?? "open",
                title,
                description: input.description ?? "",
                reportedAt: (existing as Issue | undefined)?.reportedAt ?? now,
                reportedById: project.siteManagerId,
                assignedToId: input.personId as Id<"person"> | undefined,
                dueAt: due,
                estimatedCostImpact: input.estimatedCost ?? 0,
                estimatedDelayHours: (existing as Issue | undefined)?.estimatedDelayHours ?? 0
            };
            if (existing) Object.assign(existing, issue); else {
                d.issues.push(issue);
                d.issueCauses.push({
                    id: `issueCause-user-${this.userSequence}` as Id<"issueCause">,
                    issueId: issue.id,
                    category: "unknown",
                    status: "suspected",
                    primary: true
                });
            }
        } else {
            const lost = input.lostHours ?? 0, impact = input.impactDays ?? 1;
            if (!Number.isFinite(lost) || lost < 0 || !Number.isInteger(impact) || impact < 0) throw new Error("Enter valid lost hours and impact days");
            const delay: DelayEvent = {
                ...(existing as DelayEvent | undefined),
                id: id as Id<"delay">,
                projectId: project.id,
                scopeNodeId: phase.scopeNodeId,
                affectedPhasePlanIds: [phase.id],
                reportedAt: (existing as DelayEvent | undefined)?.reportedAt ?? now,
                startedAt: (existing as DelayEvent | undefined)?.startedAt ?? at(d.metadata.anchorDate, 9),
                status: (existing as DelayEvent | undefined)?.status ?? "active",
                impactType: "reducedCapacity",
                causeType: (existing as DelayEvent | undefined)?.causeType ?? "other",
                description: title,
                estimatedLostHours: (existing as DelayEvent | undefined)?.estimatedLostHours ?? lost,
                estimatedScheduleImpactDays: (existing as DelayEvent | undefined)?.estimatedScheduleImpactDays ?? impact
            };
            if (existing) Object.assign(existing, delay); else {
                d.delayEvents.push(delay);
                d.delayImpactReports.push({
                    id: `delayImpact-user-${this.userSequence}` as Id<"delayImpact">,
                    delayEventId: delay.id,
                    date: d.metadata.anchorDate,
                    estimatedLostHours: lost,
                    estimatedScheduleImpactDays: impact
                });
            }
        }
        this.rebuild();
        return {id, message: `${input.kind === "issue" ? "Issue" : "Delay"} ${existing ? "updated" : "created"}`};
    }
}
