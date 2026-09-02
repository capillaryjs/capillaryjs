# Glue experimental APIs

Everything imported from `@sylwellsoftware/glue/experimental` is outside Glue's
stable alpha compatibility surface. It may change in any `0.x` release without
a deprecation window. The stable package root does not export these symbols.

## `AsyncCommand`

`AsyncCommand<TArguments, TResult, TError>` owns one abortable asynchronous
mutation lifecycle. The command itself is a readable emitter whose value is the
last successful result and whose fetch state/error describe the current or
latest run. `isRunning` is a read-only boolean emitter for presentation logic.

```ts
import {AsyncCommand} from '@sylwellsoftware/glue/experimental'

const save = new AsyncCommand<{id: string}, {saved: boolean}>({
  async execute({id}, {signal}) {
    const response = await fetch(`/api/records/${id}`, {method: 'POST', signal})
    return {saved: response.ok}
  },
})

const result = await save.run({id: 'record-1'})
save.abort()
save.reset()
save.dispose()
```

The default concurrency policy is `ignore`: an overlapping `run()` returns the
active promise without executing the new arguments. `replace` aborts and
supersedes the active run; `reject` rejects only the overlapping invocation
with `AsyncCommandConcurrencyError`. Executors always receive the current
abort signal and optional causal event.

Successful runs resolve their result. Failed, aborted, stale, or disposed runs
resolve `undefined`; failures remain observable through `getError()` and
`FetchState.Error`. The last successful result remains visible while loading
and after an error. `reset()` aborts active work and returns the snapshot to
`FetchState.Initial`. `dispose()` is idempotent and permanently suppresses
late settlement.

The command does not queue, retry, report notifications, or own DOM behavior.
Batch progress and partial-result aggregation remain application concerns.
