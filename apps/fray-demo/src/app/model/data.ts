import type {
    Change,
    ChangeRisk,
    Scope,
    ScopeOption,
    StatusFocus,
} from './types.js'

const seedChanges: readonly Change[] = [
    {
        id: 'CR-104',
        title: 'Emergency lighting renewal',
        site: 'north-plant',
        statusFocus: 'active',
        risk: 'Critical',
        status: 'Ready for review',
        summary: 'Replace emergency luminaires before the winter maintenance window.',
        owner: 'J. Meyer',
        type: 'Safety',
        supplierInvolvement: true,
        safetyImpact: true,
        progress: 64,
        plannedStart: '2026-09-18',
        plannedCompletion: '2026-10-04',
        affectedAssets: ['Assembly hall', 'Emergency lighting circuit EL-2'],
    },
    {
        id: 'CR-118',
        title: 'Packaging-line guard upgrade',
        site: 'north-plant',
        statusFocus: 'planned',
        risk: 'High',
        status: 'Planned',
        summary: 'Install the approved interlocked guard during the next production stop.',
        owner: 'A. Sørensen',
        type: 'Machinery',
        supplierInvolvement: true,
        safetyImpact: true,
        progress: 18,
        plannedStart: '2026-10-12',
        plannedCompletion: '2026-10-16',
        affectedAssets: ['Packaging line 3', 'Guard controller GC-3'],
    },
    {
        id: 'CR-203',
        title: 'Warehouse racking inspection',
        site: 'warehouse',
        statusFocus: 'active',
        risk: 'Medium',
        status: 'In assessment',
        summary: 'Confirm remedial work after the annual racking inspection.',
        owner: 'R. Patel',
        type: 'Facilities',
        supplierInvolvement: false,
        safetyImpact: true,
        progress: 42,
        plannedStart: '2026-09-09',
        plannedCompletion: '2026-09-28',
        affectedAssets: ['Racking aisles A–F', 'Loading bay 2'],
    },
    {
        id: 'CR-221',
        title: 'Boiler-control procedure review',
        site: 'south-plant',
        statusFocus: 'completed',
        risk: 'Low',
        status: 'Completed',
        summary: 'Update the isolation procedure before the next contractor visit.',
        owner: 'M. Liu',
        type: 'Procedure',
        supplierInvolvement: false,
        safetyImpact: false,
        progress: 100,
        plannedStart: '2026-08-14',
        plannedCompletion: '2026-08-28',
        affectedAssets: ['Boiler house', 'Isolation procedure OP-17'],
    },
    {
        id: 'CR-237',
        title: 'Forklift charging relocation',
        site: 'warehouse',
        statusFocus: 'planned',
        risk: 'High',
        status: 'Awaiting approval',
        summary: 'Move charging bays away from outbound staging and renew ventilation.',
        owner: 'E. Novak',
        type: 'Facilities',
        supplierInvolvement: true,
        safetyImpact: true,
        progress: 8,
        plannedStart: '2026-11-02',
        plannedCompletion: '2026-11-20',
        affectedAssets: ['Charging bays 1–4', 'Outbound staging'],
    },
    {
        id: 'CR-244',
        title: 'Shift handover checklist',
        site: 'south-plant',
        statusFocus: 'active',
        risk: 'Medium',
        status: 'Pilot running',
        summary: 'Standardise maintenance handover across production and utilities.',
        owner: 'C. Jensen',
        type: 'Organisation',
        supplierInvolvement: false,
        safetyImpact: false,
        progress: 73,
        plannedStart: '2026-09-05',
        plannedCompletion: '2026-09-25',
        affectedAssets: ['Production shifts', 'Utilities team'],
    },
]

