# Fray Application Layout Guidelines

These guidelines describe a recommended source layout for applications built with Fray and Glue. They are conventions rather than framework requirements.

For deciding how screens, components, state lifetimes, and visual layouts fit
together, see the companion [application composition guide](application-composition-guide.md).

The main goals are:

* make application structure easy to understand by browsing the repository;
* keep backend/API concerns separate from view-specific concerns;
* colocate code that changes together;
* keep Fray components focused on presentation and interaction;
* avoid generic catch-all folders such as `core`;
* introduce abstraction only when the application actually needs it.

## Recommended structure

A typical application should start roughly like this:

```text
src/
  app/
    main.tsx
    routing.ts
    services.ts
    appearance.ts

  api/
    dtos.ts
    errors.ts

  domain/
    ...

  services/
    ProjectsService.ts
    WorkersService.ts
    IssuesService.ts

  views/
    ProjectOverviewView/
      ProjectOverviewView.tsx
      projectOverviewViewService.ts
      components/
        ...

    ScheduleView/
      ScheduleView.tsx
      scheduleViewService.ts
      components/
        ...

    IssuesView/
      IssuesView.tsx
      issuesViewService.ts
      components/
        ...

  shared/
    components/
    ...

  styles/
    ...

  index.ts
```

Not every application needs every directory. Add a directory when there is an actual responsibility for it to contain.

## `app/`: application composition

`app/` contains application-wide composition and policy.

Typical responsibilities include:

* application startup;
* routing;
* application service registration;
* session/application lifetime;
* theme and appearance selection;
* other whole-application configuration.

Keep this directory small. It should connect the major parts of the application rather than becoming a container for general application logic.

## `api/`: backend contract

`api/` contains types and utilities describing communication with the backend.

Typical contents include:

* request and response DTOs;
* response validation/parsing;
* API-specific errors;
* shared wire-level types.

The API contract should not contain presentation logic or view-specific projections.

## `services/`: backend-facing services

Root-level services should represent the capabilities exposed by the backend.

For example:

```text
services/
  ProjectsService.ts
  WorkersService.ts
  IssuesService.ts
  ScheduleService.ts
```

A service may define Glue endpoints, commands, serialization, parsing, and other concerns intrinsic to communicating with that backend API.

The service should remain a faithful application-facing representation of the backend rather than gradually becoming tailored to individual screens.

For example, a `ProjectsService` may expose:

```text
projects
project
createProject
updateProject
```

and an `IssuesService` may expose:

```text
issues
issue
createIssue
resolveIssue
```

but root services should normally not expose things such as:

```text
issuesVisibleForCurrentPhase
workersGroupedForSchedule
projectsForDashboardCards
filteredIssuesForAnalytics
```

unless those operations have genuine application-wide or domain meaning.

A useful rule is:

> Root services represent backend capabilities. View services represent what a particular view needs.

## `views/`: organize UI by feature

The UI should primarily be organized vertically by view or screen.

For example:

```text
views/
  ScheduleView/
    ScheduleView.tsx
    scheduleViewService.ts
    scheduleProjection.ts
    components/
      PhaseTimeline.tsx
      WorkerAllocation.tsx

  IssuesView/
    IssuesView.tsx
    issuesViewService.ts
    issueGrouping.ts
    components/
      IssueDetails.tsx
      IssueSummary.tsx
```

Code used only by one view should normally live with that view.

This makes the location of functionality predictable and keeps related implementation together.

Prefer this over global directories such as:

```text
components/
models/
helpers/
viewModels/
```

that require developers to jump between several unrelated parts of the source tree when changing one screen.

## View services

A view may define its own service or state/coordinator object when the view needs derived state or composition beyond the raw backend API.

For example:

```text
IssuesService
WorkersService
      │
      ▼
ScheduleViewService
      │
      ▼
ScheduleView
```

`ScheduleViewService` may own:

* filtering;
* sorting;
* grouping;
* mappings;
* derived Glue emitters;
* selection state;
* query arguments;
* projections;
* combinations of several backend services;
* other state or operations meaningful specifically to that view.

A view service should still be independent of rendering. It should not manipulate DOM nodes, Fray component instances, CSS, or presentation markup.

It should expose meaningful values and operations that the view renders or interacts with.

## Reactive values may flow in both directions

Architectural ownership should not be confused with runtime data flow.

A Fray application commonly has interactions such as:

```text
DataTable sort control
        │
        ▼
sort Emitter
        │
        ▼
query argument
        │
        ▼
backend-facing service/query
        │
        ▼
new rows
        │
        ▼
DataTable
```

Likewise:

```text
SearchInput
    │
    ▼
searchText Emitter
    │
    ▼
query argument
```

or:

```text
DateTimePicker
      │
      ▼
selectedDate Emitter
      │
      ▼
query/filter argument
```

This is normal and desirable.

Controls may expose writable Glue values that feed into view services, derived emitters, query arguments, or backend queries. Query results then flow back into the components that render them.

The important architectural rule is therefore not that values only flow downward.

Instead:

> Higher-level application and domain concepts should not depend on the presentation details of the views that consume them.

A backend-facing service may accept an emitter or query argument originating from a view without knowing which control produced it.

For example:

