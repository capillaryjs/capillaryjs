import {
    DerivedEmitter,
    Emitter,
    FetchState,
    LiveQuery,
    QueryArg,
    RestQueryHandler,
} from '../src/index.js'
import type {QueryHandlerLike} from '../src/index.js'
import {AsyncCommand} from '../src/experimental.js'

const count = new Emitter(1)
count.subscribe(({value, fetchState}) => {
    value.toFixed()
    fetchState satisfies typeof FetchState[keyof typeof FetchState]
})
count.set(2)
// @ts-expect-error A numeric emitter cannot accept strings.
count.set('two')
// @ts-expect-error Subscriber values retain the emitter's numeric type.
count.subscribe(({value}: {value: string}) => value.toUpperCase())

const label = new Emitter('items')
const summary = new DerivedEmitter(
    [count, label] as const,
    ([currentCount, currentLabel]) => `${currentCount} ${currentLabel}`,
)
summary.get().toUpperCase()
// @ts-expect-error Derived tuple members retain their source positions.
new DerivedEmitter([count, label] as const, ([currentCount]) => currentCount.toUpperCase())

const values = new Emitter<Array<number | null>>([1, null, 3])
values.mapEach((value) => value.toFixed())
// @ts-expect-error mapEach is only callable on array-valued emitters.
count.mapEach((value) => value)

const queryArgument = new QueryArg('search', label)
queryArgument.get().toUpperCase()

type SearchArguments = {term: string; page: number}
type SearchResult = Array<{id: number; title: string}>
const handler: QueryHandlerLike<SearchArguments, SearchResult> = {
    async fetch(args) {
        args.term.toUpperCase()
        args.page.toFixed()
        return [{id: 1, title: 'Result'}]
    },
}
const page = new Emitter(1)
const query = new LiveQuery<SearchResult, {
    term: Emitter<string>
    page: Emitter<number>
}>({handler, args: {term: label, page}, autoFetch: false})
query.get()?.[0]?.title.toUpperCase()

// @ts-expect-error LiveQuery arguments are a named emitter record.
new LiveQuery({handler, args: [label, page]})
new LiveQuery<SearchResult, {term: Emitter<string>; page: Emitter<number>}>({
    handler,
    // @ts-expect-error The page argument must emit numbers.
    args: {term: label, page: label},
})

const rest = new RestQueryHandler<SearchArguments, SearchResult>({
    url: 'https://example.test/search',
    fetch: async () => ({
        ok: true,
        async json() {
            return [{id: 1, title: 'Result'}]
        },
    }),
})
void rest.fetch({term: 'typed', page: 1})
// @ts-expect-error Required REST query fields are checked.
void rest.fetch({term: 'missing page'})

new RestQueryHandler<SearchArguments, SearchResult>({
    url: 'https://example.test/search',
    fetch: globalThis.fetch,
})

const save = new AsyncCommand<{id: number}, {savedId: number}>({
    execute({id}, {signal}) {
        signal.aborted satisfies boolean
        return {savedId: id}
    },
})
save.run({id: 1}).then((result) => result?.savedId.toFixed())
save.isRunning.get().valueOf()
// @ts-expect-error Command arguments retain their declared shape.
void save.run({id: 'one'})
