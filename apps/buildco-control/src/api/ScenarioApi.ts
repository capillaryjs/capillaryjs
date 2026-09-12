import type { HistoryShape } from "@sylwellsoftware/fray-visualization";
import type { ScenarioMetadata, ScopeNode } from "../domain/model.ts";

export const SCREENS = ["overview", "projects", "queue", "operations", "issue-analysis", "economic-trends", "issue-report"] as const;
export type Screen = typeof SCREENS[number];
export type Parameters = Record<string, string>;
export type SemanticMode = "neutral" | "prefer" | "require" | "deny";
export interface Choice { value: string; label: string }
export interface Row extends Record<string, unknown> {
  id: string; name: string; projectId?: string; project?: string; scopeId?: string; scope?: string;
  phaseId?: string; phase?: string; status?: string; progress?: number; variance?: number;
  cost?: number; date?: string; traits?: Record<string, boolean>;
}
export interface Metric { label: string; value: number; format?: "money" | "percent" | "hours" | "number"; note?: string }
export interface Detail {
  id: string; title: string; subtitle?: string;
  fields: { label: string; value: string | number; format?: Metric["format"]; group?: string }[];
  sections: { title: string; rows: Row[]; empty?: string }[];
  projectId?: string; scopeId?: string; phaseId?: string; record?: Row;
}
export interface Bootstrap {
  metadata: ScenarioMetadata; projects: Row[];
  choices: Record<string, Choice[]>;
}
export interface ViewResult {
  rows: Row[]; total: number; page: number; pageSize: number; metrics: Metric[];
  detail?: Detail; tree?: ScopeNode[]; milestones?: Row[]; attention?: Row[];
  options?: Record<string, Choice[]>; chartItems?: Row[]; series?: readonly HistoryShape[];
  chartLabel?: string; chartUnit?: string; notice?: string;
}
export interface Mutation {
  kind: "issue" | "delay"; action: "create" | "edit" | "resolve"; id?: string;
  projectId?: string; scopeId?: string; phaseId?: string;
  title?: string; description?: string; severity?: string; status?: string; cause?: string;
  dueDate?: string; personId?: string; estimatedCost?: number; lostHours?: number; impactDays?: number;
}
export const CONDITIONS: readonly Choice[] = [
  { value: "highRisk", label: "High risk" }, { value: "behindSchedule", label: "Behind schedule" },
  { value: "overBudget", label: "Over budget" }, { value: "highOvertime", label: "High overtime" },
  { value: "understaffed", label: "Understaffed" }, { value: "materialShortage", label: "Material shortage" },
  { value: "lateMaterial", label: "Late delivery" }, { value: "openDefects", label: "Open defects" },
  { value: "blocked", label: "Blocked prerequisite" }, { value: "staleReporting", label: "Stale reporting" },
];
export function human(value: unknown): string {
  return String(value ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
}
/** Same semantics as Fray: denies win, require is AND, prefer is OR. */
export function matchesConditions(traits: Record<string, boolean>, modes: Record<string, SemanticMode>): boolean {
  const known = Object.entries(modes).filter(([key]) => key in traits);
  return !known.some(([key, mode]) => mode === "deny" && traits[key]) &&
    known.every(([key, mode]) => mode !== "require" || traits[key]) &&
    (!known.some(([, mode]) => mode === "prefer") || known.some(([key, mode]) => mode === "prefer" && traits[key]));
}
