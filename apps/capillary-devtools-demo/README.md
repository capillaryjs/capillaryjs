# Capillary DevTools flow lab

Backend-free executable documentation of interaction-to-leaf tracing. Scenario
policy lives in this app, propagation in Capillary, and recording/inspection in
the optional DevTools package. No scenario fetches a real network endpoint.

From the public workspace:

```sh
pnpm build
pnpm --filter @capillaryjs/capillary-devtools-demo dev
```

Open `http://127.0.0.1:3004`. Type a search, select a recorded root, and follow it
to the real DataTable, reactive summary/title, callbacks, and unsubscribed
combined-score/saved-search leaves. Source/target selectors focus the graph;
the outline keeps repeated diamond executions distinct.

The visible controls exercise direct/unchanged writes, failure then retry,
pending-request supersession, abort, disposal, and command completion/abort.
The injected clock and retry scheduler make recorded ordering and retry delay
deterministic. Only those controls run application actions; playback never does.
After disposing the query, reload to restore the scenario.

`compact.html` composes only the graph, details, and playback controls.
`index.html` composes the complete inspector. The build verifies the compact
JavaScript dependency graph excludes unselected presentation modules.
`?limit=12` demonstrates eviction; `?late=1` demonstrates explicit late capture.
Application and inspection runtimes have separate diagnostic ownership scopes.

`pnpm test` tests scenario behavior. From the public root,
`pnpm exec playwright test apps/capillary-devtools-demo/test/browser/flow.spec.ts`
tests visible interactions, complete trace paths, request lifecycles, replay
isolation, keyboard controls, constrained width, and accessibility in Chromium,
Firefox, and WebKit. The Chromium run produces a full-page review image under
`.artifacts/devtools/flow.png`; it supplements semantic assertions.
