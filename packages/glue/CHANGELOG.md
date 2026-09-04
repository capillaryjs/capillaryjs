# Glue changelog

All notable changes to `@sylwellsoftware/glue` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic
Versioning.

## Unreleased

### Added

- Exported `NonEmptyArray<T>` for public APIs that require one or more values.

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
