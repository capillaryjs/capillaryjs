import {ProgressBar} from '@sylwellsoftware/fray'

import type {FormSubmission, ServiceRecord} from '../model/types.js'

/** Shared service-register columns used by the data-grid and directory pages. */
export const serviceColumns = [
    {field: 'id', label: 'Id', sortable: true},
    {field: 'name', label: 'Service', sortable: true},
    {
        field: 'owner',
        label: 'Owner',
        sortable: true,
        filterOptions: ['Platform', 'Payments', 'Identity', 'Operations'],
    },
    {
        field: 'region',
        label: 'Region',
        sortable: true,
        filterOptions: ['EU', 'US', 'APAC'],
    },
    {
        field: 'status',
        label: 'Status',
        sortable: true,
        filterOptions: ['Ready', 'Review', 'Attention'],
    },
    {field: 'tier', label: 'Tier', sortable: true},
    {
        field: 'uptime',
        label: 'Uptime',
        sortable: true,
        render: (row: ServiceRecord) => <ProgressBar
            label="Uptime"
            value={row.uptime}
            valueText={`${row.uptime}%`}
        />,
    },
    {field: 'incidents', label: 'Incidents', sortable: true},
    {field: 'updated', label: 'Updated', sortable: true},
]

/** Submission columns for the forms page data area. */
export const submissionColumns = [
    {field: 'id', label: 'Id', sortable: true},
    {field: 'name', label: 'Service', sortable: true},
    {field: 'owner', label: 'Owner', sortable: true},
    {field: 'tier', label: 'Tier', sortable: true},
    {field: 'status', label: 'Status', sortable: true},
    {
        field: 'readiness',
        label: 'Readiness',
        sortable: true,
        render: (row: FormSubmission) => <ProgressBar
            label="Readiness"
            value={row.readiness}
            valueText={`${row.readiness}%`}
        />,
    },
    {field: 'submitted', label: 'Submitted', sortable: true},
]
