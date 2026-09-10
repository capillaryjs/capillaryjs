# BuildCo Control

Construction operations application for Glue, Fray and Fray Visualization, backed
by a deterministic construction scenario and a shared query/command service.
Seven connected screens cover portfolio delivery, projects, planning, work queues,
resources, exceptions, and operational analytics.

This is a public framework workspace application. It consumes Glue, Fray and
Fray Visualization from their package source and uses the same toolchain as the
rest of the framework.

## Run

Requires Node 22.6+ and pnpm 10. From the `framework` directory:

```sh
pnpm --filter @sylwellsoftware/buildco-control dev
```

Open **http://127.0.0.1:5173/**. The default 40-project scenario is generated in a
Web Worker; initial generation can take around 30 seconds. Use
**http://127.0.0.1:5173/?profile=small** for the five-project quick-start dataset.
No backend is required in this embedded mode. All data stays local.

```sh
pnpm --filter @sylwellsoftware/buildco-control build
pnpm --filter @sylwellsoftware/buildco-control preview
pnpm --filter @sylwellsoftware/buildco-control verify
pnpm --filter @sylwellsoftware/buildco-control test:ui
pnpm --filter @sylwellsoftware/buildco-control test:http
pnpm --filter @sylwellsoftware/buildco-control test:demo
```

Browser tests require Chromium (`pnpm exec playwright install chromium` if it is
not already installed). The default preview port is 4173.

For HTTP transport, run `pnpm --filter @sylwellsoftware/buildco-control server` in
a second terminal, then open **http://127.0.0.1:5173/?transport=http**. Vite proxies
`/api` to the local service on port 4176. `BUILDCO_PROFILE=small pnpm --filter
@sylwellsoftware/buildco-control server` uses the quick dataset. Embedded and HTTP
modes instantiate the same `ConstructionScenario`; only the adapter changes. HTTP
clients share one in-memory scenario, whereas each embedded tab owns its own
scenario. There is no database persistence or authentication.

### Generator CLI

`pnpm --filter @sylwellsoftware/buildco-control scenario` uses the small profile for
quick inspection. The exported `generateScenario()` function defaults to the normal
demo. Both use seed 18431 and anchor date 2026-09-01. There are no network, browser
or database dependencies in the generator.

```sh
pnpm --filter @sylwellsoftware/buildco-control scenario --seed 42 --anchor 2027-01-15 --profile small
pnpm --filter @sylwellsoftware/buildco-control scenario --profile small --after 3 --at 2026-10-01
pnpm --filter @sylwellsoftware/buildco-control scenario --profile small --at 2026-08-03 --json
pnpm --filter @sylwellsoftware/buildco-control scenario --profile stress
```

The summary includes record counts, project progress/costs, operational
conditions and causal coverage checks. `--json` emits the public scenario
snapshot to stdout. `--projects`, `--before` and `--after` override project count
and the number of whole simulation months before/after the anchor. Use the
library API for large corpora instead of serializing an entire stress dataset.

## Implemented

- Overview with portfolio progress, lifecycle/risk filters, and actionable work.
- Project/scope tree, summary, phase details, prerequisites, milestones, resource
  budgets, actual consumption, staffing, and progress reports.
- Planning date/horizon, delayed/blocked filters, sortable/paged phase register.
- Work queue with Fray's neutral/prefer/require/deny operational predicates.
- People, labour and material registers, assignments, utilization, order/delivery
  detail, activity/date filters, and cross-project overtime.
- Issue/delay registers with causal and cost filters and create/edit/resolve
  dialogs. Commands update the shared query results; no actual costs are fabricated.
- Real `BlockGraph` distributions with hide/split controls and selected-record
  inspection, plus `LineGraph` history for six operational metric groups.
- Seven hash routes, deep links, back/forward navigation, active-only mounting,
  query cleanup, and persistent user filter/selection state.
- Theme/palette pickers, forced initial/loading/ready/error states, preserve/clear
  results, control flags, and seed/profile regeneration outside disabled content.
- Canonical reference, planning and execution entities, with typed IDs.
- Seven project types with physical scope trees, resource recipes, cross-scope
  dependencies and approved baseline plans.
- Finish-to-start, start-to-start and finish-to-finish scheduling and execution
  constraints, with cycle rejection.
- Historical, active and future project cohorts. Completion comes from actual
  productive work and completion reports.
- Daily shared-personnel allocation, limited regular/overtime capacity, absence,
  temporary cover, procurement, partial/rejected deliveries, inventory and reorders.
- Productive work, material waste, defects, issue-linked rework, contiguous delays,
  progress reports and milestone forecasts.
- Company-wide ISO-week overtime allocation, effective labour rates,
  weighted-average material valuation and issue-cost attribution.
- Historical snapshots, PhaseHealth, portfolio/project summaries, operational
  predicates and scenario coverage reporting.

## Time and calculation contracts

`anchorDate` is the demo's fixed today. The simulation normally ends there, while
future projects still have baseline plans. Supplying `--after` generates a
longer execution corpus. `scenarioAtDate()` and `analyzeScenario()` reconstruct
the selected date's view and exclude later execution. Extending the simulation
does not change an earlier view; this is tested.

Raw corpus status fields summarize the simulation end. Application code should
use `scenarioAtDate(corpus, date)`, normally at `corpus.metadata.anchorDate`.
Snapshots cover end-of-day UTC and cannot query beyond their source's available
execution window. The full immutable baseline is visible even when its work
lies in the future; this is operational replay, not a full audit of when every
plan or reference record was originally known.

