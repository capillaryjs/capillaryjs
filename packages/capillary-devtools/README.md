# Capillary DevTools

Opt-in causal recordings and independently composable inspection views for
Capillary applications. Follow a native interaction through values, derivations,
query/command attempts, subscriptions, and the UI that consumes the result.
Emitters without subscribers are also visible downstream leaves.

## Compatibility and installation

Requires the diagnostics-enabled Capillary and Capillary UI 1.2 release lines.
This checkout contains those framework additions; their release versions are
prepared through the guarded release workflow, not by starting the demo.
DevTools 1.0.0 is an unpublished initial release candidate in this checkout.

```sh
pnpm add @capillaryjs/capillary @capillaryjs/capillary-ui @capillaryjs/capillary-devtools
```

All packages are ESM. Capillary and Capillary UI are peers, never bundled copies.
The headless `./model` entry imports no UI code or browser globals.

## Record and inspect

Start capture before constructing the application to discover the entire graph.
Mount the inspector alongside, not inside, the application being inspected.

```ts
import {createCapillaryUiRuntime} from '@capillaryjs/capillary-ui'
import {TraceRecorder, TraceSelection, TracePlayback, TraceInspector,
    devtoolsDiagnosticScope} from '@capillaryjs/capillary-devtools'

const recorder = new TraceRecorder({verbose: true}).start({fromStart: true})
// Construct and mount your application here, using its normal runtime.
const selection = new TraceSelection()
const playback = new TracePlayback()
const tools = createCapillaryUiRuntime({diagnosticScope: devtoolsDiagnosticScope})
tools.registerStyles(TraceInspector)
tools.mount(tools.create(TraceInspector, {recording: recorder, selection, playback}), document.body)
tools.injectStyles()
```

Choose a recorded root, then a source or target if needed. The graph shows one
node per identity, while the causal outline preserves every execution, including
both paths through a diamond. Solid arrows are recorded causal hops. Dashed
arrows are known connections/input provenance, not proof of execution. Expand
**Downstream leaves** to select UI endpoints, callbacks, and unsubscribed
emitters. Details show inputs, values, state, errors, attempt outcomes, and
capture limitations. A node with no observed event is labelled as such.

Components show render calls separately from lifecycle-event counts. A render
start and completion are two events, usually one render; synchronous reentrant
passes are counted too. UI consumers are identified even when they have downstream
children. `DataTable` has named header, column-header, and body consumers. A body
render can change rows without rendering unchanged headers.

Consumer details show the trigger (`dependency`, `parent`, or `explicit`) and
**own renderer DOM writes**. These counts exclude nested consumers and application
DOM code; they include renderer writes to detached nodes. They are not paint/layout
measurements. Zero own writes does not mean that child consumers did no work.
Older recordings without this metadata show unknown effects. The composed inspector
places node details beside the graph; standalone views remain independently composable.

First/previous/next, the range control, and optional timed playback inspect the
recording only. They never rewind or rerun application work. The default is the
complete flow, with no autoplay; timed playback starts only on explicit Play.
Elapsed-time mode caps idle waits. Node geometry stays fixed while stepping.

For late attachment use `recorder.start({roots: [searchEmitter, resultQuery]})`.
Known reachable connections can be discovered, but earlier activity, disposed
objects, and disconnected objects cannot be reconstructed. `fromStart: true` is
a caller assertion, not an automatic proof of capture completeness.

`stop()` pauses capture without releasing history; `start()` resumes with a gap
notice; `reset()` clears history and marks an active restart as late capture.
`snapshot()` returns an immutable flat recording. `export()` returns safe JSON.
Destroy mounted views and dispose the recorder, selection, and playback when
their owner ends. Disposing a recorder stops capture; its final snapshot remains
available to the caller.

## Capture and privacy

| Option | Default and meaning |
| --- | --- |
| `maxEvents` | 2,000 retained occurrences |
| `maxBytes` | 2,000,000 estimated UTF-16 bytes of serialized records; not a heap-size guarantee |
| `maxNodes`, `maxEdges` | 2,000 nodes and 8,000 connection lifetime records |
| `maxPreviewLength` | 180 characters per preview |
| `maxSnapshotDepth`, `maxSnapshotEntries` | 3 levels (maximum 20), 100 properties across each captured value tree |
| `capture` | `scalar`: metadata and primitive previews; object contents are not read |
| `topology`, `ui`, `verbose` | `true`, `true`, `false`; verbose adds unchanged recomputations and input snapshots |
| `clock` | `Date.now`; use a monotonic/injected clock for measured intervals |

