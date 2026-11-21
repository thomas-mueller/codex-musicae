# CI workflows and triggers (PIP-011, PIP-012)

Every workflow can be started by hand (`workflow_dispatch`, Actions tab → workflow → Run workflow). `scripts/check-workflows.mjs` (part of `npm run lint`) checks the triggers below; its self-test cases are in `scripts/lint-selftest.mjs`.

| Workflow | Branch push | Pull request to `main` | Tag `v*` | After successful `lint-test` | Manual |
|---|---|---|---|---|---|
| `lint-test` (lint, lint self-test, unit tests, build) | every branch (not tags) | – | – | – | yes |
| `e2e` (Playwright, nine projects) | no | yes | yes | – | yes |
| `deploy-web` | – | – | – | yes (`workflow_run`) | yes |
| `android` | – | – | – | yes (`workflow_run`) | yes |
| `ios` | – | – | – | yes (`workflow_run`) | yes |

- `e2e` is a separate workflow, so no other workflow waits for it (DEC-100).
- A manual run of `deploy-web`, `android` or `ios` builds the commit of the selected ref (`github.sha`); a `workflow_run` run builds the validated commit (`workflow_run.head_sha`). A manual `deploy-web` run deploys to the live channel.
- Tag pushes run `e2e` only; they do not run `lint-test`, so a tag deploys nothing (PIP-009).
- Android details: `docs/android-ci.md`. iOS: `docs/ios-distribution.md`.
