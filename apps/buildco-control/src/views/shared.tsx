import type {FrayChild} from "@sylwellsoftware/fray";
import {Placeholder} from "@sylwellsoftware/fray";
import type {Metric, Row} from "../api/ScenarioApi.ts";
import {human} from "../api/ScenarioApi.ts";

export function formatValue(value: string | number, format?: Metric["format"]): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    switch (format) {
        case "money":
            return n.toLocaleString("en-DK", {style: "currency", currency: "DKK", maximumFractionDigits: 0});
        case "percent":
            return `${Math.round(n)}%`;
        case "hours":
            return `${n.toLocaleString("en-DK")} h`;
        default:
            return Number.isInteger(n) ? String(n) : n.toLocaleString("en-DK", {maximumFractionDigits: 1});
    }
}

export function renderMetric(metric: Metric): FrayChild {
    const text = metric.note ?? formatValue(metric.value, metric.format);
    return <span className="metric">
        <span className="metric-label">{metric.label}</span>
        <span className="metric-value">{text}</span>
    </span>;
}

export function renderField(label: string, value: string | number, format?: Metric["format"]): FrayChild {
    return <>
        <dt>{label}</dt>
        <dd>{format ? formatValue(value, format) : String(value)}</dd>
    </>;
}

export function renderRows(rows: readonly Row[]): FrayChild {
    if (rows.length === 0) return <p className="muted">No records.</p>;
    return <ul className="detail-rows">
        {rows.map(r => <li key={String(r.id)}>
            <span className="row-name">{r.name}</span>
            {r.status ? <span className="row-status">{human(r.status)}</span> : null}
            {r.cost != null ? <span className="row-cost">{formatValue(Number(r.cost), "money")}</span> : null}
            {r.date ? <span className="row-date">{r.date}</span> : null}
        </li>)}
    </ul>;
}

export function LoadingRow(): FrayChild {
    return <p><Placeholder/></p>;
}