Payload modes are `none`, `scalar`, `preview`, `snapshot`, `raw`, and `formatter`.
`preview` explicitly opts into shallow own-property inspection (at most eight
retained fields, no getters or recursive copy). Proxy descriptor traps may run;
failures are caught. `raw` deliberately retains mutable references, labels them
non-historical, and excludes them from JSON **before** serialization, including
`toJSON`. Their referenced heaps are outside the byte budget. `formatter`
requires a pure `(value, {nodeId, field}) => string` function for application
redaction. Formatter failures become a capture-error preview, not an application
exception. Node labels/causes are metadata, not passed through payload redaction;
do not put secrets there. Scalar strings can also be sensitive.

For trusted development data, opt into expandable capture-time object contents:

```ts
const recorder = new TraceRecorder({
    verbose: true,
    capture: 'snapshot',
    maxSnapshotDepth: 4,
    maxSnapshotEntries: 100,
    maxPreviewLength: 180,
}).start({fromStart: true})
```

`snapshot` copies nested own data properties into immutable `ValueSnapshot` trees.
Details expand values, before-values, errors, and inputs without accessing the live
objects. Arrays show their captured length. Cycles, accessors, descriptor failures,
and depth/entry/string limits have explicit markers. Getters and `toJSON` are never
called; proxy own-key/descriptor traps may run and failures are contained. Property
enumeration itself follows JavaScript's `Reflect.ownKeys` behavior; the entry budget
bounds retained/traversed properties, not a proxy's own execution time. Captured trees
participate in `maxBytes` and JSON export. Original object references are not retained.
This mode can retain sensitive fields; application policy must choose whether to use it.

Scalar recordings cannot recover omitted contents later: configure capture and
record a new interaction. `preview` remains shallow; increasing its character
limit does not make it recursive. `raw` is not a historical object snapshot.

Eviction is explicit; missing parents/metadata and unfinished attempts are never
presented as a complete trace or proof that a request is still running. An
unchanged node is only an observed unchanged recomputation in verbose mode.
Otherwise no event means unknown, not “did not execute.”

Capture is opt-in and caller-owned. Importing the package does not start it.
Deployment, authorization, data retention/export, and production inclusion are
application policy. Use a formatter or `none` for sensitive payloads.

## Compose only the views you need

```ts
import {TraceRecorder, TraceSelection, TracePlayback} from '@capillaryjs/capillary-devtools/model'
import {FlowGraphView} from '@capillaryjs/capillary-devtools/views/FlowGraphView'
import {TracePlaybackControls} from '@capillaryjs/capillary-devtools/views/TracePlaybackControls'
```

Every view accepts `{recording, selection, playback?}`, where `recording` is a
recorder or an immutable snapshot. No view creates a recorder or application
model. Independently exported views: `CausalTraceView`,
`ChronologicalTraceView`, `FlowGraphView`, `TraceTimelineView`,
`ActivityOverviewView`, `TraceDetailsView`, and `TracePlaybackControls`.
`TraceInspector` is their optional workbench composition. Timeline is a precise
attempt start/duration/outcome table; it does not infer background work.

Use runtime style registration for just the selected component dependencies, or
import `@capillaryjs/capillary-devtools/styles/structural.css` for all views.
CSS uses `--cap-trace-text`, `-surface`, `-line`, `-accent`, `-selected`, `-muted`,
and `-warning` variables (all with neutral fallbacks). Controls are native and
keyboard-operable; the scrollable graph has an equivalent textual outline and
leaf list. There is no implicit animation or reduced-motion exception.

The public model also exports `filterTrace`, `traceRoots`, `causalOutline`,
`projectFlow`, `traceAttempts`, `captureLimitations`, `TraceRecording`, and their
associated types. Schema/protocol version 1 separates immutable occurrences
from stable identities and connection intervals. Graph layout handles feedback
cycles without recursively executing the graph.

`nodeValueEvent(nodeEvents)` selects the last observed state rather than a later
lifecycle marker's absent payload. Graph/node details use this rule, so a query's
successful result is not replaced visually by an empty “operation closed” fact.
While stepping, event details follow the cursor; choosing a node instead keeps
its observed state in focus. Attempt tables describe the complete selected trace.

DevTools emitters and views use `devtoolsDiagnosticScope`, including internal
controls. They cannot enter a recording through a captured parent. A tool that
intentionally writes an existing application emitter does **not** hide that
application write. Custom inspection components should use the same runtime
scope; ordinary application components must not.

See the repository's [diagnostics guide](../../docs/diagnostics.md) for explicit
async causality and [flow lab](../../apps/capillary-devtools-demo/README.md) for
the workbench and compact compositions.
