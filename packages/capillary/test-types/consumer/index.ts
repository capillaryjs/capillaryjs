import {
    DerivedEmitter,
    Emitter,
    bindCommand,
    connect,
    LiveQuery,
    replaceArg,
    RestEndpoint,
    valueChanges,
    writableProjection,
} from '@capillaryjs/capillary'
import type {
    LiveQueryExecution,
    LiveQueryRefreshOptions,
    QueryHandlerLike,
    RetryPolicy,
} from '@capillaryjs/capillary'
import {AsyncCommand} from '@capillaryjs/capillary'

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
const retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    delayMs: 500,
    backoff: 'exponential',
    maxDelayMs: 30_000,
    jitter: true,
    shouldRetry: (error, attempt) => error instanceof Error && attempt < 3,
}
const query = new LiveQuery<Result, {term: Emitter<string>}>({
    handler,
    args: {term},
    autoFetch: false,
    retry: retryPolicy,
})
query.get()?.id.toUpperCase()
const replacement: LiveQueryRefreshOptions = {retention: 'replace'}
void query.refresh('project changed', replacement)
const project = replaceArg(new Emitter('project-a'))
new LiveQuery({handler: {fetch: ({project: id}: {project: string}) => ({id})}, args: {project}})
const execution: LiveQueryExecution = 'deferred'
const deferredQuery = new LiveQuery<Result, {term: Emitter<string>}>({
    handler,
    args: {term},
    execution,
})
void deferredQuery.activate().then((result) => result?.id.toUpperCase())

const endpoint = new RestEndpoint<Arguments, Result>({
    url: 'https://example.test/items',
    fetch: async () => ({
        ok: true,
        json: () => ({id: 'record-1'}),
    }),
    parseResult: (value) => value as Result,
    query: {retry: {maxAttempts: 2, backoff: 'fixed', delayMs: 100}},
})
const endpointResult = endpoint.open({term}, {execution: 'explicit', retry: null})
endpointResult.get()?.id.toUpperCase()

const command = new AsyncCommand<{id: string}, Result>({
    execute: ({id}, {signal, idempotencyKey}) => {
        signal.aborted satisfies boolean
        idempotencyKey satisfies string | undefined
        return {id}
    },
    idempotencyKey: ({id}) => `save:${id}`,
    retry: {maxAttempts: 2, backoff: (attempt) => attempt * 250},
})
void command.run({id: 'record-1'})
command.get()?.id.toUpperCase()
command.succeeded.subscribe(({arguments: successArguments, result}) => {
    successArguments.id.toUpperCase()
    result.id.toUpperCase()
})
const clearTerm = connect({on: command.succeeded, target: term, value: () => ''})
clearTerm.errors.subscribe(({error, occurrence}) => {
    error satisfies unknown
    occurrence.result.id.toUpperCase()
})
clearTerm()
const runCurrent = bindCommand(command, {id: term})
void runCurrent()
const item = new Emitter({id: 'record-1', title: 'Original'})
const title = writableProjection(item, {
    read: (value) => value.title,
    write: (value, nextTitle) => ({...value, title: nextTitle}),
})
title.set('Updated')
new LiveQuery({handler, args: {term}, refreshOn: [command.succeeded], enabled: new Emitter(true)})
valueChanges(term).subscribe(({value}) => value.toUpperCase())
// @ts-expect-error Built declarations preserve command argument types.
void command.run({id: 1})

// @ts-expect-error Declaration consumers cannot change emitter value types.
term.set(42)
