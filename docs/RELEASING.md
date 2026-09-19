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
maintainer authorizes publication; the desktop tool verifies exact staged bytes
and promotes stages in dependency order with npm's required 2FA.

## 1. Prepare metadata

Choose an exact release plan containing only the packages being released.
Dependencies must remain compatible: Capillary precedes Capillary UI, which precedes Capillary UI
Visualization.

Every selected package's `CHANGELOG.md` is checked for substantive categorized
Unreleased notes. Empty headings and placeholder bullets do not count. The
desktop tool allows an explicit missing-notes exception for each affected
package/version, represented in its plan by `missingNotesApproval`, the SHA-256
of the exact original changelog. Preparation otherwise rejects absent notes.
An approved exception creates a dated entry recording that notes were omitted
with maintainer approval. Existing prepared notes are recognized on recovery.

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

The tool automatically validates:

- `.artifacts/release/package-artifacts.json`;
- every selected tarball inventory and digest;
- the promoted changelog entry inside every selected tarball (not only in the
  source checkout);

The maintainer reviews the exact version/tag plan, notes, and source changes.
Full file inventories remain available for inspection but need no acknowledgement.

Commit and push only the verified candidate, then wait for the required
`verify-release` check on public `main`. A different commit or candidate tree
requires a new verification run and artifact set.

## 3. Stage through trusted automation

The private integration workspace dispatches
`.github/workflows/release.yml` with the canonical JSON release plan. The
workflow checks out the selected public commit, repeats release verification,
validates registry availability, retains the exact tarballs as a workflow
artifact, and pauses at the protected `npm-release` environment.

Desktop dispatches additionally carry a release ID, candidate SHA, and SHA-256
of the exact plan JSON. The workflow checks those inputs; its run title binds
discovery to that release identity. CI/staging completion and npm's automated
review are polled automatically. Uncertain dispatches are reconciled, not repeated.

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
republish from the working tree. For each immutable package version it first
checks GitHub Packages: an absent version is published, an existing version is
downloaded and must match the retained workflow tarball byte-for-byte before it
is skipped, and a different artifact fails the mirror. GitHub creates a new
npm package privately by default, so configure the package visibility once in
GitHub if a public mirror is desired.

ReleaseTool records the mirror dispatch, its GitHub Actions run, and its final
result. The release cannot create tags or archive until the mirror succeeds.
For a pending workflow, use **Check GitHub Packages mirror**. For a failed
workflow, correct the GitHub Packages problem and use the tool's explicit
**Retry GitHub Packages mirror** action; it dispatches a new idempotent mirror
attempt rather than attempting a direct working-tree publish.

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
