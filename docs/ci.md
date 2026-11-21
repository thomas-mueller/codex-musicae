# CI workflows and triggers (PIP-011, PIP-012)

Every workflow can be started by hand (`workflow_dispatch`, Actions tab → workflow → Run workflow). `scripts/check-workflows.mjs` (part of `npm run lint`) checks the triggers below; its self-test cases are in `scripts/lint-selftest.mjs`.

| Workflow | Branch push | Pull request to `main` | Tag `v*` | After successful `lint-test` | Manual |
|---|---|---|---|---|---|
| `lint-test` (lint, lint self-test, unit tests, build) | every branch (not tags) | – | – | – | yes |
| `e2e` (Playwright, eleven projects) | no | yes | yes | – | yes |
| `deploy-web` | – | – | – | yes (`workflow_run`) | yes |
| `android` | – | – | – | yes (`workflow_run`) | yes |
| `ios` | – | – | – | yes (`workflow_run`) | yes |

- `e2e` is a separate workflow, so no other workflow waits for it (DEC-100).
- A manual run of `deploy-web`, `android` or `ios` builds the commit of the selected ref (`github.sha`); a `workflow_run` run builds the validated commit (`workflow_run.head_sha`). A manual `deploy-web` run deploys to the live channel.
- Tag pushes run `e2e` only; they do not run `lint-test`, so a tag deploys nothing (PIP-009).
- Android details: `docs/android-ci.md`. iOS: `docs/ios-distribution.md`.
- The `e2e` suite includes the request test (`e2e/no-external-requests.spec.ts`, NFR-017, NFR-018) on the production build in Chromium, Firefox and WebKit: it records every request while a PDF is opened, detected, shown in two modes, drawn on and saved, and fails on any request outside the app's own origin (`data:` and `blob:` excepted). The phone and tablet profiles run only `@smoke` and skip it.
- `lint-test` runs the unit tests with coverage (`@vitest/coverage-v8`, DEC-140), writes the table per kind of test to the job summary and uploads `coverage/coverage-summary.md` as the artifact `coverage-summary`; no threshold fails a build. After the production build it runs `node scripts/check-versions.mjs --built` (display version in the bundle, no source maps, minified).
- The version `vX.Y.Z` of web, Android and iOS comes from `scripts/lib/version.mjs` (DEC-141); the workflows call `node scripts/version-info.mjs`.
- Small phone profile: `chromium-small-phone` and `firefox-small-phone` (360 × 640) run the `@smoke` subset.
