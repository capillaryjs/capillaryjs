# Releasing Capillary, Capillary UI, Viz, and DevTools

DevTools' first release must accompany (or follow) the diagnostics-enabled
Capillary and Capillary UI 1.2 releases. Its source peer minimum is `^1.2.0`;
prepare/stage validation rejects the older baseline. An exact independent plan
can select Capillary 1.2.0, UI 1.2.0, and DevTools 1.0.0 without releasing Viz.
The implementation checkout intentionally leaves existing manifests/Unreleased
notes for guarded metadata promotion. Local packed-consumer verification uses
the updated source; it is not evidence that old published 1.1 binaries support
the new protocol. Nothing is published by building or starting the flow lab.

Ordinary pushes never publish packages. npm releases begin from a reviewed,
clean commit on protected public `main`, pass the full public verification
gate, and enter npm's staged-publishing workflow through GitHub OIDC. A human
maintainer inspects and promotes every stage with 2FA.

## 1. Prepare metadata

Choose an exact release plan containing only the packages being released.
Dependencies must remain compatible: Capillary precedes Capillary UI, which precedes Capillary UI
Visualization.

Every selected package must have a real changeout in its own `CHANGELOG.md`:
the `Unreleased` section needs one of the standard categories (`Added`,
`Changed`, `Fixed`, or `Removed`) and a non-empty bullet. The release tooling
filters package choices and rejects plans that do not meet this requirement.
An already prepared recovery candidate is the only exception; its notes have
already been promoted under the target version.

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
- the promoted changelog entry inside every selected tarball (not only in the
  source checkout);
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
`capillaryjs/capillaryjs`, workflow `release.yml`, environment
`npm-release`, and staged-publishing permission.

## 4. Inspect and promote stages

Use npmjs.com **Staged Packages** or the pinned staged-publishing CLI. The
`stage list` command accepts a package name, not a package/version specifier:

```bash
npx --yes --package=npm@11.19.1 npm stage list @capillaryjs/capillary-ui --json
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
dependant: Capillary, then Capillary UI, then Capillary Viz and Capillary DevTools.

After each promotion, verify the exact public version, distribution tag,
provenance link, and a clean exact-version install.

After the ReleaseTool verifies the final npm package, it automatically
dispatches `.github/workflows/github-packages-release.yml` with the same
verified tarballs. That workflow mirrors the packages to GitHub Packages using
the repository `GITHUB_TOKEN` and `packages: write`; it does not rebuild or
republish from the working tree. GitHub creates a new npm package privately by
default, so configure the package visibility once in GitHub if a public mirror
is desired. A mirror failure does not alter the already verified npm release;
rerun the mirror workflow after correcting its GitHub Packages permissions.

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
publisher entries for all four packages. This does not delete existing public
versions.
