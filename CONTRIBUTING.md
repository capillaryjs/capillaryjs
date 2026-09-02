# Contributing

Thanks for helping improve Glue and Fray. The project is in an experimental
alpha stage, so proposals that clarify contracts, accessibility, lifecycle
ownership, and package boundaries are especially useful.

Before opening a change:

1. Search existing issues and describe the problem or proposed API behavior.
2. Keep Glue independent of the DOM and keep Glue as Fray's only framework
   peer dependency.
3. Add focused unit, type, or browser tests for observable behavior.
4. Run `pnpm verify`; release-affecting changes should also pass
   `pnpm verify:release`.
5. Update the relevant README and `CHANGELOG.md` when behavior or public APIs
   change.

Use Node 22 or newer and the pnpm version declared by `packageManager`. Install
with `pnpm install --frozen-lockfile`. Please keep commits reviewable and do not
include generated build output, credentials, customer data, or unrelated
application fixtures.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Security reports belong in the private channel described in
[SECURITY.md](SECURITY.md), not in a public issue.