const sites = ['north-plant', 'warehouse', 'south-plant'] as const satisfies readonly Exclude<Scope, 'all'>[]
const risks = ['Critical', 'High', 'Medium', 'Low'] as const satisfies readonly ChangeRisk[]
const lifecycles = ['planned', 'active', 'completed'] as const satisfies readonly Exclude<StatusFocus, 'all'>[]
const owners = [
    'J. Meyer',
    'A. Sørensen',
    'R. Patel',
    'M. Liu',
    'E. Novak',
    'C. Jensen',
    'T. Okafor',
    'L. Kowalski',
    'S. Berg',
    'N. Iqbal',
    'P. Duarte',
    'H. Yamamoto',
] as const
const workTypes = [
    'Safety',
    'Machinery',
    'Facilities',
    'Procedure',
    'Organisation',
    'Digital',
    'Utilities',
    'Compliance',
] as const
const actions = [
    'Inspection renewal',
    'Control-system upgrade',
    'Isolation review',
    'Guarding improvement',
    'Ventilation assessment',
    'Emergency-plan rehearsal',
    'Sensor replacement',
    'Workflow standardisation',
    'Power-distribution survey',
    'Access-control revision',
    'Maintenance-window preparation',
    'Operator-training update',
] as const
const assets = [
    'Assembly line',
    'Packaging cell',
    'Loading bay',
    'Boiler house',
    'Electrical room',
    'Process-water system',
    'Warehouse aisle',
    'Compressed-air plant',
    'Fire compartment',
    'Maintenance workshop',
] as const
const statusLabels: Readonly<Record<Exclude<StatusFocus, 'all'>, readonly string[]>> = {
    planned: ['Drafting scope', 'Awaiting approval', 'Scheduled', 'Supplier quoting'],
    active: ['In assessment', 'Work in progress', 'Pilot running', 'Ready for review'],
    completed: ['Completed', 'Verified', 'Closed after review', 'Benefits confirmed'],
}

const generatedChanges = Array.from({length: 138}, (_, index): Change => {
    const sequence = index + 300
    const site = sites[index % sites.length]!
    const risk = risks[(index * 3 + Math.floor(index / 7)) % risks.length]!
    const statusFocus = lifecycles[(index + Math.floor(index / 5)) % lifecycles.length]!
    const type = workTypes[(index * 5 + 1) % workTypes.length]!
    const action = actions[(index * 7 + 2) % actions.length]!
    const asset = assets[(index * 3 + Math.floor(index / 4)) % assets.length]!
    const start = addDays('2026-09-07', index % 80)
    const completion = addDays(start, 4 + (index * 5) % 24)
    const progress = statusFocus === 'completed'
        ? 100
        : statusFocus === 'planned'
            ? (index * 7) % 31
            : 24 + (index * 11) % 67
    const siteLabel = site === 'north-plant'
        ? 'North Plant'
        : site === 'south-plant'
            ? 'South Plant'
            : 'Warehouse'
    return Object.freeze({
        id: `CR-${sequence}`,
        title: `${asset} — ${action.toLocaleLowerCase()}`,
        site,
        statusFocus,
        risk,
        status: statusLabels[statusFocus][index % statusLabels[statusFocus].length]!,
        summary: `${action} for ${asset.toLocaleLowerCase()} at ${siteLabel}, coordinated across the ${type.toLocaleLowerCase()} workstream.`,
        owner: owners[(index * 5 + 3) % owners.length]!,
        type,
        supplierInvolvement: index % 3 !== 0,
        safetyImpact: (index + Math.floor(index / 4)) % 3 !== 0,
        progress,
        plannedStart: start,
        plannedCompletion: completion,
        affectedAssets: Object.freeze([
            `${asset} ${1 + index % 9}`,
            `${siteLabel} zone ${String.fromCharCode(65 + index % 8)}`,
        ]),
    })
})

/** A stable, varied 144-row scenario shared by every Meridian work area. */
export const changes: readonly Change[] = Object.freeze([
    ...seedChanges,
    ...generatedChanges,
])

export const scopes: readonly ScopeOption[] = [
    {id: 'all', label: 'All sites'},
    {id: 'north-plant', label: 'North Plant'},
    {id: 'warehouse', label: 'Warehouse'},
    {id: 'south-plant', label: 'South Plant'},
]

function addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
}