Civil dates use UTC arithmetic, independent of the host timezone. Baseline start
and finish dates are inclusive working dates. A zero-lag finish-to-start
successor starts on the next working day. Start-to-start governs starting;
finish-to-finish governs completion and does not prohibit overlapping work.
Schedule variance is in working days; report staleness is in calendar days.

The demo calendar uses Monday–Friday, 7.4 regular hours/day and a small explicit
holiday set. Current execution schedules weekdays with up to 10 hours/day and
50 hours/week for recovery. It does not yet schedule night or weekend recovery.
The calendar utilities support other weekday/holiday configurations.

Budgets remain unchanged by execution. Phase cost variance compares actual
direct cost with baseline cost at reported physical progress. Thus unfinished
work is not automatically labeled under budget merely because it has not yet
consumed its entire budget. Project totals include unallocated site costs once.
Issue attribution is a subset of the same costs, never an additional charge.
Money uses DKK consistently; resource quantities and planning coefficients are
illustrative, not construction estimating guidance.

`assignedHeadcount` counts assigned, non-absent people. `availableHoursPerWeek`
also accounts for their overlapping assignment commitments, so a named crew
does not imply full staffing capacity. `plannedHoursPerWeek` records the derived
nominal requirement in the health projection.

Thresholds are explicit in `HEALTH_THRESHOLDS`: excessive overtime is above 15%
of logged hours, stale reporting above 7 calendar days, cost overrun above 5%
of earned baseline cost (with a 1 DKK floor), and high schedule risk begins at
10 working days of slippage. These are demo policy, separate from stored facts.

Small model extensions make historical/operational views usable:

- `DelayImpactReport` retains dated estimates. Later delay extensions cannot
  rewrite an earlier snapshot's lost-hour or impact totals.
- PhaseHealth adds expected cost at progress and weekly staffing capacity.
- Optional assignment recording timestamps distinguish later temporary crew
  assignments and recorded actual end dates from facts already known earlier.

Delay totals across concurrent causes use the union of affected dates, not the
sum of overlapping event durations. Forecasts use recorded progress, capacity,
dependencies and known expected delivery dates; they cannot inspect a future
delivery's hidden simulated arrival date.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/domain/model.ts` | Domain records and projection contracts |
| `src/domain/calendar.ts`, `dependencies.ts` | Date/calendar rules and DAG scheduling |
| `src/generator/plan.ts` | Reference data, project/scope/resource plans and assignments |
| `src/generator/simulate.ts` | Daily causal execution |
| `src/generator/validate.ts` | Independent structural, temporal, resource and cost checks |
| `src/domain/snapshot.ts`, `projections.ts` | Historical views and derived management state |
| `src/generator/coverage.ts` | Evidence that useful scenario archetypes exist |
| `src/cli.ts` | Inspect/export a scenario without a UI |
| `src/app/contract.ts` | Application DTOs and semantic-filter contract |
| `src/server/scenario.ts` | Shared queries, paging/filtering, and validated commands |
| `src/transport/` | Generic embedded-fetch and Node HTTP adapters |
| `src/ui/session.ts`, `scenario.worker.ts` | Application intent, Glue queries/commands, worker bridge |
| `src/ui/main.tsx`, `screens.tsx` | Fray shell and seven active-only screen compositions |
| `src/ui/editor.tsx`, `visuals.tsx` | Mutation dialogs and operational chart compositions |

## Verification and boundaries

`pnpm verify` typechecks and tests determinism, multiple seeds, timezones,
calendar boundaries, all dependency types, future-data isolation, overtime,
cost reconciliation and rejection of deliberately corrupted facts.
It also covers screen queries, semantic filtering, paging, classifications,
historical chart values, command validation, and embedded cancellation.
`pnpm test:http` exercises transport parity using an ephemeral local HTTP port;
`pnpm test:ui` exercises navigation, filters, dialogs, chart rendering, appearance,
forced states, and responsive layout in Chromium.
`pnpm test:demo` separately generates the larger default demo and verifies all
23 coverage checks and the 8 completed / 24 active / 8 future cohort split.

The current default demo has 40 projects, 1,742 scope nodes, 13,143 phases,
36,701 labour entries, 123,896 material-use records and 1,821 issues. Generation,
validation and analysis took about 23 seconds locally. Profile quantities are
approximate: labour/issue volumes still need calibration toward the larger
planning targets. The full stress profile has not yet been benchmarked.

The same generator runs all profiles; it does not fabricate chart-only facts
or rewrite health flags to satisfy coverage. Hidden project factors and a few
deterministic incident recipes provide healthy, supply-constrained and
quality-constrained histories. Coverage is reported explicitly for arbitrary
seeds; not every archetype is guaranteed for reduced/custom configurations.

The generic transport examples were copied into `src/transport/`; application
policy lives in `ConstructionScenario`, not in those adapters. The supplied
examples and authoritative planning documents remain untouched.

Dates, range controls and expandable detail use native HTML where the plan names
future Fray controls. Phase detail uses row selection plus expandable sections.
New issues start open with an unknown/suspected cause; new delays start active
with an unclassified cause. Existing causal locations cannot be moved, and actual
costs remain derived from resource records. Regenerating resets all in-memory edits.
Every operational screen uses the fixed anchor date; planning controls look ahead
against that snapshot, and trend controls select historical observation windows.

Not implemented: production persistence/authentication, exhaustive issue-status
audit histories, weekend/night recovery, stress-profile benchmarking, and complete
analytic variance decomposition. Chart area represents record count, not monetary
weight; material quantities are shown per unit and never summed across units.
