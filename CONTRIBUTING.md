# Contributing

Thanks for helping improve Glue and Fray. Changes that clarify contracts,
accessibility, lifecycle ownership, and package boundaries are especially
valuable.

## Before changing code

1. Search existing issues and describe the observable problem or proposed API
   behavior.
2. Preserve the dependency direction: applications own policy, Fray owns
   presentation, and Glue owns reactive propagation.
3. Keep Glue independent of the DOM. Fray may depend only on Glue as its
   framework peer. Fray Visualization may peer on both.
4. Prefer native browser semantics and explicit ownership over hidden state or
   dependency discovery.

Use Node 22 or newer and the pnpm version declared by `packageManager`:

```bash
pnpm install --frozen-lockfile
```

## Change requirements

- Add focused unit, type, or browser tests for observable behavior.
- Author new Fray templates and documentation examples in automatic TSX.
- Declare component styling dependencies explicitly and regenerate structural
  CSS when component-owned CSS changes.
- Update the affected package guide and `CHANGELOG.md` when public behavior,
  exports, migration guidance, or presentation contracts change.
- Keep README examples aligned with compile-checked examples under each
  package's `test-types` directory.
- Do not commit generated package build output, credentials, customer data, or
  unrelated application fixtures.

Run the checks appropriate to the change, then the complete gate before a
release candidate:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:types
pnpm build
pnpm test:browser
```

`pnpm verify` runs the main public workspace sequence. Release maintainers also
run `pnpm verify:release` and inspect the generated artifacts.

## Documentation

The root README explains the stack. Package READMEs are the detailed user
guides. `docs/API_SURFACE.md` is the concise public inventory, and
`docs/architecture.md` owns cross-package boundaries. Changelogs are historical
release records and should not be retroactively rewritten except to correct a
material factual error.

Use relative links that resolve inside this public repository. Do not link to
private integration-workspace notes or use machine-specific paths.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Security reports belong in the private channel described in
[SECURITY.md](SECURITY.md), not in a public issue.
