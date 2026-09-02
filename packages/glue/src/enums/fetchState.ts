export const FetchState = Object.freeze({
    Error: 'error',
    Loading: 'loading',
    Initial: 'initial',
    Ready: 'ready',
} as const)

export type FetchStateValue = typeof FetchState[keyof typeof FetchState]

/** Higher values have higher precedence when source states are combined. */
export const FetchStateValues: ReadonlyMap<FetchStateValue, number> = new Map([
    [FetchState.Ready, 1],
    [FetchState.Initial, 2],
    [FetchState.Loading, 3],
    [FetchState.Error, 4],
])

export function combineFetchStates(states: Iterable<FetchStateValue>): FetchStateValue {
    let combined: FetchStateValue = FetchState.Ready

    for (const state of states) {
        if (!FetchStateValues.has(state)) {
            throw new TypeError(`Unknown fetch state: ${String(state)}`)
        }
        if ((FetchStateValues.get(state) ?? 0) > (FetchStateValues.get(combined) ?? 0)) {
            combined = state
        }
        if (combined === FetchState.Error) break
    }

    return combined
}
