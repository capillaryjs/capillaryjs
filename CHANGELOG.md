# Changelog

All notable changes to Glue and Fray are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic
Versioning.

## Unreleased

## 0.2.0 - 2026-09-03

### Added

- Generated theme-neutral Fray structural CSS and independently replaceable
  Shiny, Java, and Minimal treatment bundles.
- Eight independently replaceable Fray color palettes, a documented
  hierarchical CSS-variable catalog, and theme/color picker components.
- Package-level architecture and integration documentation reconstructed from
  the original Glue and Fray design discussions.

### Changed

- Fray components now consume semantic palette, family, variant, and
  component-level styling variables instead of embedding theme colors.
- Fray packaging and consumer checks now validate structural, theme, and color
  CSS subpaths as real external assets.
- Fray's published peer dependency now follows the compatible Glue `0.2.x`
  release line.

## 0.1.0-alpha.1 - 2026-09-02

### Added

- Initial public alpha packaging for `@sylwellsoftware/glue` and
  `@sylwellsoftware/fray`.
- Strict TypeScript source and declarations, ESM package exports, JSX runtimes,
  accessible controls, supported light/dark themes, and experimental data APIs.
- Generic caller-supplied scenario adapters for in-memory and Node HTTP tests.
- Standalone verification, deterministic tarball inspection, isolated consumer
  tests, privacy scanning, and checked Gradle orchestration.

### Changed

- Glue is an external Fray peer dependency.
- Package metadata now points exclusively to the public Sylwell Software
  repository and Apache-2.0 license.
