import {AsyncCommand, DerivedEmitter, FetchState} from '@capillaryjs/capillary'
import type {ReadableEmitter} from '@capillaryjs/capillary'
import type {Component} from '@capillaryjs/capillary-ui'
import type {Parameters, ViewResult} from '../api/ScenarioApi.js'

type ViewQuery = ReadableEmitter<ViewResult | undefined, unknown> & {
    refresh(): Promise<unknown>; activate(): Promise<unknown>
}

/** Presentation intent is parameter-specific; loading and errors remain query-owned. */
export class ViewFeedback {
    private settled: Parameters
    private readonly operations = new Set<AsyncCommand<void, void>>()
    readonly refresh: AsyncCommand<void, void>

    constructor(private readonly query: ViewQuery, private readonly parameters: ReadableEmitter<Parameters>, private readonly owner: Component) {
        this.settled = parameters.get()
        owner.onCleanup(query.subscribe(snapshot => {
            if (snapshot.fetchState === FetchState.Ready || snapshot.fetchState === FetchState.Error) {
                this.settled = parameters.get()
            }
        }, {emitCurrent: false}))
        this.refresh = new AsyncCommand<void, void>({owner, purpose: 'explicit view refresh', execute: async () => {
            await query.refresh()
            if (query.getFetchState() === FetchState.Error) throw query.getError()
        }})
    }

    busyFor(...keys: string[]): boolean {
        const current = this.owner.read(this.parameters)
        if ([...this.operations].some(command => this.owner.read(command.isRunning))) return false
        return this.query.getFetchState() === FetchState.Loading
            && keys.some(key => (current[key] ?? '') !== (this.settled[key] ?? ''))
    }

    /** A detail-only request leaves the collection's existing rows complete. */
    dataBusy(detailKeys: readonly string[] = ['selected', 'phase']): boolean {
        if (this.query.getFetchState() !== FetchState.Loading) return false
        const current = this.owner.read(this.parameters)
        const changed = [...new Set([...Object.keys(current), ...Object.keys(this.settled)])]
            .filter(key => (current[key] ?? '') !== (this.settled[key] ?? ''))
        return changed.length === 0 || changed.some(key => !detailKeys.includes(key))
    }

    operation(purpose: string, change: () => void): AsyncCommand<void, void> {
        const command = new AsyncCommand<void, void>({owner: this.owner, purpose, execute: async () => {
            change()
            // Let the declared deferred argument refresh start, then join that
            // request without issuing a duplicate read.
            await Promise.resolve()
            await this.query.activate()
            if (this.query.getFetchState() === FetchState.Error) throw this.query.getError()
        }})
        this.operations.add(command)
        return command
    }
}

/** Local display choices do not cause transport queries or new query identities. */
export function viewParameters(source: ReadableEmitter<Parameters>, localKeys: readonly string[], owner: Component) {
    return new DerivedEmitter([source] as const, ([params]) =>
        Object.fromEntries(Object.entries(params).filter(([key, value]) =>
            !localKeys.includes(key) && value !== '' && !(key === 'page' && value === '0'))), {
        owner, purpose: 'retrieval parameters',
        equals: (left, right) => Object.keys(left).length === Object.keys(right).length
            && Object.keys(left).every(key => left[key] === right[key]),
    })
}
