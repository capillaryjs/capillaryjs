import { Button, DescriptionItem, DescriptionList, ProgressBar } from "@sylwellsoftware/fray";
import type { FrayChild, TableColumn } from "@sylwellsoftware/fray";
import type { Detail, Metric, Row } from "../app/contract.ts";
import { human } from "../app/contract.ts";
import { openProject } from "./session.ts";

export const format = (value: unknown, kind?: Metric["format"]): string => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const n = Number(value);
  if (kind === "money") return new Intl.NumberFormat("en-GB", { style: "currency", currency: "DKK", maximumFractionDigits: 0, notation: Math.abs(n) >= 1e6 ? "compact" : "standard" }).format(n);
  if (kind === "percent") return `${n.toFixed(1)}%`;
  if (kind === "hours") return `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })} h`;
  return typeof value === "number" ? value.toLocaleString("en-GB", { maximumFractionDigits: 1 }) : human(value) || "—";
};
export function Status({ value }: { value: unknown }) {
  const label = human(value), tone = /risk|blocked|critical|late|open|low|active/i.test(label) ? "warn" : /complete|resolved|ended|available/i.test(label) ? "good" : "neutral";
  return <span className={`status ${tone}`}>{label || "Recorded"}</span>;
}
export function Metrics({ items }: { items: Metric[] }) {
  return <div className="metrics">{items.map(item => <div className="metric" key={item.label}><span>{item.label}</span><strong>{format(item.value, item.format)}</strong>{item.note && <small>{item.note}</small>}</div>)}</div>;
}
export function RecordCard({ row, compact = false }: { row: Row; compact?: boolean }) {
  return <div className="record-card"><div className="record-title"><strong>{row.name}</strong><Status value={row.status || row.severity || row.reason} /></div>
    <div className="muted">{row.project ?? row.location}{row.scope ? ` / ${row.scope}` : ""}{row.type ? ` · ${human(row.type)}` : ""}</div>
    {row.progress !== undefined && <div className="progress-row"><ProgressBar label={`${row.name} progress`} value={row.progress} /><span>{format(row.progress, "percent")}</span></div>}
    {!compact && <div className="record-facts">{row.forecast && <span>Forecast <b>{String(row.forecast)}</b></span>}{row.variance !== undefined && <span>Schedule <b>{Number(row.variance) > 0 ? `+${row.variance} days` : "On plan"}</b></span>}{row.hours !== undefined && <span>Hours <b>{format(row.hours, "hours")}</b></span>}{row.cost !== undefined && <span>Actual <b>{format(row.cost, "money")}</b></span>}{row.openIssues !== undefined && <span>Open issues <b>{String(row.openIssues)}</b></span>}</div>}
  </div>;
}
const labels: Record<string, string> = { name: "Name", project: "Project", phase: "Phase", scope: "Scope", start: "Planned start", finish: "Baseline finish", forecast: "Forecast finish", progress: "Progress", plannedProgress: "Planned", variance: "Δ days", cost: "Actual cost", budget: "Budget", costVariance: "Cost Δ at progress", overtime: "Overtime", hours: "Hours", headcount: "Assigned", plannedHeadcount: "Planned crew", shortage: "Shortages", late: "Late", due: "Due", estimate: "Estimate", planned: "Planned qty", ordered: "Ordered qty", delivered: "Accepted qty", used: "Used qty", available: "Available qty", unit: "Unit", date: "Date", impact: "Impact · days" };
export function columns(fields: string[]): TableColumn<Row>[] {
  return fields.map(field => ({ field, label: labels[field] ?? human(field), sortable: true,
    ...(field === "status" ? { filterOptions: ["active", "completed", "planned", "atRisk", "blocked", "inProgress", "ready", "complete", "open", "resolved"].map(value => ({ value, label: human(value) })) } : {}),
    render: row => field === "status" || field === "severity" ? <Status value={row[field]} /> : field === "progress" ? <span className="table-progress"><ProgressBar label={`${row.name} progress`} value={Number(row[field])} /><span>{format(row[field], "percent")}</span></span>
      : <span className={["cost", "budget", "costVariance", "estimate", "hours", "variance"].includes(field) ? "numeric" : ""}>{format(row[field], ["cost", "budget", "costVariance", "estimate"].includes(field) ? "money" : field === "plannedProgress" ? "percent" : undefined)}</span> }));
}
export function DetailView({ detail, actions }: { detail: Detail; actions?: FrayChild }) {
  return <section className="detail" aria-label={`${detail.title} details`}><div className="section-heading"><div><span className="eyebrow">Selected record</span><h2>{detail.title}</h2><p className="muted">{detail.subtitle}</p></div>{actions}</div>
    <DescriptionList label="Record facts">{detail.fields.map(f => <DescriptionItem key={f.label} term={f.label} value={format(f.value, f.format)} />)}</DescriptionList>
    {detail.projectId && <Button label="Open in Projects ↗" onClick={() => openProject({ id: detail.id, name: detail.title, projectId: detail.projectId, scopeId: detail.scopeId, phaseId: detail.phaseId })} />}
    {detail.sections.map(section => <details key={section.title} className="detail-section" open={section.title === "Prerequisites"}><summary>{section.title}<span className="count">{section.rows.length}</span></summary>
      {section.rows.length ? section.rows.map(row => <div className="related-record" key={row.id}><strong>{row.name}</strong><span className="muted">{Object.entries(row).filter(([key, value]) => !["id", "name", "traits", "projectId", "scopeId", "phaseId", "phaseIds"].includes(key) && ["status", "relationship", "lag", "due", "date", "forecast", "hours", "cost", "planned", "used", "unit", "ordered", "delivered", "quantity", "supplier", "person"].includes(key) && value !== undefined && value !== "").map(([key, value]) => `${human(key)}: ${format(value, key === "cost" ? "money" : undefined)}`).join(" · ")}</span>
        {row.phaseId && <Button label="View phase" onClick={() => openProject(row)} />}</div>) : <p className="empty-inline">No linked records.</p>}
    </details>)}
  </section>;
}
