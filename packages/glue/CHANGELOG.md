# Glue changelog

All notable changes to `@sylwellsoftware/glue` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic
Versioning.

## Unreleased

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
