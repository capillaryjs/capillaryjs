import type {CivilDate} from '@sylwellsoftware/fray'

export type LayoutVariant = 'shell' | 'website'

export type ServiceOwner = 'Platform' | 'Payments' | 'Identity' | 'Operations'
export type ServiceRegion = 'EU' | 'US' | 'APAC'
export type ServiceStatus = 'Ready' | 'Review' | 'Attention'
export type ServiceTier = 'Critical' | 'Standard' | 'Experimental'

export type OwnerFocus = 'all' | ServiceOwner
export type AttentionFocus = 'all' | 'attention'
export type ActiveState = 'inactive' | 'active'

export interface ServiceRecord extends Record<string, unknown> {
    readonly id: string
    readonly name: string
    readonly owner: ServiceOwner
    readonly region: ServiceRegion
    readonly status: ServiceStatus
    readonly tier: ServiceTier
    readonly uptime: number
    readonly incidents: number
    readonly updated: CivilDate
    readonly resolved: CivilDate
}

export interface FormSubmission extends Record<string, unknown> {
    readonly id: string
    readonly name: string
    readonly owner: ServiceOwner
    readonly tier: ServiceTier
    readonly status: ServiceStatus
    readonly readiness: number
    readonly submitted: string
}
