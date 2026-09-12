import type {CivilDate} from '@sylwellsoftware/fray'

import type {
    ServiceOwner,
    ServiceRecord,
    ServiceRegion,
    ServiceStatus,
    ServiceTier,
} from './types.js'

export const serviceOwners: readonly ServiceOwner[] = [
    'Platform',
    'Payments',
    'Identity',
    'Operations',
]

export const serviceRegions: readonly ServiceRegion[] = ['EU', 'US', 'APAC']

export const serviceStatuses: readonly ServiceStatus[] = [
    'Ready',
    'Review',
    'Attention',
]

export const serviceTiers: readonly ServiceTier[] = [
    'Critical',
    'Standard',
    'Experimental',
]

const DAY_MILLISECONDS = 86_400_000

/** Local date offset so this module stays dependency-free for node --test. */
function addDays(value: CivilDate, days: number): CivilDate {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(Date.UTC(year!, month! - 1, day! + days))
        .toISOString()
        .slice(0, 10) as CivilDate
}

const serviceNames: readonly string[] = [
    'Atlas gateway',
    'Beacon relay',
    'Cipher vault',
    'Drift ledger',
    'Ember queue',
    'Falcon proxy',
    'Glacier store',
    'Harbor sync',
    'Ion scheduler',
    'Juniper cache',
    'Kepler search',
    'Lumen billing',
    'Mesa router',
    'Nova deploy',
    'Onyx archive',
    'Pulse monitor',
    'Quartz index',
    'Ridge firewall',
    'Signal bridge',
    'Terra backup',
    'Umbra secrets',
    'Vertex compute',
    'Willow notify',
    'Xenon registry',
    'Yield reports',
    'Zenith auth',
    'Aurora ingest',
    'Boreal stream',
    'Cinder batch',
    'Delta audit',
    'Echo telemetry',
    'Flux payments',
    'Gale delivery',
    'Helix identity',
    'Iris analytics',
    'Jolt webhooks',
]

const catalogStart: CivilDate = '2026-07-01'

/** Deterministic service catalog shared by every gallery page. */
export const services: readonly ServiceRecord[] = serviceNames.map(
    (name, index): ServiceRecord => {
        const updated = addDays(catalogStart, (index * 11) % 90)
        return {
            id: `SVC-${String(index + 1).padStart(3, '0')}`,
            name,
            owner: serviceOwners[index % serviceOwners.length]!,
            region: serviceRegions[(index + Math.floor(index / 4)) % serviceRegions.length]!,
            status: serviceStatuses[(index * 7 + 1) % serviceStatuses.length]!,
            tier: serviceTiers[(index * 5 + 2) % serviceTiers.length]!,
            uptime: Math.round((91 + ((index * 13) % 90) / 10) * 10) / 10,
            incidents: (index * 7) % 9,
            updated,
            resolved: addDays(updated, 2 + (index % 9)),
        }
    },
)

export const historyRangeStart: CivilDate = catalogStart
export const historyRangeEnd: CivilDate = '2026-09-30'
