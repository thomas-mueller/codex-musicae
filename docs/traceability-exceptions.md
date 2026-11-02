# Traceability exceptions

`done` requirements that no automated test names (M17 S4, TST-006). One line per ID: `- **ID** reason`. `scripts/check-traceability.mjs` (part of `npm run lint`) fails when a `done` requirement has neither a test nor an entry here, when an entry has gained a test (remove it then), or when an entry is not a `done` requirement. Reasons are grouped by kind; "covered, title lacks the ID" means the behaviour is asserted by an existing test whose title does not name the ID: renaming it was out of scope (existing tests are not edited), so adding the ID to that title removes the entry.

## Enforced by tooling, not by a test

- **ARC-001** ESLint boundary rules and the `npm run lint:selftest` fixtures fail CI on a violation; there is no unit test for the rule set itself.
- **ARC-002** ESLint (`no-restricted-imports`, `no-restricted-globals` for `core/`) and `lint:selftest`; determinism is checked by the unit specs of `core/` only indirectly.
- **PLT-003** ESLint restricts platform APIs to `adapters/` and the composition root; checked by `npm run lint` and `lint:selftest`.
- **NFR-014** The Angular build budget (`angular.json`, `T:budgets.initialBundleKbGzip`) fails `npm run build`, which `lint-test` runs on every push.

## Pipeline, repository and process facts (verified by running them)

- **GEN-004** Repository visibility and the absence of a license file are repository settings, checked by the owner.
- **GEN-006** No account, backend, analytics or crash reporting: a design property, partly guarded by `scripts/check-static-compliance.mjs` (no network requests or CDN) which runs in `npm run lint`; it has no test that names the ID.
- **PIP-002** `deploy-web` is a GitHub workflow; its behaviour is seen when it runs.
- **PIP-003** `android` is a GitHub workflow (signed APK, Firebase App Distribution); seen when it runs.
- **PIP-006** `versionName` and `versionCode` are computed in the Gradle build from git; seen in the built APK.
- **PIP-007** The composite action `.github/actions/build-web` is used by the workflows; seen when they run.
- **PIP-008** Secrets live in GitHub; nothing in the repository to test.
- **PIP-009** Tag naming is the owner's convention (`docs/roadmap.md`); the owner tags.

## Configuration values without a test (cheap to add later)

- **GEN-001** `T:identity.appName` is read by the web manifest and Android resources; no test asserts the generated names.
- **GEN-002** `T:identity.appId` is used for the Android `applicationId` and the Capacitor `appId`; no test compares them.
- **PLT-002** `minSdkVersion = 29` sits in `android/variables.gradle`; no test reads it.

## Covered, title lacks the ID

- **DET-020** `src/app/state/detection.service.spec.ts` asserts that every bitmap is closed by the engine (comment names DET-020), but no test title names it.
- **DET-024** `src/app/core/fixtures/detection.cases.ts` covers per-page padding and mixed page sizes (file header names DET-024), but the fixture cases carry other `req` values.
- **SLD-001** The slide packing cases in `src/app/core/fixtures/slides.cases.ts` use the aspect ratio throughout (header names SLD-001..SLD-006), but no case lists SLD-001 in its `req`.
