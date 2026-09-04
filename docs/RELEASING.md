# Releasing Glue, Fray, and Fray Visualization

Normal development and demo builds use the local workspace source. npm releases
are a separate, deliberate operation from a reviewed, clean commit on public
`main`.

## Prepare and stage

1. Update the selected package versions, compatible dependency ranges, and each
   selected package's `CHANGELOG.md`. Use `next` for prereleases and reserve `latest` for an
   explicitly approved stable release.
2. Run `pnpm verify:release` and review
   `.artifacts/release/package-artifacts.json` plus every tarball inventory.
3. Commit and push the reviewed source. Wait for the required `verify-release`
   check on `main`.
4. From the private integration workspace, run the Gradle
   `npmStageReleasePreflight` task with the exact version, tag, and release set,
   then explicitly confirm `npmStageRelease`. This only dispatches
   `.github/workflows/release.yml`.
5. Approve the protected `npm-release` GitHub environment. The workflow reruns
   release verification and uses npm OIDC to stage the exact tarballs.
   Dependencies are staged before dependants: Glue, Fray, then Fray
   Visualization. No npm token is stored in GitHub.

## Review and promote

CI cannot make a staged package public. In npm's **Staged Packages** page, or
with npm 11.15 or newer, list the stages and inspect each one:

```text
npm stage list @sylwellsoftware/glue
npm stage view <stage-id>
npm stage download <stage-id>
```

Compare the downloaded tarball, package/version/tag, inventory, and SHA-256 with
the workflow artifact and plan. Then approve with npmjs.com or `npm stage
approve <stage-id>`. npm requires maintainer 2FA. For a combined release,
approve and verify Glue before Fray, and Fray before Fray Visualization. Verify the public version,
distribution tag, clean exact-version installation, and npm provenance linked
to this repository.

## Failure and recovery

If a dependency stages but a dependant fails, do not rerun blindly. Inspect
the pending stage, correct the cause, and either stage only the remaining
package or reject the dependency with `npm
stage reject <stage-id>` using 2FA. A rejected stage is not public; package
history is unchanged.

To stop releases, disable `release.yml` in GitHub Actions and remove or revoke
the trusted-publisher entries for all three packages. The intended trust identity is
only `sylwellsoftware/gluefrayjs`, workflow `release.yml`, environment
`npm-release`, with `npm stage publish` permission. Disabling or revoking this
path does not delete any published version. Never unpublish a release as an
incident response; deprecate a bad public version and prepare a corrected one.