```text
DataTable
   │ sort Emitter
   ▼
ScheduleViewService
   │ query argument
   ▼
ScheduleService
   │ result
   ▼
ScheduleViewService
   │ projected data
   ▼
DataTable
```

The runtime data flow forms a reactive loop, while ownership and knowledge remain cleanly separated.

The `ScheduleService` knows about schedule queries and their arguments. It should not know that the sort value originated from a `DataTable`, a dropdown, or some other Fray component.

## Promote logic only when it is genuinely shared

Start feature-specific code inside the feature that needs it.

For example:

```text
views/
  IssuesView/
    components/
      IssueDetails.tsx
```

Do not move `IssueDetails` into `shared/components` merely because another view might eventually use it.

Move code upward only once it has a real broader responsibility.

A useful progression is:

```text
view-specific
      ↓ if genuinely reused
shared application code
      ↓ if it represents domain meaning
domain abstraction
```

Two callers alone are not necessarily sufficient reason to create a shared abstraction.

## `domain/`: application/domain concepts

`domain/` contains logic that describes the application's problem domain rather than a particular screen or transport mechanism.

For a construction application this might include:

```text
domain/
  project.ts
  phase.ts
  dependency.ts
  calendar.ts
  scheduling.ts
  cost.ts
```

Typical responsibilities include:

* domain models;
* calculations;
* scheduling rules;
* prerequisite/dependency rules;
* projections with domain meaning;
* classification rules;
* reusable domain transformations.

Domain code should ideally have no dependency on Fray, DOM APIs, CSS, or HTTP.

Do not create additional hierarchy merely for architectural appearance. If the entire application is already about construction:

```text
domain/
  phase.ts
  scheduling.ts
```

is usually clearer than:

```text
domain/
  construction/
    phase.ts
    scheduling.ts
```

Add another level only when multiple genuinely distinct domains exist.

## `shared/`: use sparingly

`shared/` contains functionality genuinely shared by unrelated areas of the application.

Typical examples include:

```text
shared/
  components/
    ApplicationHeader.tsx
    StatusBadge.tsx
```

`shared/` should not become a dumping ground.

Prefer keeping code inside a view until it clearly belongs to the wider application.

## Fray components

Fray components primarily own presentation and interaction.

They may:

* render application state;
* expose or bind controls to Glue emitters;
* update writable Glue values;
* invoke commands and callbacks;
* react to readable Glue values;
* own short-lived presentation state.

For example, a table header may update a sort emitter, a search control may update a search-text emitter, and a date picker may update a date emitter. Those values may subsequently participate in derivations or backend queries.

Components should generally not acquire responsibilities such as:

* backend serialization;
* application-wide business rules;
* reusable domain calculations;
* backend-specific DTO conversion;
* screen-independent data transformations.

The component should consume and update state appropriate to its level rather than reconstructing application policy during rendering.

## Architectural dependencies versus reactive flow

It is useful to think about two different diagrams.

The architectural dependency structure may look roughly like:

```text
views/components
       │
       ▼
view services
       │
       ├────────► domain/shared logic
       │
       ▼
backend-facing services
       │
       ▼
API/transport
```

This describes what code knows about and imports.

Reactive runtime flow can travel through that structure in either direction:

```text
user interaction
      ↓
Emitter
      ↓
derivation/query argument
      ↓
query
      ↓
result
      ↓
view
```

A component can therefore initiate a change that eventually causes a backend query without the backend-facing service depending on that component.

Prefer clean knowledge and ownership boundaries rather than trying to force all runtime values into a single direction.

## Demo and development infrastructure

If an application contains substantial infrastructure purely to make a demo self-contained, keep it visibly separate from the example application itself.

For example:

```text
src/
  ... normal Fray application ...

demo-support/
  scenario/
  transport/
  worker/
  server/
  cli/
```

`src/` should demonstrate what an ordinary Fray application looks like.

`demo-support/` may contain:

* deterministic scenario generators;
* simulated backends;
* embedded Fetch-compatible transports;
* Web Workers used to run the simulation;
* Node HTTP servers;
* scenario-generation CLI tools.

These exist to make the demo self-contained. They are not part of the recommended architecture of a normal Fray application.

A developer should be able to inspect `src/` without getting the impression that scenario generation, an embedded server, or similar infrastructure is required by Fray.

Ideally, the application source should still make architectural sense if `demo-support/` were replaced by a real backend.

## Naming

Prefer names that communicate responsibility directly.

Prefer:

```text
domain/
services/
views/
transport/
api/
```

over broad architectural names such as:

```text
core/
common/
logic/
misc/
```

Similarly, prefer explicit filenames such as:

```text
scheduleViewService.ts
scenarioApi.ts
ScenarioFetch.ts
```

over several unrelated files all named:

```text
contract.ts
model.ts
helpers.ts
```

when the more specific name improves navigation.

## General rule

The overarching convention is:

> Organize by architectural responsibility at the top level and by feature within the UI. Colocate code that changes together, keep backend-facing services faithful to the backend, put view-specific composition and derivation beside the view, and promote code into shared or domain layers only when it has genuinely broader meaning.

Do not confuse architectural dependency with reactive data flow. Fray controls may write Glue emitters that feed into derivations and queries, and query results may in turn update what those views display. This is a normal part of the Glue/Fray model.

A good Fray application layout should reveal the application's own architecture without imposing a large framework-specific hierarchy.
