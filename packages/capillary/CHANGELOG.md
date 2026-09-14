# Capillary changelog

All notable changes to `@capillaryjs/capillary` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic
Versioning.

## Unreleased

### Added

- Added an explicit `LiveQuery` refresh/retry retention policy. Refreshes retain
  a successful result by default; `{retention: 'replace'}` clears it for a
  conceptual dataset transition, and retries inherit the failed request policy.

## 1.0.0 - 2026-09-14

### Changed

- No public Capillary API changes; synchronize the package version with the
  companion Capillary UI and Capillary Viz release.

## 1.0.0-alpha.1 - 2026-09-14

### Changed

- Renamed the package from `@sylwellsoftware/glue` to
  `@capillaryjs/capillary`, and renamed public `Glue*`/`glue*` symbols to
  `Capillary*`/`capillary*`. Existing released entries below retain their
  historical names.

## 0.10.0 - 2026-09-13

### Added

- Added an opt-in `RetryPolicy` for `LiveQuery`, `AsyncCommand`, and endpoint
  `query` defaults: `maxAttempts`, `delayMs`, `'fixed'`/`'exponential'`/custom
  `backoff`, `maxDelayMs` cap, full `jitter`, a `shouldRetry` predicate, and an
  injectable `scheduler`. Per-instance options override endpoint defaults and
  `retry: null` disables an inherited policy; requests stay `Loading` across
  attempts and abort/dispose cancels pending retry timers. Retry policy or
  scheduler failures settle as terminal errors rather than remaining loading.

## 0.9.1 - 2026-09-08

### Fixed

- Published npm packages now include this changelog alongside their release
  history.

## 0.9.0 - 2026-09-08

### Added

- Added `LiveQuery` `execution` policies for immediate loading, one-way deferred
  activation, and permanently explicit refreshes, plus idempotent
  `LiveQuery.activate()` and endpoint option propagation.

### Changed

- Deferred queries now suppress argument subscriptions and polling until
  activation. Existing `autoFetch` behavior remains compatible and is
  mutually exclusive with the named policy.

## 0.8.1 - 2026-09-07

### Changed

- Reworked the package guide around current emitter, query, endpoint, command,
  diagnostic, ownership, and complete package-root export contracts.
- Restored the framework overview's design rationale for keeping application
  relationships direct instead of maintaining a framework-shaped copy of
  application state, including the intent behind the Glue name.

## 0.8.0 - 2026-09-06

### Added

- Exported `NonEmptyArray<T>` for public APIs that require one or more values.

### Changed

- Enabled strict TypeScript compiler checking.

## 0.7.0 - 2026-09-04

- No public Glue API changes; version synchronized with the framework release.

## 0.6.0 - 2026-09-04

- No public Glue API changes; version synchronized with the framework release.

## 0.5.0 - 2026-09-03

- No public Glue API changes; version synchronized with the framework release.

## 0.4.0 - 2026-09-03

### Added

- Immutable `QueryEndpoint`, `RestEndpoint`, and `DerivedEndpoint`
  declarations with shared `LiveResult` contracts and caller-owned instances.
- Opt-in `LiveQuery` polling with reactive controls, overlap prevention,
  injectable scheduling, and deterministic cleanup.
- Optional `RestQueryHandler.parseResult` response validation after JSON
  parsing.

### Changed

- `LiveQuery` now exposes explicit `abort()` without disposing the query.
- Application services can declare reusable remote and offline-filtered
  endpoints without a Glue registry, cache, or dependency-injection system.
- Command-triggered query reconciliation is application-owned; refreshed query
  failures do not alter the settled command state.

## 0.3.0 - 2026-09-03

- No public Glue API changes; version synchronized with the framework release.

## 0.2.0 - 2026-09-03

- No public Glue API changes; version synchronized with the framework release.

## 0.1.0-alpha.1 - 2026-09-02

### Added

- Initial public packaging with strict TypeScript declarations, ESM exports,
  generic caller-supplied scenario adapters, deterministic artifact checks, and
  standalone verification.

### Changed

- Glue became the external peer dependency used by Fray.
