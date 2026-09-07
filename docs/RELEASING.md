# Releasing Glue, Fray, and Fray Visualization

Ordinary pushes never publish packages. npm releases begin from a reviewed,
clean commit on protected public `main`, pass the full public verification
gate, and enter npm's staged-publishing workflow through GitHub OIDC. A human
maintainer inspects and promotes every stage with 2FA.

## 1. Prepare metadata

Choose an exact release plan containing only the packages being released.
Dependencies must remain compatible: Glue precedes Fray, which precedes Fray
Visualization.

For each selected package:

- choose the exact version and distribution tag (`next` for a prerelease;
  `latest` only for an approved stable release);
- update the package version and any selected-package peer range;
- promote its `Unreleased` changelog entries under a dated version heading;
- leave unrelated package metadata unchanged.

The repository's preparation tooling validates this shape and records an exact
candidate fingerprint. Re-running the identical plan is safe; do not hand-edit
the candidate after verification.

## 2. Verify the candidate

From this public repository, the complete gate is:

```bash
pnpm verify:release
```

It runs formatting, lint, tooling tests, builds, type checks, package tests,
consumer type checks, the browser/accessibility matrix, tarball and external
consumer checks, a public source scan, and the release preflight.

Review:

- `.artifacts/release/package-artifacts.json`;
- every selected tarball inventory and digest;
- the exact version/tag plan;
- the complete source diff.

Commit and push only the verified candidate, then wait for the required
`verify-release` check on public `main`. A different commit or candidate tree
requires a new verification run and artifact set.

## 3. Stage through trusted automation

The private integration workspace dispatches
`.github/workflows/release.yml` with the canonical JSON release plan. The
workflow checks out the selected public commit, repeats release verification,
validates registry availability, retains the exact tarballs as a workflow
artifact, and pauses at the protected `npm-release` environment.

After environment approval, GitHub obtains a short-lived npm identity through
OIDC and runs `npm stage publish` for the exact verified tarballs. No npm token
is stored in GitHub. CI stages only; it cannot approve or make a stage public.

The trusted-publisher identity is restricted to repository
`sylwellsoftware/gluefrayjs`, workflow `release.yml`, environment
`npm-release`, and staged-publishing permission.

## 4. Inspect and promote stages

Use npmjs.com **Staged Packages** or the pinned staged-publishing CLI. The
`stage list` command accepts a package name, not a package/version specifier:

```bash
npx --yes --package=npm@11.19.1 npm stage list @sylwellsoftware/fray --json
npx --yes --package=npm@11.19.1 npm stage view <stage-id>
npx --yes --package=npm@11.19.1 npm stage download <stage-id>
```

Compare the stage's package, version, tag, contents, provenance, and digest with
the retained workflow artifact and local report. Then approve through npmjs.com
or:

```bash
npx --yes --package=npm@11.19.1 npm stage approve <stage-id>
```

Approval requires an authenticated maintainer session and npm 2FA. If a
combined release is staged, approve and verify each dependency before its
dependant: Glue, then Fray, then Fray Visualization.

After each promotion, verify the exact public version, distribution tag,
provenance link, and a clean exact-version install.

## Failure and recovery

- If verification fails, fix the source or test and create a new candidate.
  Never promote artifacts from a failing run.
- If a dependency stages but a dependant fails, inspect the pending stage and
  correct the cause. Stage only the missing package when the release tooling
  identifies that recovery path.
- Reject an unwanted pending stage with npmjs.com or
  `npm stage reject <stage-id>`. Rejection requires 2FA and does not change
  public package history.
- If one package is already public, verify it before continuing in dependency
  order; do not blindly repeat the whole plan.
- Do not unpublish a bad public release as incident response. Deprecate it and
  prepare a corrected version.

To suspend releases, disable `release.yml` and remove or revoke the npm trusted
publisher entries for all three packages. This does not delete existing public
versions.
