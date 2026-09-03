import {
    DerivedEmitter,
    Emitter,
    LiveQuery,
    RestEndpoint,
} from '@sylwellsoftware/glue'
import type {QueryHandlerLike} from '@sylwellsoftware/glue'
import {AsyncCommand} from '@sylwellsoftware/glue'

const left = new Emitter(2)
const right = new Emitter(3)
const total = new DerivedEmitter(
    [left, right] as const,
    ([leftValue, rightValue]) => leftValue + rightValue,
)
total.get().toFixed()

type Arguments = {term: string}
type Result = {id: string}
const handler: QueryHandlerLike<Arguments, Result> = {
    fetch: ({term}) => ({id: term}),
}
const term = new Emitter('alpha')
const query = new LiveQuery<Result, {term: Emitter<string>}>({
    handler,
    args: {term},
    autoFetch: false,
})
query.get()?.id.toUpperCase()

const endpoint = new RestEndpoint<Arguments, Result>({
    url: 'https://example.test/items',
    fetch: async () => ({
        ok: true,
        json: () => ({id: 'record-1'}),
    }),
    parseResult: (value) => value as Result,
})
const endpointResult = endpoint.open({term})
endpointResult.get()?.id.toUpperCase()

const command = new AsyncCommand<{id: string}, Result>({
    execute: ({id}, {signal}) => {
        signal.aborted satisfies boolean
        return {id}
    },
})
void command.run({id: 'record-1'})
command.get()?.id.toUpperCase()
// @ts-expect-error Built declarations preserve command argument types.
void command.run({id: 1})

// @ts-expect-error Declaration consumers cannot change emitter value types.
term.set(42)
