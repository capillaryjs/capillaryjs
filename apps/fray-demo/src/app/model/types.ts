import type {FilterModeValue} from '@sylwellsoftware/fray'

export type Scope = 'all' | 'north-plant' | 'warehouse' | 'south-plant'
export type WorkArea = 'portfolio' | 'register' | 'change' | 'analysis'
export type StatusFocus = 'all' | 'planned' | 'active' | 'completed'
export type ChangeRisk = 'Critical' | 'High' | 'Medium' | 'Low'
export type RiskFocus = 'all' | ChangeRisk
export type DemoFetchState = 'automatic' | 'initial' | 'loading' | 'ready' | 'error'
export type AttentionFilter = 'all' | 'attention'
export type PlanningHorizon = '30' | '90' | '365'

export interface Change extends Record<string, unknown> {
    readonly id: string
    readonly title: string
    readonly site: Exclude<Scope, 'all'>
    readonly statusFocus: Exclude<StatusFocus, 'all'>
    readonly risk: ChangeRisk
    readonly status: string
    readonly summary: string
    readonly owner: string
    readonly type: string
    readonly supplierInvolvement: boolean
    readonly safetyImpact: boolean
    readonly progress: number
    readonly plannedStart: string
    readonly plannedCompletion: string
    readonly affectedAssets: readonly string[]
}

export type RiskFilterMap = ReadonlyMap<string, FilterModeValue>

export interface ScopeOption {
    readonly id: Scope
    readonly label: string
}
